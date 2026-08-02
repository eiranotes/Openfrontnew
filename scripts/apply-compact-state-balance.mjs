import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const resolve = (relativePath) => path.join(root, relativePath);
const read = (relativePath) => fs.readFileSync(resolve(relativePath), "utf8");
const write = (relativePath, content) => {
  fs.mkdirSync(path.dirname(resolve(relativePath)), { recursive: true });
  fs.writeFileSync(resolve(relativePath), content);
};
function replaceOnce(relativePath, before, after, label) {
  let content = read(relativePath);
  if (content.includes(after)) return;
  if (!content.includes(before)) {
    throw new Error(`Compact-state balance anchor missing: ${label}`);
  }
  write(relativePath, content.replace(before, after));
}

write(
  "src/core/game/FortressBalance.ts",
  `import { UnitType } from "./Game";
import { within } from "../Util";

export const TRAINING_CAPACITY_PER_CITY_LEVEL = 200_000;
export const BASE_ADMINISTRATIVE_CAPACITY = 12_000;
export const ADMINISTRATIVE_CAPACITY_PER_CITY_LEVEL = 5_000;
export const ADMINISTRATIVE_CAPACITY_PER_FACTORY = 8_000;

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

export interface CompactStateProfile {
  administrativeCapacity: number;
  developmentDensity: number;
  efficiencyScore: number;
  economyMultiplier: number;
  reinforcementMultiplier: number;
  combatMultiplier: number;
  activeFactories: number;
  totalCityLevels: number;
}

const MILITARY_TIERS = [
  { minCityLevel: 1, minTotalCityLevels: 1, label: "징집군", quality: 1.0 },
  { minCityLevel: 3, minTotalCityLevels: 3, label: "훈련군", quality: 1.2 },
  { minCityLevel: 5, minTotalCityLevels: 7, label: "상비군", quality: 1.45 },
  { minCityLevel: 7, minTotalCityLevels: 13, label: "정예군", quality: 1.7 },
  { minCityLevel: 9, minTotalCityLevels: 21, label: "근위군", quality: 2.0 },
] as const;

interface MilitaryUnitLike {
  level(): number;
  isActive(): boolean;
  isUnderConstruction(): boolean;
  troops(): number;
}

interface MilitaryAttackLike {
  troops: number | (() => number);
}

export interface MilitaryPlayerLike {
  units(type: UnitType): MilitaryUnitLike[];
  outgoingAttacks(): MilitaryAttackLike[];
  troops(): number;
  numTilesOwned(): number;
}

function attackTroops(attack: MilitaryAttackLike): number {
  return typeof attack.troops === "function" ? attack.troops() : attack.troops;
}

function completedUnits(player: MilitaryPlayerLike, type: UnitType) {
  return player
    .units(type)
    .filter((unit) => unit.isActive() && !unit.isUnderConstruction());
}

function completedCityLevels(player: MilitaryPlayerLike): number[] {
  return completedUnits(player, UnitType.City).map((city) => city.level());
}

export function totalMilitaryManpower(player: MilitaryPlayerLike): number {
  const fieldArmies = player.outgoingAttacks().reduce(
    (sum, attack) => sum + attackTroops(attack),
    0,
  );
  const embarked = player
    .units(UnitType.TransportShip)
    .reduce((sum, ship) => sum + ship.troops(), 0);
  return Math.max(0, player.troops() + fieldArmies + embarked);
}

export function compactStateProfile(
  player: MilitaryPlayerLike,
): CompactStateProfile {
  const cityLevels = completedCityLevels(player);
  const totalCityLevels = cityLevels.reduce((sum, level) => sum + level, 0);
  const activeFactories = completedUnits(player, UnitType.Factory).length;
  const administrativeCapacity =
    BASE_ADMINISTRATIVE_CAPACITY +
    totalCityLevels * ADMINISTRATIVE_CAPACITY_PER_CITY_LEVEL +
    activeFactories * ADMINISTRATIVE_CAPACITY_PER_FACTORY;
  const developmentDensity =
    administrativeCapacity / Math.max(1, player.numTilesOwned());

  // Territory has no negative multiplier. Dense internal investment earns a
  // positive bonus, while expansion still increases absolute capacity.
  const efficiencyScore = within((developmentDensity - 0.25) / 0.75, 0, 1);

  return {
    administrativeCapacity,
    developmentDensity,
    efficiencyScore,
    economyMultiplier: 1 + 0.3 * efficiencyScore,
    reinforcementMultiplier: 1 + 0.22 * efficiencyScore,
    combatMultiplier: 1 + 0.1 * efficiencyScore,
    activeFactories,
    totalCityLevels,
  };
}

export function militaryProfile(player: MilitaryPlayerLike): MilitaryProfile {
  const levels = completedCityLevels(player);
  const highestCityLevel = levels.length === 0 ? 0 : Math.max(...levels);
  const totalCityLevels = levels.reduce((sum, level) => sum + level, 0);
  let tierIndex = 0;
  for (let i = 1; i < MILITARY_TIERS.length; i++) {
    const candidate = MILITARY_TIERS[i];
    if (
      highestCityLevel >= candidate.minCityLevel &&
      totalCityLevels >= candidate.minTotalCityLevels
    ) {
      tierIndex = i;
    }
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

export function militaryQuality(player: MilitaryPlayerLike): MilitaryProfile {
  return militaryProfile(player);
}
`,
);

