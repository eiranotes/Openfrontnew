import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function write(rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return;
  fs.writeFileSync(file, content);
  console.log(`updated ${rel}`);
}

function replaceRequired(rel, search, replacement, marker) {
  const file = path.join(root, rel);
  let content = fs.readFileSync(file, 'utf8');
  if (marker && content.includes(marker)) {
    console.log(`already patched ${rel}: ${marker}`);
    return;
  }
  if (!content.includes(search)) {
    throw new Error(`Patch anchor not found in ${rel}: ${search.slice(0, 120)}`);
  }
  content = content.replace(search, replacement);
  fs.writeFileSync(file, content);
  console.log(`patched ${rel}`);
}

const fortressBalance = `import { UnitType, type Game, type Player } from "./Game";
import { within } from "../Util";

export const TRAINING_CAPACITY_PER_CITY_LEVEL = 200_000;

export interface MilitaryProfile {
  tier: number;
  label: string;
  maxQuality: number;
  quality: number;
  trainingCapacity: number;
  totalManpower: number;
  coverage: number;
  highestCityLevel: number;
  totalCityLevels: number;
}

const MILITARY_TIERS = [
  { minCityLevel: 1, label: "징집군", quality: 1.0 },
  { minCityLevel: 3, label: "훈련군", quality: 1.2 },
  { minCityLevel: 5, label: "상비군", quality: 1.45 },
  { minCityLevel: 7, label: "정예군", quality: 1.7 },
  { minCityLevel: 9, label: "근위군", quality: 2.0 },
] as const;

function completedCityLevels(player: Player): number[] {
  return player
    .units(UnitType.City)
    .filter((city) => city.isActive() && !city.isUnderConstruction())
    .map((city) => city.level());
}

export function totalMilitaryManpower(player: Player): number {
  const fieldArmies = player.outgoingAttacks().reduce(
    (sum, attack) => sum + attack.troops(),
    0,
  );
  const embarked = player
    .units(UnitType.TransportShip)
    .reduce((sum, ship) => sum + ship.troops(), 0);
  return Math.max(0, player.troops() + fieldArmies + embarked);
}

export function militaryProfile(player: Player): MilitaryProfile {
  const levels = completedCityLevels(player);
  const highestCityLevel = levels.length === 0 ? 0 : Math.max(...levels);
  const totalCityLevels = levels.reduce((sum, level) => sum + level, 0);
  let tierIndex = 0;
  for (let i = 1; i < MILITARY_TIERS.length; i++) {
    if (highestCityLevel >= MILITARY_TIERS[i].minCityLevel) tierIndex = i;
  }
  const tier = MILITARY_TIERS[tierIndex];
  const trainingCapacity =
    totalCityLevels * TRAINING_CAPACITY_PER_CITY_LEVEL;
  const totalManpower = totalMilitaryManpower(player);
  const coverage =
    totalManpower <= 0 ? 1 : Math.min(1, trainingCapacity / totalManpower);
  const quality = 1 + (tier.quality - 1) * coverage;

  return {
    tier: tierIndex,
    label: tier.label,
    maxQuality: tier.quality,
    quality,
    trainingCapacity,
    totalManpower,
    coverage,
    highestCityLevel,
    totalCityLevels,
  };
}

export function militaryQuality(player: Player): MilitaryProfile {
  return militaryProfile(player);
}

export interface OverextensionPenalties {
  share: number;
  pressure: number;
  lossMultiplier: number;
  speedCostMultiplier: number;
}

export function overextensionPenalties(
  game: Pick<Game, "numLandTiles">,
  player: Player,
): OverextensionPenalties {
  const share =
    player.numTilesOwned() / Math.max(1, game.numLandTiles());
  const pressure = within((share - 0.2) / 0.3, 0, 1);
  return {
    share,
    pressure,
    lossMultiplier: 1 + 0.35 * pressure,
    speedCostMultiplier: 1 + 0.45 * pressure,
  };
}
`;

