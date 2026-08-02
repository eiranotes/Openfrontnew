import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const target = path.join(root, "src/client/SinglePlayerModal.ts");
let source = await readFile(target, "utf8");

const replacements = [
  ["const DEFAULT_OPTIONS = {", "export const DEFAULT_OPTIONS = {"],
  [
    "selectedDifficulty: Difficulty.Medium,",
    "selectedDifficulty: Difficulty.Easy,",
  ],
  ["bots: 80,", "bots: 400,"],
  ["compactMap: true,", "compactMap: false,"],
  [
    "disabledUnits: [UnitType.HydrogenBomb, UnitType.MIRV] as UnitType[],",
    "disabledUnits: [] as UnitType[],",
  ],
];

let changed = false;
for (const [from, to] of replacements) {
  if (source.includes(from)) {
    source = source.replace(from, to);
    changed = true;
  } else if (!source.includes(to)) {
    throw new Error(`Single-player option anchor not found: ${from}`);
  }
}

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

if (changed) {
  await writeFile(target, source);
  console.log("Restored original OpenFront single-player defaults.");
} else {
  console.log("Single-player defaults already match original OpenFront.");
}
