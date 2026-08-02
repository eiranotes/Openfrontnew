import { within } from "../Util";
import { UnitType, type Game } from "./Game";

export const TRAINING_CAPACITY_PER_CITY_LEVEL = 300_000;
export const MAX_TROOPS_PER_CITY_LEVEL = 250_000;
export const ADMINISTRATIVE_CAPACITY_PER_CITY_LEVEL = 6_000;
export const CITY_GOLD_FACTOR_PER_TICK = 10;
export const CITY_GOLD_LEVEL_CAP = 9;
export const CITY_COST_CAP = 1_200_000;

export const MILITARY_TIERS = [
  { minCityLevel: 0, label: "징집군", glyph: "Ⅰ", quality: 1.0 },
  { minCityLevel: 3, label: "훈련군", glyph: "Ⅱ", quality: 1.2 },
  { minCityLevel: 5, label: "상비군", glyph: "★", quality: 1.45 },
  { minCityLevel: 7, label: "정예군", glyph: "★★", quality: 1.7 },
  { minCityLevel: 9, label: "근위군", glyph: "♛", quality: 2.0 },
] as const;

export type MilitaryTierDefinition = (typeof MILITARY_TIERS)[number];
export type TrainingCoverageStatus =
  | "완전 훈련"
  | "부분 훈련"
  | "훈련 부족"
  | "심각한 훈련 부족";

export interface MilitaryProfile {
  tier: number;
  label: string;
  glyph: string;
  maxQuality: number;
  quality: number;
  trainingCapacity: number;
  trainedManpower: number;
  totalManpower: number;
  coverage: number;
  coverageStatus: TrainingCoverageStatus;
  highestCityLevel: number;
  totalCityLevels: number;
  nextTier: MilitaryTierDefinition | null;
  cityLevelsToNextTier: number;
}

export interface FortressEconomyProfile {
  totalCityLevels: number;
  cityBaseGoldPerTick: number;
  administrativeCapacity: number;
  administrativeEfficiency: number;
  cityGoldPerTick: number;
  cityGoldPerSecond: number;
}

export interface CityUpgradePreview {
  currentLevel: number;
  nextLevel: number;
  nextTotalCityLevel: number;
  cost: number;
  currentCityBaseGoldPerSecond: number;
  nextCityBaseGoldPerSecond: number;
  currentCityNetworkGoldPerSecond: number;
  nextCityNetworkGoldPerSecond: number;
  currentTrainingCapacity: number;
  nextTrainingCapacity: number;
  currentMaxTroopsFromCities: number;
  nextMaxTroopsFromCities: number;
  currentAdministrativeCapacity: number;
  nextAdministrativeCapacity: number;
  currentAdministrativeEfficiency: number;
  nextAdministrativeEfficiency: number;
  currentTier: MilitaryTierDefinition;
  nextTier: MilitaryTierDefinition;
  followingTier: MilitaryTierDefinition | null;
  levelsToFollowingTier: number;
  unlocksTier: boolean;
}

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

export function completedCityLevels(player: MilitaryPlayerLike): number[] {
  return player
    .units(UnitType.City)
    .filter((city) => city.isActive() && !city.isUnderConstruction())
    .map((city) => Math.max(1, city.level()));
}

export function militaryTierForHighestCity(
  highestCityLevel: number,
): MilitaryTierDefinition {
  let tier: MilitaryTierDefinition = MILITARY_TIERS[0];
  for (const candidate of MILITARY_TIERS) {
    if (highestCityLevel >= candidate.minCityLevel) tier = candidate;
  }
  return tier;
}

export function nextMilitaryTier(
  highestCityLevel: number,
): MilitaryTierDefinition | null {
  return (
    MILITARY_TIERS.find(
      (candidate) => candidate.minCityLevel > highestCityLevel,
    ) ?? null
  );
}

