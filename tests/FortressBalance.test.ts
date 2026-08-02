import { describe, expect, it } from "vitest";
import { UnitType, type Player, type Unit } from "../src/core/game/Game";
import {
  administrativeEfficiency,
  cityBaseGoldPerTick,
  cityLevelCost,
  cityUpgradePreview,
  fortressEconomyProfile,
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
  it("trains 300,000 troops for every completed city level", () => {
    const profile = militaryProfile(
      player({ cityLevels: [7, 3], troops: 700_000 }),
    );
    expect(profile.label).toBe("정예군");
    expect(profile.trainingCapacity).toBe(3_000_000);
    expect(profile.quality).toBeCloseTo(1.7, 5);
    expect(profile.coverageStatus).toBe("완전 훈련");
  });

  it("dilutes quality across home, field, and embarked manpower", () => {
    const profile = militaryProfile(
      player({
        cityLevels: [7, 3],
        troops: 2_000_000,
        attackTroops: [2_000_000],
        embarkedTroops: [2_000_000],
      }),
    );
    expect(profile.coverage).toBeCloseTo(0.5, 5);
    expect(profile.quality).toBeCloseTo(1.35, 5);
    expect(profile.coverageStatus).toBe("훈련 부족");
  });

  it("reports the next tier requirement", () => {
    const profile = militaryProfile(
      player({ cityLevels: [3, 1], troops: 400_000 }),
    );
    expect(profile.label).toBe("훈련군");
    expect(profile.nextTier?.label).toBe("상비군");
    expect(profile.cityLevelsToNextTier).toBe(2);
  });

  it("penalizes empires after twenty percent map share", () => {
    const game = { numLandTiles: () => 100_000 };
    const compact = overextensionPenalties(game, player({ tiles: 20_000 }));
    const empire = overextensionPenalties(game, player({ tiles: 50_000 }));
    expect(compact.lossMultiplier).toBe(1);
    expect(empire.lossMultiplier).toBeCloseTo(1.35, 5);
    expect(empire.speedCostMultiplier).toBeCloseTo(1.45, 5);
  });
});

describe("Fortress city economy", () => {
  it("uses the intended quadratic city gold curve", () => {
    expect(cityBaseGoldPerTick(1)).toBe(40);
    expect(cityBaseGoldPerTick(5)).toBe(360);
    expect(cityBaseGoldPerTick(9)).toBe(1_000);
    expect(cityBaseGoldPerTick(12)).toBe(1_000);
  });

  it("rewards concentrated development over level-one city spam", () => {
    const concentrated = fortressEconomyProfile(
      player({ cityLevels: [5], tiles: 30_000 }),
    );
    const spread = fortressEconomyProfile(
      player({ cityLevels: [1, 1, 1, 1, 1], tiles: 30_000 }),
    );
    expect(concentrated.administrativeEfficiency).toBeCloseTo(1, 5);
    expect(spread.administrativeEfficiency).toBeCloseTo(1, 5);
    expect(concentrated.cityGoldPerSecond).toBe(3_600);
    expect(spread.cityGoldPerSecond).toBe(2_000);
  });

  it("applies administrative density limits", () => {
    expect(administrativeEfficiency(5, 8_000)).toBeCloseTo(1.2, 5);
    expect(administrativeEfficiency(5, 30_000)).toBeCloseTo(1, 5);
    expect(administrativeEfficiency(5, 100_000)).toBeCloseTo(
      Math.sqrt(0.3),
      5,
    );
    expect(administrativeEfficiency(1, 100_000)).toBe(0.4);
  });

  it("uses the capped total-city-level cost curve", () => {
    expect(cityLevelCost(1)).toBe(120_000);
    expect(cityLevelCost(3)).toBe(280_000);
    expect(cityLevelCost(7)).toBe(1_080_000);
    expect(cityLevelCost(8)).toBe(1_200_000);
    expect(cityLevelCost(20)).toBe(1_200_000);
  });

  it("reaches the intended contained-city progression windows", () => {
    let cumulativeSeconds = 0;
    const milestones = new Map<number, number>();
    for (let currentLevel = 0; currentLevel < 5; currentLevel++) {
      const incomePerSecond =
        (100 +
          cityBaseGoldPerTick(currentLevel) *
            administrativeEfficiency(currentLevel, 8_000)) *
        10;
      cumulativeSeconds += cityLevelCost(currentLevel + 1) / incomePerSecond;
      milestones.set(currentLevel + 1, cumulativeSeconds);
    }

    expect(milestones.get(3)! / 60).toBeGreaterThanOrEqual(5);
    expect(milestones.get(3)! / 60).toBeLessThanOrEqual(7);
    expect(milestones.get(5)! / 60).toBeGreaterThanOrEqual(10);
    expect(milestones.get(5)! / 60).toBeLessThanOrEqual(13);
  });

  it("lets a contained professional army contest wider conscript numbers", () => {
    const developed = militaryProfile(
      player({ cityLevels: [5], troops: 800_000, tiles: 8_000 }),
    );
    const wide = militaryProfile(
      player({ cityLevels: [2], troops: 1_050_000, tiles: 50_000 }),
    );
    const developedPower = developed.totalManpower * developed.quality;
    const widePower = wide.totalManpower * wide.quality;

    expect(developed.label).toBe("상비군");
    expect(wide.label).toBe("징집군");
    expect(developedPower).toBeGreaterThan(widePower);
    expect(developedPower / widePower).toBeLessThan(1.2);
  });

  it("previews economy, capacity, and tier changes before upgrading", () => {
    const p = player({ cityLevels: [4], troops: 900_000, tiles: 24_000 });
    const preview = cityUpgradePreview(p, 4);
    expect(preview.cost).toBe(600_000);
    expect(preview.currentCityBaseGoldPerSecond).toBe(2_500);
    expect(preview.nextCityBaseGoldPerSecond).toBe(3_600);
    expect(preview.currentTrainingCapacity).toBe(1_200_000);
    expect(preview.nextTrainingCapacity).toBe(1_500_000);
    expect(preview.currentMaxTroopsFromCities).toBe(1_000_000);
    expect(preview.nextMaxTroopsFromCities).toBe(1_250_000);
    expect(preview.currentAdministrativeCapacity).toBe(24_000);
    expect(preview.nextAdministrativeCapacity).toBe(30_000);
    expect(preview.currentTier.label).toBe("훈련군");
    expect(preview.nextTier.label).toBe("상비군");
    expect(preview.unlocksTier).toBe(true);
  });
});