const fortressTest = `import { describe, expect, it } from "vitest";
import { UnitType, type Player, type Unit } from "../src/core/game/Game";
import {
  militaryProfile,
  overextensionPenalties,
} from "../src/core/game/FortressBalance";

function unit(type: UnitType, level: number, troops = 0): Unit {
  return {
    type: () => type,
    level: () => level,
    troops: () => troops,
    isActive: () => true,
    isUnderConstruction: () => false,
  } as unknown as Unit;
}

function player(options: {
  cityLevels?: number[];
  troops?: number;
  attackTroops?: number[];
  embarkedTroops?: number[];
  tiles?: number;
}): Player {
  const cities = (options.cityLevels ?? []).map((level) =>
    unit(UnitType.City, level),
  );
  const ships = (options.embarkedTroops ?? []).map((troops) =>
    unit(UnitType.TransportShip, 1, troops),
  );
  return {
    units: (type?: UnitType) => {
      if (type === UnitType.City) return cities;
      if (type === UnitType.TransportShip) return ships;
      return [...cities, ...ships];
    },
    troops: () => options.troops ?? 0,
    outgoingAttacks: () =>
      (options.attackTroops ?? []).map((troops) => ({ troops: () => troops })),
    numTilesOwned: () => options.tiles ?? 0,
  } as unknown as Player;
}

describe("Fortress military quality", () => {
  it("gives a compact level-7 city network full elite quality", () => {
    const profile = militaryProfile(
      player({ cityLevels: [7, 3], troops: 700_000 }),
    );
    expect(profile.label).toBe("정예군");
    expect(profile.trainingCapacity).toBe(2_000_000);
    expect(profile.quality).toBeCloseTo(1.7, 5);
  });

  it("dilutes quality when manpower exceeds training capacity", () => {
    const profile = militaryProfile(
      player({
        cityLevels: [7, 3],
        troops: 2_000_000,
        attackTroops: [1_000_000],
        embarkedTroops: [1_000_000],
      }),
    );
    expect(profile.coverage).toBeCloseTo(0.5, 5);
    expect(profile.quality).toBeCloseTo(1.35, 5);
  });

  it("penalizes empires after twenty percent map share", () => {
    const game = { numLandTiles: () => 100_000 };
    const compact = overextensionPenalties(
      game,
      player({ tiles: 20_000 }),
    );
    const empire = overextensionPenalties(
      game,
      player({ tiles: 50_000 }),
    );
    expect(compact.lossMultiplier).toBe(1);
    expect(empire.lossMultiplier).toBeCloseTo(1.35, 5);
    expect(empire.speedCostMultiplier).toBeCloseTo(1.45, 5);
  });
});
`;

write('src/core/game/FortressBalance.ts', fortressBalance);
write('tests/FortressBalance.test.ts', fortressTest);