export function trainingStatus(coverage: number): TrainingCoverageStatus {
  if (coverage >= 0.9) return "완전 훈련";
  if (coverage >= 0.6) return "부분 훈련";
  if (coverage >= 0.3) return "훈련 부족";
  return "심각한 훈련 부족";
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

export function militaryProfile(player: MilitaryPlayerLike): MilitaryProfile {
  const levels = completedCityLevels(player);
  const highestCityLevel = levels.length === 0 ? 0 : Math.max(...levels);
  const totalCityLevels = levels.reduce((sum, level) => sum + level, 0);
  const tierDefinition = militaryTierForHighestCity(highestCityLevel);
  const tier = MILITARY_TIERS.indexOf(tierDefinition);
  const trainingCapacity =
    totalCityLevels * TRAINING_CAPACITY_PER_CITY_LEVEL;
  const totalManpower = totalMilitaryManpower(player);
  const coverage =
    totalManpower <= 0 ? 1 : Math.min(1, trainingCapacity / totalManpower);
  const quality = 1 + (tierDefinition.quality - 1) * coverage;
  const nextTier = nextMilitaryTier(highestCityLevel);

  return {
    tier,
    label: tierDefinition.label,
    glyph: tierDefinition.glyph,
    maxQuality: tierDefinition.quality,
    quality,
    trainingCapacity,
    trainedManpower: Math.min(totalManpower, trainingCapacity),
    totalManpower,
    coverage,
    coverageStatus: trainingStatus(coverage),
    highestCityLevel,
    totalCityLevels,
    nextTier,
    cityLevelsToNextTier: nextTier
      ? Math.max(0, nextTier.minCityLevel - highestCityLevel)
      : 0,
  };
}

export function militaryQuality(player: MilitaryPlayerLike): MilitaryProfile {
  return militaryProfile(player);
}

export function cityBaseGoldPerTick(level: number): number {
  if (level <= 0) return 0;
  const normalizedLevel = within(Math.floor(level), 1, CITY_GOLD_LEVEL_CAP);
  return CITY_GOLD_FACTOR_PER_TICK * Math.pow(normalizedLevel + 1, 2);
}

export function cityLevelCost(nextTotalCityLevel: number): number {
  const level = Math.max(1, Math.floor(nextTotalCityLevel));
  return Math.min(CITY_COST_CAP, 100_000 + 20_000 * level * level);
}

export function administrativeCapacity(totalCityLevels: number): number {
  return (
    Math.max(0, Math.floor(totalCityLevels)) *
    ADMINISTRATIVE_CAPACITY_PER_CITY_LEVEL
  );
}

export function administrativeEfficiency(
  totalCityLevels: number,
  ownedTiles: number,
): number {
  const capacity = administrativeCapacity(totalCityLevels);
  const territory = Math.max(1, ownedTiles);
  if (capacity <= 0) return 0.4;
  return within(Math.sqrt(capacity / territory), 0.4, 1.2);
}

export function fortressEconomyProfile(
  player: MilitaryPlayerLike,
): FortressEconomyProfile {
  const levels = completedCityLevels(player);
  const totalCityLevels = levels.reduce((sum, level) => sum + level, 0);
  const cityBaseGold = levels.reduce(
    (sum, level) => sum + cityBaseGoldPerTick(level),
    0,
  );
  const adminEfficiency = administrativeEfficiency(
    totalCityLevels,
    player.numTilesOwned(),
  );
  const cityGoldPerTick = cityBaseGold * adminEfficiency;

  return {
    totalCityLevels,
    cityBaseGoldPerTick: cityBaseGold,
    administrativeCapacity: administrativeCapacity(totalCityLevels),
    administrativeEfficiency: adminEfficiency,
    cityGoldPerTick,
    cityGoldPerSecond: cityGoldPerTick * 10,
  };
}

export function cityUpgradePreview(
  player: MilitaryPlayerLike,
  currentLevel: number,
): CityUpgradePreview {
  const currentProfile = militaryProfile(player);
  const currentEconomy = fortressEconomyProfile(player);
  const nextLevel = Math.max(1, Math.floor(currentLevel) + 1);
  const nextTotalCityLevel = currentProfile.totalCityLevels + 1;
  const ownedTiles = player.numTilesOwned();
  const currentCityBaseGoldPerSecond =
    currentLevel <= 0 ? 0 : cityBaseGoldPerTick(currentLevel) * 10;
  const nextCityBaseGoldPerSecond = cityBaseGoldPerTick(nextLevel) * 10;
  const nextCityBaseNetworkPerTick =
    currentEconomy.cityBaseGoldPerTick -
    (currentLevel <= 0 ? 0 : cityBaseGoldPerTick(currentLevel)) +
    cityBaseGoldPerTick(nextLevel);
  const nextEfficiency = administrativeEfficiency(nextTotalCityLevel, ownedTiles);
  const currentTier = militaryTierForHighestCity(
    currentProfile.highestCityLevel,
  );
  const nextHighestCity = Math.max(currentProfile.highestCityLevel, nextLevel);
  const upgradedTier = militaryTierForHighestCity(nextHighestCity);
  const followingTier = nextMilitaryTier(nextHighestCity);

  return {
    currentLevel,
    nextLevel,
    nextTotalCityLevel,
    cost: cityLevelCost(nextTotalCityLevel),
    currentCityBaseGoldPerSecond,
    nextCityBaseGoldPerSecond,
    currentCityNetworkGoldPerSecond: currentEconomy.cityGoldPerSecond,
    nextCityNetworkGoldPerSecond:
      nextCityBaseNetworkPerTick * nextEfficiency * 10,
    currentTrainingCapacity: currentProfile.trainingCapacity,
    nextTrainingCapacity:
      nextTotalCityLevel * TRAINING_CAPACITY_PER_CITY_LEVEL,
    currentMaxTroopsFromCities:
      currentProfile.totalCityLevels * MAX_TROOPS_PER_CITY_LEVEL,
    nextMaxTroopsFromCities:
      nextTotalCityLevel * MAX_TROOPS_PER_CITY_LEVEL,
    currentAdministrativeCapacity: currentEconomy.administrativeCapacity,
    nextAdministrativeCapacity: administrativeCapacity(nextTotalCityLevel),
    currentAdministrativeEfficiency: currentEconomy.administrativeEfficiency,
    nextAdministrativeEfficiency: nextEfficiency,
    currentTier,
    nextTier: upgradedTier,
    followingTier,
    levelsToFollowingTier: followingTier
      ? Math.max(0, followingTier.minCityLevel - nextHighestCity)
      : 0,
    unlocksTier: upgradedTier.quality > currentTier.quality,
  };
}

export interface OverextensionPenalties {
  share: number;
  pressure: number;
  lossMultiplier: number;
  speedCostMultiplier: number;
}

export function overextensionPenalties(
  game: Pick<Game, "numLandTiles">,
  player: MilitaryPlayerLike,
): OverextensionPenalties {
  const share = player.numTilesOwned() / Math.max(1, game.numLandTiles());
  const pressure = within((share - 0.2) / 0.3, 0, 1);
  return {
    share,
    pressure,
    lossMultiplier: 1 + 0.35 * pressure,
    speedCostMultiplier: 1 + 0.45 * pressure,
  };
}
