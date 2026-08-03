import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const markerChecks = [
  [
    "src/core/game/FortressBalance.ts",
    "BASE_DEVELOPMENT_REQUIREMENT",
  ],
  [
    "src/core/game/FortressBalance.ts",
    "developmentEfficiencyScore",
  ],
  [
    "src/core/configuration/Config.ts",
    "compactStateProfile(player).domesticIncomeMultiplier",
  ],
  [
    "src/core/configuration/Config.ts",
    "compactStateProfile(attacker).logisticsMultiplier",
  ],
  [
    "src/client/hud/layers/ControlPanel.ts",
    "_developmentRequirement",
  ],
  [
    "tests/FortressBalance.test.ts",
    "investment-backed compact development",
  ],
];
const forbiddenChecks = [
  ["src/core/configuration/Config.ts", "DEFENSE_DEBUFF_MIDPOINT"],
  ["src/core/configuration/Config.ts", "DEFENSE_DEBUFF_DECAY_RATE"],
  ["src/core/configuration/Config.ts", "largeDefenderSpeedDebuff"],
  ["src/core/configuration/Config.ts", "largeDefenderAttackDebuff"],
  ["src/core/configuration/Config.ts", ".combatMultiplier"],
  ["src/core/game/FortressBalance.ts", "economyMultiplier"],
  ["src/core/game/FortressBalance.ts", "combatMultiplier"],
];

function absolute(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(absolute(relativePath), "utf8");
}

function write(relativePath, content) {
  fs.writeFileSync(absolute(relativePath), content);
}

function contains(relativePath, marker) {
  const file = absolute(relativePath);
  return fs.existsSync(file) && fs.readFileSync(file, "utf8").includes(marker);
}

function replaceOnce(content, before, after, label) {
  if (content.includes(after)) return content;
  if (!content.includes(before)) {
    throw new Error(`Fortress P0 anchor missing: ${label}`);
  }
  return content.replace(before, after);
}

function isMaterialized() {
  return (
    markerChecks.every(([relativePath, marker]) =>
      contains(relativePath, marker),
    ) &&
    forbiddenChecks.every(
      ([relativePath, marker]) => !contains(relativePath, marker),
    )
  );
}

if (isMaterialized()) {
  console.log("Fortress P0 balance pass is already materialized.");
  process.exit(0);
}

const fortressBalanceSource = `import { UnitType } from "./Game";
import { within } from "../Util";

export const TRAINING_CAPACITY_PER_CITY_LEVEL = 200_000;

export const BASE_DEVELOPMENT_REQUIREMENT = 12_000;
export const DEVELOPMENT_REQUIREMENT_PER_TILE = 0.55;
export const DEVELOPMENT_INVESTMENT_PER_CITY_LEVEL = 3_000;
export const DEVELOPMENT_INVESTMENT_PER_FACTORY_LEVEL = 7_000;
export const DEVELOPMENT_INVESTMENT_PER_PORT_LEVEL = 3_500;
export const DEVELOPMENT_RATIO_START = 0.2;
export const DEVELOPMENT_RATIO_FULL = 0.95;

export const MAX_DOMESTIC_INCOME_BONUS = 0.2;
export const MAX_COMMERCIAL_INCOME_BONUS = 0.08;
export const MAX_REINFORCEMENT_BONUS = 0.15;
export const MAX_LOGISTICS_BONUS = 0.05;

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
  developmentInvestment: number;
  developmentRequirement: number;
  investmentRatio: number;
  efficiencyScore: number;
  domesticIncomeMultiplier: number;
  commercialIncomeMultiplier: number;
  reinforcementMultiplier: number;
  logisticsMultiplier: number;
  totalCityLevels: number;
  totalFactoryLevels: number;
  totalPortLevels: number;
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

function completedLevels(
  player: MilitaryPlayerLike,
  type: UnitType,
): number[] {
  return completedUnits(player, type).map((unit) => unit.level());
}

function totalLevels(player: MilitaryPlayerLike, type: UnitType): number {
  return completedLevels(player, type).reduce((sum, level) => sum + level, 0);
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

export function developmentEfficiencyScore(investmentRatio: number): number {
  const normalized = within(
    (investmentRatio - DEVELOPMENT_RATIO_START) /
      (DEVELOPMENT_RATIO_FULL - DEVELOPMENT_RATIO_START),
    0,
    1,
  );
  return smoothstep(normalized);
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
  const totalCityLevels = totalLevels(player, UnitType.City);
  const totalFactoryLevels = totalLevels(player, UnitType.Factory);
  const totalPortLevels = totalLevels(player, UnitType.Port);
  const developmentInvestment =
    totalCityLevels * DEVELOPMENT_INVESTMENT_PER_CITY_LEVEL +
    totalFactoryLevels * DEVELOPMENT_INVESTMENT_PER_FACTORY_LEVEL +
    totalPortLevels * DEVELOPMENT_INVESTMENT_PER_PORT_LEVEL;
  const developmentRequirement =
    BASE_DEVELOPMENT_REQUIREMENT +
    Math.max(0, player.numTilesOwned()) * DEVELOPMENT_REQUIREMENT_PER_TILE;
  const investmentRatio =
    developmentInvestment / Math.max(1, developmentRequirement);
  const efficiencyScore = developmentEfficiencyScore(investmentRatio);

  return {
    developmentInvestment,
    developmentRequirement,
    investmentRatio,
    efficiencyScore,
    domesticIncomeMultiplier: 1 + MAX_DOMESTIC_INCOME_BONUS * efficiencyScore,
    commercialIncomeMultiplier:
      1 + MAX_COMMERCIAL_INCOME_BONUS * efficiencyScore,
    reinforcementMultiplier:
      1 + MAX_REINFORCEMENT_BONUS * efficiencyScore,
    logisticsMultiplier: 1 + MAX_LOGISTICS_BONUS * efficiencyScore,
    totalCityLevels,
    totalFactoryLevels,
    totalPortLevels,
  };
}

export function militaryProfile(player: MilitaryPlayerLike): MilitaryProfile {
  const levels = completedLevels(player, UnitType.City);
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
`;

