import { describe, expect, it, vi } from "vitest";
import { PlayerPanel } from "../src/client/hud/layers/PlayerPanel";
import { GameView, PlayerView } from "../src/client/view";
import { SpawnExecution } from "../src/core/execution/SpawnExecution";
import {
  Game,
  Player,
  PlayerActions,
  PlayerInfo,
  PlayerProfile,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { TileRef } from "../src/core/game/GameMap";
import { SpatialQuery } from "../src/core/pathfinding/spatial/SpatialQuery";
import { createGame, L, W } from "./core/pathfinding/_fixtures";

function addPlayer(game: Game, tile: TileRef, id: string): Player {
  const info = new PlayerInfo(id, PlayerType.Human, null, `${id}_client`);
  game.addPlayer(info);
  game.addExecution(new SpawnExecution("game_id", info, tile));
  game.executeNextTick();
  game.executeNextTick();
  return game.player(info.id);
}

function buildLandingMap(): Game {
  const width = 26;
  const height = 18;
  const grid: string[] = new Array(width * height).fill(W);
  const inBox = (
    x: number,
    y: number,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
  ) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (inBox(x, y, 1, 5, 6, 11)) grid[y * width + x] = L;
      if (inBox(x, y, 10, 24, 1, 16)) grid[y * width + x] = L;
      if (inBox(x, y, 15, 20, 6, 11)) grid[y * width + x] = W;
    }
  }
  return createGame({ width, height, grid });
}

const actionsWithLanding = (): PlayerActions => ({
  canAttack: false,
  canSendEmojiAllPlayers: false,
  buildableUnits: [
    {
      type: UnitType.TransportShip,
      canBuild: 1 as TileRef,
      canUpgrade: false,
      cost: 0n,
      overlappingRailroads: [],
      ghostRailPaths: [],
    },
  ],
});

describe("landing operations", () => {
  it("searches a player's complete reachable coast for an inland country command", () => {
    const game = buildLandingMap();
    const attacker = addPlayer(game, game.ref(3, 8), "attacker");
    const target = addPlayer(game, game.ref(12, 3), "target");
    const selectedInlandTile = game.ref(14, 8);
    const spatial = new SpatialQuery(game);

    const result = spatial.closestReachableShore(
      target,
      attacker,
      selectedInlandTile,
      1,
    );

    expect(result).not.toBeNull();
    expect(game.map().manhattanDist(selectedInlandTile, result!)).toBeGreaterThan(
      1,
    );
    expect(game.ownerID(result!)).toBe(target.smallID());
    expect(spatial.closestShoreByWater(attacker, result!)).not.toBeNull();
  });

  it("keeps transport availability in the country command refresh, including tile zero", async () => {
    const targetProfile: PlayerProfile = { relations: {}, alliances: [] };
    const target = {
      id: () => 17,
      isPlayer: () => true,
      profile: vi.fn().mockResolvedValue(targetProfile),
    } as unknown as PlayerView;
    const refreshActions = vi.fn().mockResolvedValue(actionsWithLanding());
    const myPlayer = {
      isAlive: () => true,
      actions: refreshActions,
    } as unknown as PlayerView;
    const panel = new PlayerPanel();
    panel.g = {
      owner: () => target,
      myPlayer: () => myPlayer,
      ticks: () => 100,
    } as unknown as GameView;
    panel["tile"] = 0 as TileRef;
    panel["selectedPlayer"] = target;
    panel.isVisible = true;

    await panel.tick();

    expect(refreshActions).toHaveBeenCalledWith(0, [UnitType.TransportShip]);
    expect(panel["actions"]?.buildableUnits[0]?.type).toBe(
      UnitType.TransportShip,
    );
  });

  it("does not let an obsolete async refresh overwrite a new selection", async () => {
    let resolveActions: (actions: PlayerActions) => void = () => undefined;
    const pendingActions = new Promise<PlayerActions>((resolve) => {
      resolveActions = resolve;
    });
    const targetA = {
      id: () => 17,
      isPlayer: () => true,
      profile: vi.fn().mockResolvedValue({ relations: {}, alliances: [] }),
    } as unknown as PlayerView;
    const targetB = {
      id: () => 18,
      isPlayer: () => true,
      profile: vi.fn().mockResolvedValue({ relations: {}, alliances: [] }),
    } as unknown as PlayerView;
    const panel = new PlayerPanel();
    let selectedTile = 1 as TileRef;
    panel.g = {
      owner: (tile: TileRef) => (tile === (1 as TileRef) ? targetA : targetB),
      myPlayer: () =>
        ({
          isAlive: () => true,
          actions: () => pendingActions,
        }) as unknown as PlayerView,
      ticks: () => 100,
    } as unknown as GameView;
    panel["tile"] = selectedTile;
    panel["selectedPlayer"] = targetA;
    panel.isVisible = true;

    const refresh = panel.tick();
    selectedTile = 2 as TileRef;
    panel.beginSelection(selectedTile);
    resolveActions(actionsWithLanding());
    await refresh;

    expect(panel["tile"]).toBe(selectedTile);
    expect(panel["selectedPlayer"]).toBe(targetB);
    expect(panel["actions"]).toBeNull();
  });
});
