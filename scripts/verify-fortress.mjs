import fs from 'node:fs';

const checks = [
  ['src/core/game/FortressBalance.ts', 'TRAINING_CAPACITY_PER_CITY_LEVEL'],
  ['src/core/configuration/Config.ts', 'Fortress: expansion creates logistics friction'],
  ['src/core/configuration/Config.ts', 'Math.max(5_000, tilesOwned)'],
  ['src/core/execution/AttackExecution.ts', 'opposing armies cancel by effective combat power'],
  ['src/core/execution/PlayerExecution.ts', 'conquest should not transfer'],
  ['src/core/AssetUrls.ts', 'normalizedBase'],
  ['vite.config.ts', 'GITHUB_PAGES'],
  ['tests/FortressBalance.test.ts', 'Fortress military quality'],
];

for (const [file, needle] of checks) {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes(needle)) {
    throw new Error(`Verification failed: ${needle} missing from ${file}`);
  }
}
console.log(`Verified ${checks.length} Fortress patch invariants.`);