const fortressTestSource = `import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { UnitType, type Player, type Unit } from "../src/core/game/Game";
import {
  compactStateProfile,
  developmentEfficiencyScore,
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
  factoryLevels?: number[];
  portLevels?: number[];
  troops?: number;
  attackTroops?: number[];
  embarkedTroops?: number[];
  tiles?: number;
}): Player {
  const cities = (options.cityLevels ?? []).map((level) =>
    unit(UnitType.City, level),
  );
  const factories = (options.factoryLevels ?? []).map((level) =>
    unit(UnitType.Factory, level),
  );
  const ports = (options.portLevels ?? []).map((level) =>
    unit(UnitType.Port, level),
  );
  const ships = (options.embarkedTroops ?? []).map((troops) =>
    unit(UnitType.TransportShip, 1, troops),
  );
  return {
    units: (type?: UnitType) => {
      if (type === UnitType.City) return cities;
      if (type === UnitType.Factory) return factories;
      if (type === UnitType.Port) return ports;
      if (type === UnitType.TransportShip) return ships;
      return [...cities, ...factories, ...ports, ...ships];
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

describe("investment-backed compact development", () => {
  it("grants no development bonus before structures are completed", () => {
    for (const tiles of [5_000, 25_000, 100_000]) {
      const profile = compactStateProfile(player({ tiles }));
      expect(profile.developmentInvestment).toBe(0);
      expect(profile.efficiencyScore).toBe(0);
      expect(profile.domesticIncomeMultiplier).toBe(1);
      expect(profile.commercialIncomeMultiplier).toBe(1);
      expect(profile.reinforcementMultiplier).toBe(1);
      expect(profile.logisticsMultiplier).toBe(1);
    }
  });

  it("uses a smooth investment band instead of a binary threshold", () => {
    expect(developmentEfficiencyScore(0.19)).toBe(0);
    expect(developmentEfficiencyScore(0.575)).toBeCloseTo(0.5, 5);
    expect(developmentEfficiencyScore(0.96)).toBe(1);
  });

  it("counts city, factory and port levels as distinct investment", () => {
    const profile = compactStateProfile(
      player({
        cityLevels: [3],
        factoryLevels: [2],
        portLevels: [2],
        tiles: 25_000,
      }),
    );
    expect(profile.totalCityLevels).toBe(3);
    expect(profile.totalFactoryLevels).toBe(2);
    expect(profile.totalPortLevels).toBe(2);
    expect(profile.developmentInvestment).toBe(30_000);
    expect(profile.developmentRequirement).toBe(25_750);
    expect(profile.efficiencyScore).toBe(1);
  });

  it("requires visible investment before a compact state reaches full benefit", () => {
    const lightlyDeveloped = compactStateProfile(
      player({ cityLevels: [3], tiles: 25_000 }),
    );
    const developed = compactStateProfile(
      player({ cityLevels: [5], factoryLevels: [1], tiles: 25_000 }),
    );
    expect(lightlyDeveloped.efficiencyScore).toBeCloseTo(0.103379, 5);
    expect(developed.efficiencyScore).toBeCloseTo(0.955371, 5);
    expect(developed.domesticIncomeMultiplier).toBeCloseTo(1.191074, 5);
    expect(developed.reinforcementMultiplier).toBeCloseTo(1.143306, 5);
    expect(developed.logisticsMultiplier).toBeCloseTo(1.047769, 5);
  });

  it("lets an expanded state regain efficiency through proportionate investment", () => {
    const sparse = compactStateProfile(
      player({ cityLevels: [3], tiles: 80_000 }),
    );
    const developed = compactStateProfile(
      player({ cityLevels: [9, 4], factoryLevels: [2], tiles: 80_000 }),
    );
    expect(sparse.efficiencyScore).toBe(0);
    expect(developed.efficiencyScore).toBeCloseTo(0.999932, 5);
    expect(developed.reinforcementMultiplier).toBeCloseTo(1.14999, 5);
  });
});

describe("combat integration", () => {
  it("removes every direct territory-size combat debuff", () => {
    const config = source("src/core/configuration/Config.ts");
    expect(config).not.toContain("DEFENSE_DEBUFF_MIDPOINT");
    expect(config).not.toContain("DEFENSE_DEBUFF_DECAY_RATE");
    expect(config).not.toContain("largeDefenderSpeedDebuff");
    expect(config).not.toContain("largeDefenderAttackDebuff");
    expect(config).not.toContain("combatMultiplier");
    expect(config).toContain("compactStateProfile(attacker).logisticsMultiplier");
  });

  it("integrates the bounded domestic and reinforcement multipliers", () => {
    const config = source("src/core/configuration/Config.ts");
    expect(config).toContain("compactStateProfile(player).reinforcementMultiplier");
    expect(config).toContain("compactStateProfile(player).domesticIncomeMultiplier");
    expect(config).not.toContain("overextensionPenalties");
  });

  it("keeps mobile attacks direct and owned-land menus intact", () => {
    const touch = source("src/client/controllers/WarshipSelectionController.ts");
    expect(touch).toContain("this.game.hasOwner(clickRef)");
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
`;

