import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Config } from "../src/core/configuration/Config";
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  Player,
  PlayerType,
  Unit,
  UnitType,
} from "../src/core/game/Game";
import { UserSettings } from "../src/core/game/UserSettings";
import { GameConfig } from "../src/core/Schemas";

function config(): Config {
  const gameConfig: GameConfig = {
    gameMap: GameMapType.Asia,
    gameMapSize: GameMapSize.Normal,
    gameMode: GameMode.FFA,
    gameType: GameType.Singleplayer,
    difficulty: Difficulty.Medium,
    nations: "default",
    donateGold: false,
    donateTroops: false,
    bots: 0,
    infiniteGold: false,
    infiniteTroops: false,
    instantBuild: false,
    disableNavMesh: false,
    randomSpawn: false,
  };
  return new Config(gameConfig, new UserSettings(), false);
}

function unit(type: UnitType, level: number): Unit {
  return {
    type: () => type,
    level: () => level,
    troops: () => 0,
    isActive: () => true,
    isUnderConstruction: () => false,
  } as unknown as Unit;
}

function player(options: {
  type?: PlayerType;
  gold?: bigint;
  cityLevels?: number[];
  factoryLevels?: number[];
  portLevels?: number[];
  tiles?: number;
  owned?: Partial<Record<UnitType, number>>;
  constructed?: Partial<Record<UnitType, number>>;
} = {}): Player {
  const unitsByType = new Map<UnitType, Unit[]>([
    [
      UnitType.City,
      (options.cityLevels ?? []).map((level) => unit(UnitType.City, level)),
    ],
    [
      UnitType.Factory,
      (options.factoryLevels ?? []).map((level) =>
        unit(UnitType.Factory, level),
      ),
    ],
    [
      UnitType.Port,
      (options.portLevels ?? []).map((level) => unit(UnitType.Port, level)),
    ],
    [UnitType.TransportShip, []],
  ]);
  return {
    type: () => options.type ?? PlayerType.Human,
    gold: () => options.gold ?? 0n,
    isLobbyCreator: () => false,
    units: (type?: UnitType) =>
      type === undefined
        ? [...unitsByType.values()].flat()
        : (unitsByType.get(type) ?? []),
    outgoingAttacks: () => [],
    troops: () => 0,
    numTilesOwned: () => options.tiles ?? 0,
    unitsOwned: (type: UnitType) => options.owned?.[type] ?? 0,
    unitsConstructed: (type: UnitType) => options.constructed?.[type] ?? 0,
  } as unknown as Player;
}

describe("Fortress structure roles and prices", () => {
  it("separates factory and port cost escalation", () => {
    const cfg = config();
    const industrial = player({
      owned: { [UnitType.Factory]: 2, [UnitType.Port]: 0 },
      constructed: { [UnitType.Factory]: 2, [UnitType.Port]: 0 },
    });
    expect(cfg.unitInfo(UnitType.Factory).cost({} as never, industrial)).toBe(
      500_000n,
    );
    expect(cfg.unitInfo(UnitType.Port).cost({} as never, industrial)).toBe(
      125_000n,
    );

    const maritime = player({
      owned: { [UnitType.Factory]: 0, [UnitType.Port]: 2 },
      constructed: { [UnitType.Factory]: 0, [UnitType.Port]: 2 },
    });
    expect(cfg.unitInfo(UnitType.Factory).cost({} as never, maritime)).toBe(
      125_000n,
    );
    expect(cfg.unitInfo(UnitType.Port).cost({} as never, maritime)).toBe(
      500_000n,
    );
  });
});

describe("Fortress commercial income", () => {
  it("keeps undeveloped train income unchanged", () => {
    expect(config().trainGold("self", 0, player())).toBe(10_000n);
  });

  it("applies the bounded commercial multiplier to trains and ships", () => {
    const cfg = config();
    const developed = player({
      cityLevels: [5],
      factoryLevels: [1],
      portLevels: [2],
      tiles: 25_000,
    });
    expect(cfg.trainGold("self", 0, developed)).toBe(10_800n);

    const baseTrade = cfg.tradeShipGold(400, player());
    const developedTrade = cfg.tradeShipGold(400, developed);
    expect(Number(developedTrade) / Number(baseTrade)).toBeCloseTo(1.08, 3);
  });
});

describe("Fortress conquest economy", () => {
  it("reports the transferred amount instead of the defeated treasury", () => {
    const gameImpl = fs.readFileSync(
      path.resolve(process.cwd(), "src/core/game/GameImpl.ts"),
      "utf8",
    );
    expect(gameImpl).toContain(
      "conqueror.id(),\n        goldCaptured,",
    );
  });

  it("captures the same thirty-five percent share from every player class", () => {
    const cfg = config();
    for (const type of [PlayerType.Human, PlayerType.Bot, PlayerType.Nation]) {
      expect(cfg.conquerGoldAmount(player({ type, gold: 10_000n }))).toBe(
        3_500n,
      );
    }
  });
});
