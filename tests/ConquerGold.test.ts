import { SpawnExecution } from "../src/core/execution/SpawnExecution";
import { Game, Player, PlayerInfo, PlayerType } from "../src/core/game/Game";
import { GameID } from "../src/core/Schemas";
import { setup } from "./util/Setup";

const gameID: GameID = "test_game";

function addPlayerWithGold(
  game: Game,
  id: string,
  type: PlayerType,
  gold: bigint,
): Player {
  game.addPlayer(new PlayerInfo(id, type, null, id));
  const player = game.player(id);
  player.addGold(gold);
  return player;
}

describe("DefaultConfig.conquerGoldAmount", () => {
  let game: Game;

  beforeEach(async () => {
    game = await setup("ocean_and_land");
  });

  test("returns thirty-five percent for Bot", () => {
    const bot = addPlayerWithGold(game, "bot", PlayerType.Bot, 1000n);
    expect(game.config().conquerGoldAmount(bot)).toBe(350n);
  });

  test("returns thirty-five percent for Nation", () => {
    const nation = addPlayerWithGold(game, "nation", PlayerType.Nation, 2000n);
    expect(game.config().conquerGoldAmount(nation)).toBe(700n);
  });

  test("returns thirty-five percent for Human", () => {
    const human = addPlayerWithGold(game, "human", PlayerType.Human, 1000n);
    expect(game.config().conquerGoldAmount(human)).toBe(350n);
  });
});

describe("Conquest gold transfer", () => {
  let game: Game;
  let conqueror: Player;

  beforeEach(async () => {
    game = await setup("ocean_and_land");
    const conquerorInfo = new PlayerInfo(
      "conqueror",
      PlayerType.Human,
      null,
      "conqueror",
    );
    game.addPlayer(conquerorInfo);
    game.addExecution(
      new SpawnExecution(gameID, conquerorInfo, game.ref(0, 10)),
    );
    conqueror = game.player(conquerorInfo.id);
  });

  test("conqueror receives 35% of gold when conquering a Bot", () => {
    const bot = addPlayerWithGold(game, "bot", PlayerType.Bot, 1000n);
    const goldBefore = conqueror.gold();
    game.conquerPlayer(conqueror, bot);
    expect(conqueror.gold()).toBe(goldBefore + 350n);
    expect(bot.gold()).toBe(0n);
  });

  test("conqueror receives 35% of gold when conquering a Nation", () => {
    const nation = addPlayerWithGold(game, "nation", PlayerType.Nation, 800n);
    const goldBefore = conqueror.gold();
    game.conquerPlayer(conqueror, nation);
    expect(conqueror.gold()).toBe(goldBefore + 280n);
    expect(nation.gold()).toBe(0n);
  });

  test("conqueror receives 35% of gold when conquering an active Human", () => {
    // clientID must be non-null for stats tracking to work
    game.addPlayer(
      new PlayerInfo("victim", PlayerType.Human, "victim_client", "victim"),
    );
    const victim = game.player("victim");
    victim.addGold(1000n);
    // Record an attack so the gold transfer is not skipped
    game.stats().attack(victim, game.terraNullius(), 100);
    const goldBefore = conqueror.gold();
    game.conquerPlayer(conqueror, victim);
    expect(conqueror.gold()).toBe(goldBefore + 350n);
    expect(victim.gold()).toBe(0n);
  });

  test("conqueror receives no gold when conquering a Human who never attacked", () => {
    const victim = addPlayerWithGold(game, "afk", PlayerType.Human, 1000n);
    const goldBefore = conqueror.gold();
    game.conquerPlayer(conqueror, victim);
    expect(conqueror.gold()).toBe(goldBefore);
    expect(victim.gold()).toBe(1000n);
  });
});