write("src/core/game/FortressBalance.ts", fortressBalanceSource);
write("tests/FortressBalance.test.ts", fortressTestSource);

let config = read("src/core/configuration/Config.ts");
config = config.replace(
  "const DEFENSE_DEBUFF_MIDPOINT = 150_000;\nconst DEFENSE_DEBUFF_DECAY_RATE = Math.LN2 / 50000;\n",
  "",
);
const oldAttackBlock = `    if (defender.isPlayer()) {
      const defenseSig =
        1 -
        sigmoid(
          defender.numTilesOwned(),
          DEFENSE_DEBUFF_DECAY_RATE,
          DEFENSE_DEBUFF_MIDPOINT,
        );

      const largeDefenderSpeedDebuff = 0.7 + 0.3 * defenseSig;
      const largeDefenderAttackDebuff = 0.7 + 0.3 * defenseSig;

      // Territory is never penalized. Developed states gain a positive
      // logistics bonus from city and factory density.
      const attackerQuality =
        militaryQuality(attacker).quality *
        compactStateProfile(attacker).combatMultiplier;
      const defenderQuality =
        militaryQuality(defender).quality *
        compactStateProfile(defender).combatMultiplier;
      const qualityRatio = attackerQuality / Math.max(0.01, defenderQuality);
      const exchangeModifier = within(Math.sqrt(qualityRatio), 0.72, 1.4);
      const speedQualityModifier = within(
        Math.pow(qualityRatio, 0.25),
        0.9,
        1.12,
      );

      const baseDefenderTroopLoss =
        defender.troops() / defender.numTilesOwned();
      const defenderTroopLoss =
        baseDefenderTroopLoss * exchangeModifier;
      const traitorMod = defender.isTraitor() ? this.traitorDefenseDebuff() : 1;
      const currentAttackerLoss =
        within(defender.troops() / attackTroops, 0.6, 2) *
        mag *
        0.8 *
        largeDefenderAttackDebuff *
        traitorMod;
      const altAttackerLoss =
        1.3 * baseDefenderTroopLoss * (mag / 100) * traitorMod;
      const attackerTroopLoss =
        (0.6 * currentAttackerLoss + 0.4 * altAttackerLoss) /
        exchangeModifier;

      return {
        attackerTroopLoss,
        defenderTroopLoss,
        tilesPerTickUsed:
          within(defender.troops() / (5 * attackTroops), 0.2, 1.5) *
          speed *
          largeDefenderSpeedDebuff *
          (defender.isTraitor() ? this.traitorSpeedDebuff() : 1) /
          speedQualityModifier,
      };
`;
const newAttackBlock = `    if (defender.isPlayer()) {
      // Territory size does not modify combat on its own. Military training
      // determines casualty exchange, while internal investment only improves
      // reinforcement and operational tempo through a small logistics bonus.
      const attackerQuality = militaryQuality(attacker).quality;
      const defenderQuality = militaryQuality(defender).quality;
      const qualityRatio = attackerQuality / Math.max(0.01, defenderQuality);
      const exchangeModifier = within(Math.sqrt(qualityRatio), 0.72, 1.4);
      const speedQualityModifier = within(
        Math.pow(qualityRatio, 0.25),
        0.9,
        1.12,
      );
      const logisticsMultiplier =
        compactStateProfile(attacker).logisticsMultiplier;

      const baseDefenderTroopLoss =
        defender.troops() / defender.numTilesOwned();
      const defenderTroopLoss =
        baseDefenderTroopLoss * exchangeModifier;
      const traitorMod = defender.isTraitor() ? this.traitorDefenseDebuff() : 1;
      const currentAttackerLoss =
        within(defender.troops() / attackTroops, 0.6, 2) *
        mag *
        0.8 *
        traitorMod;
      const altAttackerLoss =
        1.3 * baseDefenderTroopLoss * (mag / 100) * traitorMod;
      const attackerTroopLoss =
        (0.6 * currentAttackerLoss + 0.4 * altAttackerLoss) /
        exchangeModifier;

      return {
        attackerTroopLoss,
        defenderTroopLoss,
        tilesPerTickUsed:
          (within(defender.troops() / (5 * attackTroops), 0.2, 1.5) *
            speed *
            (defender.isTraitor() ? this.traitorSpeedDebuff() : 1)) /
          (speedQualityModifier * logisticsMultiplier),
      };
`;
config = replaceOnce(config, oldAttackBlock, newAttackBlock, "combat block");
config = replaceOnce(
  config,
  "const efficiency = compactStateProfile(player).economyMultiplier;",
  "const efficiency = compactStateProfile(player).domesticIncomeMultiplier;",
  "domestic income multiplier",
);
write("src/core/configuration/Config.ts", config);