replaceRequired(
  'src/core/configuration/Config.ts',
  'import { TileRef } from "../game/GameMap";',
  'import {\n  militaryQuality,\n  overextensionPenalties,\n} from "../game/FortressBalance";\nimport { TileRef } from "../game/GameMap";',
  'overextensionPenalties',
);
replaceRequired(
  'src/core/configuration/Config.ts',
  'export const SAM_CONSTRUCTION_TICKS = 30 * 10;',
  'export const SAM_CONSTRUCTION_TICKS = 10 * 10; // Fortress: accessible first-line air defense',
  'Fortress: accessible first-line air defense',
);
replaceRequired(
  'src/core/configuration/Config.ts',
  '  SAMCooldown(): number {\n    return 90;\n  }\n  SiloCooldown(): number {\n    return 90;\n  }',
  '  SAMCooldown(): number {\n    return 60;\n  }\n  SiloCooldown(): number {\n    return 250;\n  }',
  'return 250;',
);
replaceRequired(
  'src/core/configuration/Config.ts',
  'cost: this.costWrapper(() => 750_000, UnitType.AtomBomb)',
  'cost: this.costWrapper(() => 1_500_000, UnitType.AtomBomb)',
  '1_500_000, UnitType.AtomBomb',
);
replaceRequired(
  'src/core/configuration/Config.ts',
  'cost: this.costWrapper(() => 5_000_000, UnitType.HydrogenBomb)',
  'cost: this.costWrapper(() => 10_000_000, UnitType.HydrogenBomb)',
  '10_000_000, UnitType.HydrogenBomb',
);
replaceRequired(
  'src/core/configuration/Config.ts',
  'Math.min(3_000_000, (numUnits + 1) * 1_500_000)',
  'Math.min(3_000_000, (numUnits + 1) * 750_000)',
  '(numUnits + 1) * 750_000',
);
replaceRequired(
  'src/core/configuration/Config.ts',
  'return captured.gold() / 2n;',
  'return captured.gold() / 4n;',
  'captured.gold() / 4n',
);
replaceRequired(
  'src/core/configuration/Config.ts',
  '      case UnitType.MIRVWarhead:\n        return { inner: 12, outer: 18 };\n      case UnitType.AtomBomb:\n        return { inner: 12, outer: 30 };\n      case UnitType.HydrogenBomb:\n        return { inner: 80, outer: 100 };',
  '      case UnitType.MIRVWarhead:\n        return { inner: 9, outer: 14 };\n      case UnitType.AtomBomb:\n        return { inner: 8, outer: 20 };\n      case UnitType.HydrogenBomb:\n        return { inner: 45, outer: 65 };',
  'return { inner: 8, outer: 20 }',
);
replaceRequired(
  'src/core/configuration/Config.ts',
  '  defaultSamRange(): number {\n    return 70;\n  }\n\n  samRange(level: number): number {\n    // rational growth function (level 1 = 70, level 5 just above hydro range, asymptotically approaches 150)\n    return this.maxSamRange() - 480 / (level + 5);\n  }',
  '  defaultSamRange(): number {\n    return 90;\n  }\n\n  samRange(level: number): number {\n    // Fortress: useful at level 1, with diminishing upgrades toward max range.\n    return this.maxSamRange() - 360 / (level + 5);\n  }',
  'Fortress: useful at level 1',
);
replaceRequired(
  'src/core/configuration/Config.ts',
  'return (5 * humans) / Math.max(1, tilesOwned);',
  'return (2 * humans) / Math.max(5_000, tilesOwned);',
  'Math.max(5_000, tilesOwned)',
);
replaceRequired(
  'src/core/configuration/Config.ts',
  '      let largeAttackBonus = 1;\n      if (attacker.numTilesOwned() > 100_000) {\n        largeAttackBonus = Math.sqrt(100_000 / attacker.numTilesOwned()) ** 0.7;\n      }\n      let largeAttackerSpeedBonus = 1;\n      if (attacker.numTilesOwned() > 100_000) {\n        largeAttackerSpeedBonus = (100_000 / attacker.numTilesOwned()) ** 0.6;\n      }\n\n      const defenderTroopLoss = defender.troops() / defender.numTilesOwned();',
  '      // Fortress: expansion creates logistics friction instead of a hidden combat bonus.\n      const overextension = overextensionPenalties(gm, attacker);\n      const largeAttackBonus = overextension.lossMultiplier;\n      const largeAttackerSpeedBonus = overextension.speedCostMultiplier;\n\n      const attackerQuality = militaryQuality(attacker).quality;\n      const defenderQuality = militaryQuality(defender).quality;\n      const qualityRatio = attackerQuality / Math.max(0.01, defenderQuality);\n      const exchangeModifier = within(Math.sqrt(qualityRatio), 0.72, 1.4);\n      const speedQualityModifier = within(\n        Math.pow(qualityRatio, 0.25),\n        0.9,\n        1.12,\n      );\n\n      const baseDefenderTroopLoss =\n        defender.troops() / defender.numTilesOwned();\n      const defenderTroopLoss =\n        baseDefenderTroopLoss * exchangeModifier;',
  'Fortress: expansion creates logistics friction',
);
replaceRequired(
  'src/core/configuration/Config.ts',
  '1.3 * defenderTroopLoss * (mag / 100) * traitorMod;',
  '1.3 * baseDefenderTroopLoss * (mag / 100) * traitorMod;',
  '1.3 * baseDefenderTroopLoss',
);
replaceRequired(
  'src/core/configuration/Config.ts',
  '      const attackerTroopLoss =\n        0.6 * currentAttackerLoss + 0.4 * altAttackerLoss;',
  '      const attackerTroopLoss =\n        (0.6 * currentAttackerLoss + 0.4 * altAttackerLoss) /\n        exchangeModifier;',
  'exchangeModifier;\n\n      return {',
);
replaceRequired(
  'src/core/configuration/Config.ts',
  '          largeAttackerSpeedBonus *\n          (defender.isTraitor() ? this.traitorSpeedDebuff() : 1),',
  '          largeAttackerSpeedBonus *\n          (defender.isTraitor() ? this.traitorSpeedDebuff() : 1) /\n          speedQualityModifier,',
  'speedQualityModifier,',
);

