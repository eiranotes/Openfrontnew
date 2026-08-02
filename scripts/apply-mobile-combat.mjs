import fs from "node:fs";
import path from "node:path";
const root = path.resolve(process.argv[2] ?? ".");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const write = (p, c) => fs.writeFileSync(path.join(root, p), c);
function replaceOnce(file, before, after, label) {
  let content = read(file);
  if (content.includes(after)) return;
  if (!content.includes(before)) throw new Error(`Mobile combat anchor missing: ${label}`);
  write(file, content.replace(before, after));
}
replaceOnce(
  "src/client/InputHandler.ts",
  `  private readonly LONG_PRESS_MS = 800;`,
  `  private readonly LONG_PRESS_MS = 500;`,
  "long press",
);
replaceOnce(
  "src/client/controllers/WarshipSelectionController.ts",
  `  /**
   * Touch handler mirroring mouse-up. On dry land with no selection, falls
   * back to opening the radial menu.
   */`,
  `  /**
   * Enemy or neutral land uses the desktop direct-attack path. Owned land
   * retains the build menu, so mobile combat no longer needs a radial detour.
   */`,
  "touch comment",
);
replaceOnce(
  "src/client/controllers/WarshipSelectionController.ts",
  `    if (!this.game.isWater(clickRef)) {
      this.eventBus.emit(new ContextMenuEvent(event.x, event.y));
      return;
    }`,
  `    if (!this.game.isWater(clickRef)) {
      const myPlayer = this.game.myPlayer();
      const isOwnedByMe =
        myPlayer !== null &&
        this.game.hasOwner(clickRef) &&
        this.game.owner(clickRef) === myPlayer;
      this.eventBus.emit(
        isOwnedByMe
          ? new ContextMenuEvent(event.x, event.y)
          : new MouseUpEvent(event.x, event.y),
      );
      return;
    }`,
  "direct land attack",
);
for (const [before, after, label] of [
  [
    `                content: "❌",
                onClick: () => this.emitCancelAttackIntent(attack.id),
                className: "ml-auto text-left shrink-0",`,
    `                content: "후퇴",
                onClick: () => this.emitCancelAttackIntent(attack.id),
                className:
                  "ml-auto min-h-11 shrink-0 rounded-md border border-white/15 bg-white/[0.06] px-3 text-xs font-semibold",`,
    "attack retreat",
  ],
  [
    `                content: "❌",
                onClick: () => this.emitCancelAttackIntent(landAttack.id),
                className: "ml-auto text-left shrink-0",`,
    `                content: "후퇴",
                onClick: () => this.emitCancelAttackIntent(landAttack.id),
                className:
                  "ml-auto min-h-11 shrink-0 rounded-md border border-white/15 bg-white/[0.06] px-3 text-xs font-semibold",`,
    "wilderness retreat",
  ],
  [
    `                content: "\\u274C",
                onClick: () => this.emitBoatCancelIntent(boat.id()),
                className: "ml-auto text-left shrink-0",`,
    `                content: "후퇴",
                onClick: () => this.emitBoatCancelIntent(boat.id()),
                className:
                  "ml-auto min-h-11 shrink-0 rounded-md border border-white/15 bg-white/[0.06] px-3 text-xs font-semibold",`,
    "boat retreat",
  ],
]) {
  replaceOnce("src/client/hud/layers/AttacksDisplay.ts", before, after, label);
}
console.log("Applied direct mobile combat controls.");