let controlPanel = read("src/client/hud/layers/ControlPanel.ts");
controlPanel = replaceOnce(
  controlPanel,
  `  @state()
  private _developmentEfficiencyBonus = 0;
`,
  `  @state()
  private _developmentEfficiencyBonus = 0;

  @state()
  private _developmentInvestment = 0;

  @state()
  private _developmentRequirement = 0;
`,
  "development HUD state",
);
controlPanel = replaceOnce(
  controlPanel,
  `    this._developmentEfficiencyBonus = Math.round(
      (compactStateProfile(player).reinforcementMultiplier - 1) * 100,
    );
`,
  `    const development = compactStateProfile(player);
    this._developmentEfficiencyBonus = Math.round(
      (development.reinforcementMultiplier - 1) * 100,
    );
    this._developmentInvestment = development.developmentInvestment;
    this._developmentRequirement = development.developmentRequirement;
`,
  "development HUD refresh",
);
controlPanel = controlPanel.replaceAll(
  'title="훈련 수용량 ${renderTroops(this._trainingCapacity)}"',
  'title="훈련 수용량 ${renderTroops(this._trainingCapacity)} · 개발 ${renderNumber(this._developmentInvestment)} / ${renderNumber(this._developmentRequirement)}"',
);
controlPanel = controlPanel.replaceAll(
  ">효율 +${this._developmentEfficiencyBonus}%</span",
  ">개발 +${this._developmentEfficiencyBonus}%</span",
);
write("src/client/hud/layers/ControlPanel.ts", controlPanel);

for (const [relativePath, marker] of markerChecks) {
  if (!contains(relativePath, marker)) {
    throw new Error(`Fortress P0 marker missing: ${relativePath} (${marker})`);
  }
}
for (const [relativePath, marker] of forbiddenChecks) {
  if (contains(relativePath, marker)) {
    throw new Error(
      `Fortress P0 forbidden marker remains: ${relativePath} (${marker})`,
    );
  }
}

console.log(
  "Applied investment-backed development and removed territory-size combat debuffs.",
);
