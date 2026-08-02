import { UnitType } from "./Game";
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
