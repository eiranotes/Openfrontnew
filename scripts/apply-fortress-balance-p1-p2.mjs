import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";

const root = path.resolve(process.argv[2] ?? ".");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const partNames = fs
  .readdirSync(scriptDir)
  .filter((name) => name.startsWith("fortress-balance-p1-p2.patch.part-"))
  .sort();

const markerChecks = [
  [
    "src/core/game/FortressBalance.ts",
    "MILITARY_QUALITY_POWER_EXPONENT = 0.55",
  ],
  ["src/core/game/FortressBalance.ts", "militaryCombatModifiers"],
  ["src/core/configuration/Config.ts", "commercialIncomeMultiplier"],
  ["src/core/configuration/Config.ts", "(captured.gold() * 7n) / 20n"],
  ["src/core/execution/AttackExecution.ts", "effectiveMilitaryQuality"],
  ["src/core/game/GameImpl.ts", "conqueror.id(),\n        goldCaptured,"],
  [
    "src/core/game/AllianceCoordination.ts",
    "MIN_ALLIANCE_GOLD_RESERVE = 125_000n",
  ],
  ["tests/FortressEconomyBalance.test.ts", "Fortress commercial income"],
  [
    "tests/FortressEconomyBalance.test.ts",
    'path.resolve(process.cwd(), "src/core/game/GameImpl.ts")',
  ],
  ["tests/FortressBalance.test.ts", 'import "./ConquerGold.test";'],
  ["docs/FORTRESS_BALANCE_ROADMAP.md", "Fortress balance roadmap"],
];

function absolute(relativePath) {
  return path.join(root, relativePath);
}

function contains(relativePath, marker) {
  const file = absolute(relativePath);
  return fs.existsSync(file) && fs.readFileSync(file, "utf8").includes(marker);
}

function replaceOnce(relativePath, before, after, label) {
  const file = absolute(relativePath);
  let content = fs.readFileSync(file, "utf8");
  if (content.includes(after)) return;
  if (!content.includes(before)) {
    throw new Error(`Fortress P1/P2 replacement anchor missing: ${label}`);
  }
  content = content.replace(before, after);
  fs.writeFileSync(file, content);
}

if (markerChecks.every(([relativePath, marker]) => contains(relativePath, marker))) {
  console.log("Fortress P1/P2 balance pass is already materialized.");
  process.exit(0);
}

if (partNames.length !== 5) {
  throw new Error(
    `Expected 5 Fortress P1/P2 patch parts, found ${partNames.length}`,
  );
}

const encoded = partNames
  .map((name) => fs.readFileSync(path.join(scriptDir, name), "utf8"))
  .join("")
  .replace(/\s/g, "");
const encodedDigest = createHash("sha256").update(encoded).digest("hex");
const expectedEncodedDigest =
  "24ca650596395a601a06c770098962e4220fe33e4a6cb83b56007f9e34e46420";
if (encodedDigest !== expectedEncodedDigest) {
  throw new Error(
    `Fortress P1/P2 encoded checksum mismatch: ${encodedDigest}`,
  );
}

const patch = gunzipSync(Buffer.from(encoded, "base64"));
const patchDigest = createHash("sha256").update(patch).digest("hex");
const expectedPatchDigest =
  "830d4de34aea13a5d617b5779b544e983eade9bf980bbbd916aed451b202179e";
if (patchDigest !== expectedPatchDigest) {
  throw new Error(`Fortress P1/P2 patch checksum mismatch: ${patchDigest}`);
}

function gitApply(args) {
  return spawnSync("git", ["apply", ...args, "-"], {
    cwd: root,
    encoding: "utf8",
    input: patch,
  });
}

const forwardCheck = gitApply(["--check"]);
if (forwardCheck.status === 0) {
  const applied = gitApply([]);
  if (applied.status !== 0) {
    throw new Error(
      `Fortress P1/P2 patch failed:\n${applied.stdout}\n${applied.stderr}`,
    );
  }
} else {
  const reverseCheck = gitApply(["--reverse", "--check"]);
  if (reverseCheck.status !== 0) {
    throw new Error(
      "Fortress P1/P2 patch anchors do not match the source tree.\n" +
        `Forward check:\n${forwardCheck.stdout}\n${forwardCheck.stderr}\n` +
        `Reverse check:\n${reverseCheck.stdout}\n${reverseCheck.stderr}`,
    );
  }
}

replaceOnce(
  "tests/FortressEconomyBalance.test.ts",
  'import fs from "node:fs";',
  'import fs from "node:fs";\nimport path from "node:path";',
  "node:path import",
);
replaceOnce(
  "tests/FortressEconomyBalance.test.ts",
  `    const gameImpl = fs.readFileSync(
      new URL("../src/core/game/GameImpl.ts", import.meta.url),
      "utf8",
    );`,
  `    const gameImpl = fs.readFileSync(
      path.resolve(process.cwd(), "src/core/game/GameImpl.ts"),
      "utf8",
    );`,
  "conquest event source path",
);

for (const [relativePath, marker] of markerChecks) {
  if (!contains(relativePath, marker)) {
    throw new Error(
      `Fortress P1/P2 marker missing after apply: ${relativePath}`,
    );
  }
}

console.log(
  "Applied military quality compression, facility price separation, commercial income, conquest, and alliance reserve balance.",
);