replaceOnce(
  "src/core/configuration/Config.ts",
  `import {
  militaryQuality,
  overextensionPenalties,
} from "../game/FortressBalance";`,
  `import {
  compactStateProfile,
  militaryQuality,
} from "../game/FortressBalance";`,
  "Config imports",
);
replaceOnce(
  "src/core/configuration/Config.ts",
  `      // Fortress: expansion creates logistics friction instead of a hidden combat bonus.
      const overextension = overextensionPenalties(gm, attacker);
      const largeAttackBonus = overextension.lossMultiplier;
      const largeAttackerSpeedBonus = overextension.speedCostMultiplier;

      const attackerQuality = militaryQuality(attacker).quality;
      const defenderQuality = militaryQuality(defender).quality;
      const qualityRatio = attackerQuality / Math.max(0.01, defenderQuality);`,
  `      // Territory is never penalized. Developed states gain a positive
      // logistics bonus from city and factory density.
      const attackerQuality =
        militaryQuality(attacker).quality *
        compactStateProfile(attacker).combatMultiplier;
      const defenderQuality =
        militaryQuality(defender).quality *
        compactStateProfile(defender).combatMultiplier;
      const qualityRatio = attackerQuality / Math.max(0.01, defenderQuality);`,
  "combat efficiency",
);
replaceOnce(
  "src/core/configuration/Config.ts",
  `        largeDefenderAttackDebuff *
        largeAttackBonus *
        traitorMod;`,
  `        largeDefenderAttackDebuff *
        traitorMod;`,
  "remove loss penalty",
);
replaceOnce(
  "src/core/configuration/Config.ts",
  `          speed *
          largeDefenderSpeedDebuff *
          largeAttackerSpeedBonus *
          (defender.isTraitor() ? this.traitorSpeedDebuff() : 1) /`,
  `          speed *
          largeDefenderSpeedDebuff *
          (defender.isTraitor() ? this.traitorSpeedDebuff() : 1) /`,
  "remove speed penalty",
);
replaceOnce(
  "src/core/configuration/Config.ts",
  `    return Math.min(player.troops() + toAdd, max) - player.troops();`,
  `    toAdd *= compactStateProfile(player).reinforcementMultiplier;

    return Math.min(player.troops() + toAdd, max) - player.troops();`,
  "reinforcement bonus",
);
replaceOnce(
  "src/core/configuration/Config.ts",
  `    return BigInt(Math.floor(Number(baseRate) * multiplier));`,
  `    const efficiency = compactStateProfile(player).economyMultiplier;
    return BigInt(Math.floor(Number(baseRate) * multiplier * efficiency));`,
  "economy bonus",
);
replaceOnce(
  "src/core/execution/PlayerExecution.ts",
  `      } else if (u.type() === UnitType.City) {
        const retainedLevel = Math.max(1, u.level() - 3);
        while (u.level() > retainedLevel) u.decreaseLevel(captor);
        captor.captureUnit(u);`,
  `      } else if (u.type() === UnitType.City) {
        // Conquered administration transfers partially and must be rebuilt.
        const retainedLevel = Math.max(1, Math.floor(u.level() / 2));
        while (u.level() > retainedLevel) u.decreaseLevel(captor);
        captor.captureUnit(u);`,
  "captured city integration",
);
replaceOnce(
  "src/client/hud/layers/ControlPanel.ts",
  `import { militaryProfile } from "../../../core/game/FortressBalance";`,
  `import {
  compactStateProfile,
  militaryProfile,
} from "../../../core/game/FortressBalance";`,
  "HUD import",
);
replaceOnce(
  "src/client/hud/layers/ControlPanel.ts",
  `  @state()
  private _trainingCapacity = 0;

  @state()
  private _goldGain: bigint | null = null;`,
  `  @state()
  private _trainingCapacity = 0;

  @state()
  private _developmentEfficiencyBonus = 0;

  @state()
  private _goldGain: bigint | null = null;`,
  "HUD state",
);
replaceOnce(
  "src/client/hud/layers/ControlPanel.ts",
  `    this._trainingCoverage = military.coverage;
    this._trainingCapacity = military.trainingCapacity;
    this.troopRate = config.troopIncreaseRate(player) * 10;`,
  `    this._trainingCoverage = military.coverage;
    this._trainingCapacity = military.trainingCapacity;
    this._developmentEfficiencyBonus = Math.round(
      (compactStateProfile(player).reinforcementMultiplier - 1) * 100,
    );
    this.troopRate = config.troopIncreaseRate(player) * 10;`,
  "HUD calculation",
);
replaceOnce(
  "src/client/hud/layers/ControlPanel.ts",
  `          <span class="text-sky-300/70 tabular-nums">\${Math.round(
            this._trainingCoverage * 100,
          )}%</span>
        </div>`,
  `          <span class="text-sky-300/70 tabular-nums">\${Math.round(
            this._trainingCoverage * 100,
          )}%</span>
          <span class="text-emerald-300/80 tabular-nums"
            >효율 +\${this._developmentEfficiencyBonus}%</span
          >
        </div>`,
  "desktop HUD efficiency",
);
replaceOnce(
  "src/client/hud/layers/ControlPanel.ts",
  `        <span class="shrink-0 tabular-nums text-sky-300/70"
          >\${Math.round(this._trainingCoverage * 100)}%</span
        >
      </div>`,
  `        <span class="shrink-0 tabular-nums text-sky-300/70"
          >훈련 \${Math.round(this._trainingCoverage * 100)}%</span
        >
        <span class="shrink-0 tabular-nums text-emerald-300/80"
          >효율 +\${this._developmentEfficiencyBonus}%</span
        >
      </div>`,
  "mobile HUD efficiency",
);

