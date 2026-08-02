import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/client/Main", () => ({}));
vi.mock("../src/client/Cosmetics", () => ({
  getPlayerCosmetics: vi.fn(async () => ({})),
}));
vi.mock("../src/client/CrazyGamesSDK", () => ({
  crazyGamesSDK: {
    isOnCrazyGames: () => false,
    requestMidgameAd: vi.fn(async () => undefined),
  },
}));

import { DEFAULT_OPTIONS, SinglePlayerModal } from "../src/client/SinglePlayerModal";
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  UnitType,
} from "../src/core/game/Game";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("single-player configuration", () => {
  it("uses the original OpenFront defaults", () => {
    expect(DEFAULT_OPTIONS.selectedMap).toBe(GameMapType.World);
    expect(DEFAULT_OPTIONS.selectedDifficulty).toBe(Difficulty.Easy);
    expect(DEFAULT_OPTIONS.bots).toBe(400);
    expect(DEFAULT_OPTIONS.compactMap).toBe(false);
    expect(DEFAULT_OPTIONS.disabledUnits).toEqual([]);
  });

  it.each([
    { compactMap: false, expectedSize: GameMapSize.Normal },
    { compactMap: true, expectedSize: GameMapSize.Compact },
  ])(
    "passes map, difficulty, bot count, mode and $expectedSize map size to the game",
    async ({ compactMap, expectedSize }) => {
      const modal = new SinglePlayerModal() as any;
      modal.selectedMap = GameMapType.Europe;
      modal.selectedDifficulty = Difficulty.Hard;
      modal.bots = 37;
      modal.compactMap = compactMap;
      modal.gameMode = GameMode.Team;
      modal.teamCount = 4;
      modal.nations = 7;
      modal.defaultNationCount = 20;
      modal.disabledUnits = [UnitType.MIRV];
      modal.close = vi.fn();

      const usernameInput = {
        whenSeeded: vi.fn(async () => undefined),
        getUsername: vi.fn(() => "Fortress Tester"),
        getClanTag: vi.fn(() => null),
      };
      vi.spyOn(document, "querySelector").mockReturnValue(
        usernameInput as unknown as Element,
      );

      let emitted: any;
      modal.addEventListener("join-lobby", (event: Event) => {
        emitted = (event as CustomEvent).detail;
      });

      await modal.startGame();

      expect(emitted.source).toBe("singleplayer");
      expect(emitted.gameStartInfo.config).toMatchObject({
        gameMap: GameMapType.Europe,
        gameMapSize: expectedSize,
        gameType: GameType.Singleplayer,
        gameMode: GameMode.Team,
        playerTeams: 4,
        difficulty: Difficulty.Hard,
        bots: 37,
        donateGold: true,
        donateTroops: true,
        disabledUnits: [UnitType.MIRV],
      });
      expect(emitted.gameStartInfo.config.nations).toBeDefined();
      expect(modal.close).toHaveBeenCalledOnce();
    },
  );
});
