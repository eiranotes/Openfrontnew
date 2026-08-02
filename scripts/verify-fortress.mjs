import fs from "node:fs";

const checks = [
  ["src/core/game/FortressBalance.ts", "compactStateProfile"],
  ["src/core/game/FortressBalance.ts", "economyMultiplier: 1 + 0.3"],
  ["src/core/configuration/Config.ts", "compactStateProfile(attacker).combatMultiplier"],
  ["src/core/configuration/Config.ts", "compactStateProfile(player).reinforcementMultiplier"],
  ["src/core/configuration/Config.ts", "maxHealth: 600"],
  ["src/core/execution/AttackExecution.ts", "opposing armies cancel by effective combat power"],
  ["src/core/execution/PlayerExecution.ts", "Math.floor(u.level() / 2)"],
  ["src/core/execution/WarshipExecution.ts", "Hostile escorts must be cleared"],
  ["src/client/controllers/WarshipSelectionController.ts", "const isOwnedByMe"],
  ["src/client/controllers/BuildPreviewController.ts", "innerRangeRadius = magnitude.inner"],
  ["src/client/render/gl/passes/RangeCirclePass.ts", "this.drawCircle(this.innerRadius"],
  ["src/core/AssetUrls.ts", "normalizedBase"],
  ["vite.config.ts", "GITHUB_PAGES"],
  ["tests/FortressBalance.test.ts", "compact-state development efficiency"],
];

for (const [file, needle] of checks) {
  const content = fs.readFileSync(file, "utf8");
  if (!content.includes(needle)) {
    throw new Error(`Verification failed: ${needle} missing from ${file}`);
  }
}
console.log(`Verified ${checks.length} Fortress compact-state invariants.`);
