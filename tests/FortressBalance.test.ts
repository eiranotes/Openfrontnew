import { describe, expect, it } from "vitest";
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
