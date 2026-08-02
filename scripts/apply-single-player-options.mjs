import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const target = path.join(root, "src/client/SinglePlayerModal.ts");
let source = await readFile(target, "utf8");
let changed = false;

function replaceOnce(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) {
    throw new Error(`Single-player option anchor not found: ${label}`);
  }
  source = source.replace(from, to);
  changed = true;
}

// Normalize both an unexported upstream declaration and any accidental repeated
// export modifier left by an older, non-idempotent version of this script.
const declarationBefore = source;
source = source.replace(
  /^(?:export\s+)+const DEFAULT_OPTIONS = \{/m,
  "export const DEFAULT_OPTIONS = {",
);
if (!source.includes("export const DEFAULT_OPTIONS = {")) {
  source = source.replace(
    /^const DEFAULT_OPTIONS = \{/m,
    "export const DEFAULT_OPTIONS = {",
  );
}
if (source !== declarationBefore) changed = true;

replaceOnce(
  "selectedDifficulty: Difficulty.Medium,",
  "selectedDifficulty: Difficulty.Easy,",
  "difficulty default",
);
replaceOnce("bots: 80,", "bots: 400,", "bot default");
replaceOnce("compactMap: true,", "compactMap: false,", "map-size default");
replaceOnce(
  "disabledUnits: [UnitType.HydrogenBomb, UnitType.MIRV] as UnitType[],",
  "disabledUnits: [] as UnitType[],",
  "enabled-unit defaults",
);

const required = [
  "export const DEFAULT_OPTIONS = {",
  "selectedDifficulty: Difficulty.Easy,",
  "bots: 400,",
  "compactMap: false,",
  "disabledUnits: [] as UnitType[],",
  "difficulty: {",
  "bots: {",
  "@map-selected=${this.handleConfigMapSelected}",
  "@difficulty-selected=${this.handleConfigDifficultySelected}",
  "@bots-changed=${this.handleBotsChange}",
];
for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Single-player option invariant missing: ${token}`);
  }
}

const declarationCount = (
  source.match(/export const DEFAULT_OPTIONS = \{/g) ?? []
).length;
if (declarationCount !== 1 || source.includes("export export")) {
  throw new Error(
    `DEFAULT_OPTIONS export must occur exactly once; found ${declarationCount}`,
  );
}

if (changed) {
  await writeFile(target, source);
  console.log("Restored original OpenFront single-player defaults.");
} else {
  console.log("Single-player defaults already match original OpenFront.");
}