write(
  "tests/FortressBalance.test.ts",
  `import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { UnitType, type Player, type Unit } from "../src/core/game/Game";
import {
  compactStateProfile,
  militaryProfile,
} from "../src/core/game/FortressBalance";

function source(path: string): string {
  return fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
}
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
  factories?: number;
  troops?: number;
  attackTroops?: number[];
  embarkedTroops?: number[];
  tiles?: number;
}): Player {
  const cities = (options.cityLevels ?? []).map((level) =>
    unit(UnitType.City, level),
  );
  const factories = Array.from({ length: options.factories ?? 0 }, () =>
    unit(UnitType.Factory, 1),
  );
  const ships = (options.embarkedTroops ?? []).map((troops) =>
    unit(UnitType.TransportShip, 1, troops),
  );
  return {
    units: (type?: UnitType) => {
      if (type === UnitType.City) return cities;
      if (type === UnitType.Factory) return factories;
      if (type === UnitType.TransportShip) return ships;
      return [...cities, ...factories, ...ships];
    },
    troops: () => options.troops ?? 0,
    outgoingAttacks: () =>
      (options.attackTroops ?? []).map((troops) => ({ troops: () => troops })),
    numTilesOwned: () => options.tiles ?? 0,
  } as unknown as Player;
}

describe("Fortress military quality", () => {
  it("requires a developed city network for elite tiers", () => {
    expect(militaryProfile(player({ cityLevels: [7], troops: 700_000 })).label)
      .toBe("상비군");
    const network = militaryProfile(
      player({ cityLevels: [7, 3, 3], troops: 700_000 }),
    );
    expect(network.label).toBe("정예군");
    expect(network.quality).toBeCloseTo(1.7, 5);
  });
  it("dilutes quality across field armies and embarked troops", () => {
    const profile = militaryProfile(
      player({
        cityLevels: [7, 3, 3],
        troops: 2_000_000,
        attackTroops: [1_000_000],
        embarkedTroops: [1_000_000],
      }),
    );
    expect(profile.trainingCapacity).toBe(2_600_000);
    expect(profile.coverage).toBeCloseTo(0.65, 5);
    expect(profile.quality).toBeCloseTo(1.455, 5);
  });
});

describe("compact-state development efficiency", () => {
  it("never applies a negative territory multiplier", () => {
    const sparse = compactStateProfile(
      player({ cityLevels: [1], tiles: 100_000 }),
    );
    expect(sparse.economyMultiplier).toBeGreaterThanOrEqual(1);
    expect(sparse.reinforcementMultiplier).toBeGreaterThanOrEqual(1);
    expect(sparse.combatMultiplier).toBeGreaterThanOrEqual(1);
  });
  it("rewards compact development with the full bonus", () => {
    const compact = compactStateProfile(
      player({ cityLevels: [5, 3], factories: 1, tiles: 25_000 }),
    );
    expect(compact.efficiencyScore).toBe(1);
    expect(compact.economyMultiplier).toBeCloseTo(1.3, 5);
    expect(compact.reinforcementMultiplier).toBeCloseTo(1.22, 5);
    expect(compact.combatMultiplier).toBeCloseTo(1.1, 5);
  });
  it("lets an expanded state regain efficiency through investment", () => {
    const sparse = compactStateProfile(
      player({ cityLevels: [3], tiles: 80_000 }),
    );
    const developed = compactStateProfile(
      player({ cityLevels: [9, 7, 5], factories: 3, tiles: 80_000 }),
    );
    expect(developed.efficiencyScore).toBeGreaterThan(sparse.efficiencyScore);
    expect(developed.reinforcementMultiplier).toBeCloseTo(1.22, 5);
  });
});

describe("combat integration", () => {
  it("uses development bonuses instead of map-share penalties", () => {
    const config = source("src/core/configuration/Config.ts");
    expect(config).toContain("compactStateProfile(attacker).combatMultiplier");
    expect(config).toContain("compactStateProfile(player).reinforcementMultiplier");
    expect(config).toContain("compactStateProfile(player).economyMultiplier");
    expect(config).not.toContain("overextensionPenalties");
  });
  it("keeps mobile attacks direct and owned-land menus intact", () => {
    const touch = source("src/client/controllers/WarshipSelectionController.ts");
    expect(touch).toContain("const isOwnedByMe");
    expect(touch).toContain("? new ContextMenuEvent(event.x, event.y)");
    expect(touch).toContain(": new MouseUpEvent(event.x, event.y)");
    expect(source("src/client/InputHandler.ts")).toContain(
      "private readonly LONG_PRESS_MS = 500",
    );
  });
  it("renders persistent SAM and dual nuclear ranges", () => {
    expect(source("src/client/hud/layers/UnitDisplay.ts")).toContain(
      "this.uiState.ghostStructure === null",
    );
    expect(source("src/client/render/types/Renderer.ts")).toContain(
      "innerRangeRadius?: number",
    );
    expect(source("src/client/controllers/BuildPreviewController.ts")).toContain(
      "innerRangeRadius = magnitude.inner",
    );
    expect(source("src/client/render/gl/passes/RangeCirclePass.ts")).toContain(
      "this.drawCircle(this.innerRadius",
    );
  });
  it("adds transport survivability, reloads and escort priority", () => {
    const config = source("src/core/configuration/Config.ts");
    const warship = source("src/core/execution/WarshipExecution.ts");
    expect(config).toContain("maxHealth: 600");
    expect(warship).toContain(
      "type === UnitType.Warship ? 0 : type === UnitType.TransportShip ? 1 : 2",
    );
    expect(warship).toContain("this.lastShellAttack = this.mg.ticks()");
    expect(warship).not.toContain(
      "Warships don't need to reload when attacking transport ships",
    );
  });
});
`,
);

console.log("Applied compact-state development balance.");
