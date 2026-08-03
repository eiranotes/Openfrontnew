import { UnitType } from "./Game";
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
