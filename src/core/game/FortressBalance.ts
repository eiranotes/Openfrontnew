import { UnitType, type Game } from "./Game";
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

function completedCityLevels(player: MilitaryPlayerLike): number[] {
  return player
    .units(UnitType.City)
    .filter((city) => city.isActive() && !city.isUnderConstruction())
    .map((city) => city.level());
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

export function militaryQuality(player: MilitaryPlayerLike): MilitaryProfile {
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
  player: MilitaryPlayerLike,
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
