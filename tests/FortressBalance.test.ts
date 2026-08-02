import fs from "node:fs";
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
