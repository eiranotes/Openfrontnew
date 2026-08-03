import fs from "node:fs";
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
