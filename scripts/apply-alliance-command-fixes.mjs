import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");

function replaceOnce(relativePath, before, after, label) {
  const filePath = path.join(root, relativePath);
  let content = fs.readFileSync(filePath, "utf8");
  if (content.includes(after)) return;
  if (!content.includes(before)) {
    throw new Error(`Alliance fix anchor missing: ${label}`);
  }
  content = content.replace(before, after);
  fs.writeFileSync(filePath, content);
}

replaceOnce(
  "src/core/game/AllianceCoordination.ts",
  "const reserve = Math.ceil(maxTroops * ALLIANCE_TROOP_RESERVE_RATIO);",
  "const reserve = Math.ceil((maxTroops * 55) / 100);",
  "integer troop reserve calculation",
);

replaceOnce(
  "tests/FortressBalance.test.ts",
  'expect(touch).toContain("const isOwnedByMe");',
  'expect(touch).toContain("this.game.hasOwner(clickRef)");',
  "alliance-aware mobile touch assertion",
);

console.log("Applied alliance support rounding and touch-test fixes.");