replaceRequired(
  'src/core/execution/AttackExecution.ts',
  'import { GameMap, TileRef } from "../game/GameMap";',
  'import { militaryQuality } from "../game/FortressBalance";\nimport { GameMap, TileRef } from "../game/GameMap";',
  'game/FortressBalance',
);
replaceRequired(
  'src/core/execution/AttackExecution.ts',
  `        // Target has opposing attack, cancel them out
        if (incoming.troops() > this.attack.troops()) {
          incoming.setTroops(incoming.troops() - this.attack.troops());
          this.attack.delete();
          this.active = false;
          return;
        } else {
          this.attack.setTroops(this.attack.troops() - incoming.troops());
          incoming.delete();
        }`,
  `        // Fortress: opposing armies cancel by effective combat power.
        const myQuality = militaryQuality(this._owner).quality;
        const enemyQuality = militaryQuality(incoming.attacker()).quality;
        const myPower = this.attack.troops() * myQuality;
        const enemyPower = incoming.troops() * enemyQuality;
        if (enemyPower > myPower) {
          incoming.setTroops((enemyPower - myPower) / enemyQuality);
          this.attack.delete();
          this.active = false;
          return;
        } else {
          this.attack.setTroops((myPower - enemyPower) / myQuality);
          incoming.delete();
        }`,
  'Fortress: opposing armies cancel by effective combat power',
);

replaceRequired(
  'src/core/execution/PlayerExecution.ts',
  `      const captor = this.mg!.player(owner.id());
      if (u.type() === UnitType.DefensePost) {
        u.delete(true, captor);
      } else {
        captor.captureUnit(u);
      }`,
  `      const captor = this.mg!.player(owner.id());
      // Fortress: conquest should not transfer a finished military-industrial
      // base intact. Cities survive in damaged form; ports are reset; hard
      // military infrastructure is destroyed.
      if (
        u.type() === UnitType.DefensePost ||
        u.type() === UnitType.MissileSilo ||
        u.type() === UnitType.SAMLauncher ||
        u.type() === UnitType.Factory
      ) {
        u.delete(true, captor);
      } else if (u.type() === UnitType.City) {
        const retainedLevel = Math.max(1, u.level() - 3);
        while (u.level() > retainedLevel) u.decreaseLevel(captor);
        captor.captureUnit(u);
      } else if (u.type() === UnitType.Port) {
        while (u.level() > 1) u.decreaseLevel(captor);
        captor.captureUnit(u);
      } else {
        captor.captureUnit(u);
      }`,
  'Fortress: conquest should not transfer',
);

