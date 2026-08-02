import { ConstructionExecution } from "../../src/core/execution/ConstructionExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../src/core/game/Game";
import { setup } from "../util/Setup";

// Regression test: the ghost/build-menu price of a structure must not double-count
// a player's first structure while it is still under construction.
//
// Fortress city prices use the next total city level:
// min(1.2m, 100k + 20k * nextLevel^2). The 1st city is 120k and the 2nd
// city level is 180k. Cost still uses Math.min(unitsOwned, unitsConstructed)
// so captured cities do not inflate a player's own development curve.
describe("Structure cost while under construction", () => {
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
      { infiniteGold: false, instantBuild: false, infiniteTroops: true },
      [builderInfo, otherInfo],
    );
    player = game.player(builderInfo.id);
    other = game.player(otherInfo.id);
    player.conquer(game.ref(0, 10));
    other.conquer(game.ref(15, 15));
    player.addGold(100_000_000n);
    other.addGold(100_000_000n);
  });

  function buildFirstCityUnderConstruction() {
    game.addExecution(
      new ConstructionExecution(player, UnitType.City, game.ref(0, 10)),
    );
    game.executeNextTick(); // init
    game.executeNextTick(); // build unit + setUnderConstruction(true)
    const built = player
      .units(UnitType.City)
      .find((u) => u.tile() === game.ref(0, 10));
    expect(built?.isUnderConstruction()).toBe(true);
  }

  test("first city under construction does not double-count itself", () => {
    buildFirstCityUnderConstruction();
    // One constructed city level → next total city level is 2 → 180k.
    expect(player.unitsConstructed(UnitType.City)).toBe(1);
    expect(game.unitInfo(UnitType.City).cost(game, player)).toBe(180_000n);
  });

  test("captured city does not inflate the price of a city under construction", () => {
    // 'other' builds a city; 'player' captures it (owns it without building it).
    const captured = other.buildUnit(UnitType.City, game.ref(15, 15), {});
    player.captureUnit(captured);

    buildFirstCityUnderConstruction();

    // Player has built exactly one city level. The captured city must not count
    // toward the builder's price curve, so the next city level remains 180k.
    expect(player.unitsConstructed(UnitType.City)).toBe(1);
    expect(game.unitInfo(UnitType.City).cost(game, player)).toBe(180_000n);
  });
});
