import fs from "node:fs";

const checks = [
  ["src/core/game/FortressBalance.ts", "TRAINING_CAPACITY_PER_CITY_LEVEL = 300_000"],
  ["src/core/game/FortressBalance.ts", "MAX_TROOPS_PER_CITY_LEVEL = 250_000"],
  ["src/core/game/FortressBalance.ts", "ADMINISTRATIVE_CAPACITY_PER_CITY_LEVEL = 6_000"],
  ["src/core/game/FortressBalance.ts", "cityUpgradePreview"],
  ["src/core/configuration/Config.ts", "goldIncomeBreakdown"],
  ["src/client/hud/layers/ControlPanel.ts", "군사 개혁 완료"],
  ["src/client/hud/layers/ControlPanel.ts", "행정 효율"],
  ["src/client/hud/layers/ControlPanel.ts", "총 금 수입"],
  ["src/client/hud/layers/BuildMenu.ts", "도시 발전 미리보기"],
  ["src/client/hud/layers/BuildMenu.ts", "최대 병력"],
  ["src/client/hud/layers/PlayerInfoOverlay.ts", "선택한 도시 발전 정보"],
  ["src/client/hud/layers/PlayerInfoOverlay.ts", "상대 전투력"],
  ["src/client/hud/layers/UnitDisplay.ts", "건설 시설 선택"],
  ["tests/FortressResponsiveUI.test.ts", "touch-first mobile build sheet"],
];

for (const [file, needle] of checks) {
  const content = fs.readFileSync(file, "utf8");
  if (!content.includes(needle)) {
    throw new Error(`HUD verification failed: ${needle} missing from ${file}`);
  }
}

console.log(`Verified ${checks.length} Fortress development and HUD invariants.`);