replaceRequired(
  'src/core/AssetUrls.ts',
  '  return `/${encodeAssetPath(normalizedPath)}`;',
  '  const normalizedBase = baseUrl.replace(/\\/+$/, "");\n  return normalizedBase\n    ? `${normalizedBase}/${encodeAssetPath(normalizedPath)}`\n    : `/${encodeAssetPath(normalizedPath)}`;',
  'const normalizedBase = baseUrl.replace',
);
replaceRequired(
  'vite.config.ts',
  '    base: "/",',
  '    base: process.env.GITHUB_PAGES === "true" ? "/Openfrontnew/" : "/",',
  'process.env.GITHUB_PAGES',
);
replaceRequired(
  'src/client/SinglePlayerModal.ts',
  '  selectedDifficulty: Difficulty.Easy,\n  bots: 400,',
  '  selectedDifficulty: Difficulty.Medium,\n  bots: 80,',
  'bots: 80,',
);
replaceRequired(
  'src/client/SinglePlayerModal.ts',
  '  compactMap: false,',
  '  compactMap: true,',
  'compactMap: true,',
);
replaceRequired(
  'src/client/SinglePlayerModal.ts',
  '  disabledUnits: [] as UnitType[],',
  '  disabledUnits: [UnitType.HydrogenBomb, UnitType.MIRV] as UnitType[],',
  'UnitType.HydrogenBomb, UnitType.MIRV',
);

const rules = `# Fortress Mode balance

This fork changes OpenFront around two goals: compact development must remain a
real strategic option, and nuclear weapons must create an opening rather than
delete a small country outright.

## Military quality

| Highest completed city | Tier | Maximum quality |
| --- | --- | ---: |
| 1–2 | Conscript | 1.00x |
| 3–4 | Trained | 1.20x |
| 5–6 | Professional | 1.45x |
| 7–8 | Elite | 1.70x |
| 9+ | Guard | 2.00x |

Each completed city level trains 200,000 troops. If total manpower exceeds the
training capacity, quality is blended back toward 1.00x. Total manpower includes
home troops, active field armies, and troops embarked on transports.

Quality modifies casualty exchange through the square root of the quality ratio,
with safety caps. It also changes conquest speed only slightly. Opposing field
armies cancel by effective power rather than raw headcount.

## Anti-snowball rules

- Overextension begins at 20% of all land and reaches full pressure at 50%.
- At full pressure, attack losses are 35% higher and conquest costs 45% more time.
- Captured cities lose three levels; ports reset to level one.
- Factories, silos, SAMs, and defense posts are destroyed on capture.
- Human-player conquest transfers 25% of stored gold instead of 50%.

## Nuclear balance

- Atom bomb: 1.5M gold, radius 8/20.
- Hydrogen bomb: 10M gold, radius 45/65.
- MIRV warhead radius: 9/14.
- Non-MIRV troop-loss coefficient: 5 -> 2, with a 5,000-tile denominator floor.
- Silo cooldown: 25 seconds.
- First SAM: 750K, 10-second construction, 90 base range, 6-second reload.
- The default solo preset disables hydrogen bombs and MIRVs, but leaves atom
  bombs enabled for testing.
`;
write('FORTRESS_MODE.md', rules);
const readmePath = path.join(root, "README.md");
if (fs.existsSync(readmePath)) {
  const readme = fs.readFileSync(readmePath, "utf8");
  if (!readme.includes("OpenFront Fortress fork")) {
    fs.writeFileSync(
      readmePath,
      `# OpenFront Fortress fork\n\n> Personal balance fork focused on compact development, elite armies, anti-snowball logistics, and weaker nuclear weapons. See [FORTRESS_MODE.md](./FORTRESS_MODE.md).\n\n${readme}`,
    );
  }
}

console.log('Fortress patch applied successfully.');
