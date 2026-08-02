import { ConstructionExecution } from "../../src/core/execution/ConstructionExecution";
import { NukeExecution } from "../../src/core/execution/NukeExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../src/core/game/Game";
import { setup } from "../util/Setup";

describe("Construction economy", () => {
  let game: Game;
  let player: Player;
  let other: Player;
  const builderInfo = new PlayerInfo(
    "builder",
    PlayerType.Human,
    null,
    "builder_id",
  );
  const otherInfo = new PlayerInfo("other", PlayerType.Human, null, "other_id");

  beforeEach(async () => {
    game = await setup(
      "plains",
      {
        infiniteGold: false,
        instantBuild: false,
        infiniteTroops: true,
      },
      [builderInfo, otherInfo],
    );
    player = game.player(builderInfo.id);
    other = game.player(otherInfo.id);
    player.conquer(game.ref(0, 10));
    other.conquer(game.ref(10, 10));
  });

  test("City charges gold once, then starts producing gold after completion", () => {
    const target = game.ref(0, 10);
    const cost = game.unitInfo(UnitType.City).cost(game, player);
    expect(cost).toBe(120_000n);
    player.addGold(cost);

    game.addExecution(new ConstructionExecution(player, UnitType.City, target));

    // Initialisation and construction deduct the price exactly once. An
    // unfinished city must not contribute to the city economy.
    game.executeNextTick();
    game.executeNextTick();
    const afterBuild = player.gold();
    expect(afterBuild < cost).toBe(true);
    expect(game.config().goldIncomeBreakdown(player).cityGoldPerTick).toBe(0);

    const duration = game.unitInfo(UnitType.City).constructionDuration ?? 0;
    for (let i = 0; i <= duration + 2; i++) game.executeNextTick();

    const city = player.units(UnitType.City)[0];
    expect(city).toBeDefined();
    expect(city.isUnderConstruction()).toBe(false);

    const income = game.config().goldIncomeBreakdown(player);
    expect(income.baseGoldPerTick).toBe(100);
    expect(income.cityBaseGoldPerTick).toBe(40);
    expect(income.cityGoldPerTick).toBeGreaterThan(0);
    expect(income.totalGoldPerTick).toBeGreaterThan(100);

    // The build was not refunded; only passive base and city income accumulated.
    expect(player.gold()).toBeGreaterThan(afterBuild);
    expect(player.gold()).toBeLessThan(cost);
  });

  test("MIRV gets more expensive with each launch", () => {
    expect(game.config().unitInfo(UnitType.MIRV).cost(game, other)).toBe(
      25_000_000n,
    );

    player.addGold(100_000_000n);

    player.conquer(game.ref(1, 1));
    player.buildUnit(UnitType.MissileSilo, game.ref(1, 1), {});

    other.conquer(game.ref(10, 10));
    game.addExecution(
      new NukeExecution(UnitType.MIRV, player, game.ref(10, 10)),
    );
    game.executeNextTick(); // init
    game.executeNextTick(); // create MIRV unit
    game.executeNextTick();

    expect(player.units(UnitType.MIRV)).toHaveLength(1);

    // Price of the MIRV increases for everyone with each launch.
    expect(game.config().unitInfo(UnitType.MIRV).cost(game, other)).toBe(
      40_000_000n,
    );
  });
});
