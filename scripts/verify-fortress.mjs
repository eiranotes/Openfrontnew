import fs from "node:fs";

const requiredChecks = [
  ["src/core/game/FortressBalance.ts", "compactStateProfile"],
  ["src/core/game/FortressBalance.ts", "BASE_DEVELOPMENT_REQUIREMENT"],
  ["src/core/game/FortressBalance.ts", "developmentEfficiencyScore"],
  ["src/core/game/FortressBalance.ts", "domesticIncomeMultiplier"],
  ["src/core/game/FortressBalance.ts", "commercialIncomeMultiplier"],
  ["src/core/game/FortressBalance.ts", "reinforcementMultiplier"],
  ["src/core/game/FortressBalance.ts", "logisticsMultiplier"],
  ["src/core/game/FortressBalance.ts", "MILITARY_QUALITY_POWER_EXPONENT"],
  ["src/core/game/FortressBalance.ts", "militaryCombatModifiers"],
  [
    "src/core/configuration/Config.ts",
    "compactStateProfile(attacker).logisticsMultiplier",
  ],
  [
    "src/core/configuration/Config.ts",
    "compactStateProfile(player).reinforcementMultiplier",
  ],
  [
    "src/core/configuration/Config.ts",
    "compactStateProfile(player).domesticIncomeMultiplier",
  ],
  [
    "src/core/configuration/Config.ts",
    "compactStateProfile(player).commercialIncomeMultiplier",
  ],
  ["src/core/configuration/Config.ts", "militaryCombatModifiers"],
  ["src/core/configuration/Config.ts", "(captured.gold() * 7n) / 20n"],
  ["src/core/configuration/Config.ts", "maxHealth: 600"],
  ["src/core/execution/AttackExecution.ts", "effectiveMilitaryQuality"],
  [
    "src/core/execution/AttackExecution.ts",
    "opposing armies cancel by effective combat power",
  ],
  [
    "src/core/game/AllianceCoordination.ts",
    "MIN_ALLIANCE_GOLD_RESERVE = 125_000n",
  ],
  ["src/core/execution/PlayerExecution.ts", "Math.floor(u.level() / 2)"],
  ["src/core/execution/WarshipExecution.ts", "Hostile escorts must be cleared"],
  [
    "src/client/controllers/WarshipSelectionController.ts",
    "this.game.hasOwner(clickRef)",
  ],
  [
    "src/client/controllers/WarshipSelectionController.ts",
    "new ContextMenuEvent(event.x, event.y)",
  ],
  [
    "src/client/controllers/BuildPreviewController.ts",
    "innerRangeRadius = magnitude.inner",
  ],
  [
    "src/client/render/gl/passes/RangeCirclePass.ts",
    "this.drawCircle(this.innerRadius",
  ],
  ["src/client/hud/layers/ControlPanel.ts", "_developmentRequirement"],
  ["src/core/AssetUrls.ts", "normalizedBase"],
  ["vite.config.ts", "GITHUB_PAGES"],
  ["tests/FortressBalance.test.ts", "investment-backed compact development"],
  ["tests/FortressEconomyBalance.test.ts", "Fortress commercial income"],
  ["docs/FORTRESS_BALANCE_ROADMAP.md", "Fortress balance roadmap"],
];

const forbiddenChecks = [
  ["src/core/configuration/Config.ts", "DEFENSE_DEBUFF_MIDPOINT"],
  ["src/core/configuration/Config.ts", "DEFENSE_DEBUFF_DECAY_RATE"],
  ["src/core/configuration/Config.ts", "largeDefenderSpeedDebuff"],
  ["src/core/configuration/Config.ts", "largeDefenderAttackDebuff"],
  ["src/core/configuration/Config.ts", ".combatMultiplier"],
  ["src/core/game/FortressBalance.ts", "economyMultiplier"],
  ["src/core/game/FortressBalance.ts", "combatMultiplier"],
  ["src/core/game/AllianceCoordination.ts", "ALLIANCE_GOLD_RESERVE = 20_000n"],
];

for (const [file, needle] of requiredChecks) {
  const content = fs.readFileSync(file, "utf8");
  if (!content.includes(needle)) {
    throw new Error(`Verification failed: ${needle} missing from ${file}`);
  }
}

for (const [file, needle] of forbiddenChecks) {
  const content = fs.readFileSync(file, "utf8");
  if (content.includes(needle)) {
    throw new Error(`Verification failed: ${needle} remains in ${file}`);
  }
}

console.log(
  `Verified ${requiredChecks.length} required and ${forbiddenChecks.length} removed Fortress invariants.`,
);
