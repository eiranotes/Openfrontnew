import fs from "node:fs";

const checks = [
  ["src/core/game/FortressBalance.ts", "export interface MilitaryPlayerLike"],
  ["src/core/game/FortressBalance.ts", "function attackTroops"],
  ["src/client/hud/layers/ControlPanel.ts", "const military = militaryProfile(player)"],
  ["src/client/hud/layers/ControlPanel.ts", "◆ ${this._militaryLabel}"],
  ["src/client/hud/layers/ControlPanel.ts", "훈련 ${Math.round("],
];

for (const [file, needle] of checks) {
  const content = fs.readFileSync(file, "utf8");
  if (!content.includes(needle)) {
    throw new Error(`HUD verification failed: ${needle} missing from ${file}`);
  }
}

console.log(`Verified ${checks.length} Fortress HUD invariants.`);
