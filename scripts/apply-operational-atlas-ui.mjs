import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const root = path.resolve(process.argv[2] ?? ".");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const markerChecks = [
  ["src/client/Main.ts", 'import "./styles/operational-atlas.css";'],
  ["src/client/styles/operational-atlas.css", "Operational Atlas"],
  ["src/client/components/PlayPage.ts", "command-steam-promo-slot"],
  ["src/client/hud/layers/BuildMenu.ts", "command-build-dock"],
  ["src/client/hud/layers/BuildMenu.ts", "bottom: max(14px, env(safe-area-inset-bottom))"],
  ["tests/OperationalAtlasUi.test.ts", "Operational Atlas UI system"],
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
    throw new Error(`Operational Atlas alias anchor missing: ${label}`);
  }
  content = content.replace(before, after);
  fs.writeFileSync(file, content);
}

if (markerChecks.every(([relativePath, marker]) => contains(relativePath, marker))) {
  console.log("Operational Atlas UI is already materialized.");
  process.exit(0);
}

const partNames = fs
  .readdirSync(scriptDir)
  .filter((name) => name.startsWith("operational-atlas-ui.patch.part-"))
  .sort();

if (partNames.length !== 5) {
  throw new Error(
    `Expected 5 Operational Atlas patch parts, found ${partNames.length}`,
  );
}

const encoded = partNames
  .map((name) => fs.readFileSync(path.join(scriptDir, name), "utf8"))
  .join("")
  .replace(/\s/g, "");
const encodedDigest = createHash("sha256").update(`${encoded}\n`).digest("hex");
const expectedEncodedDigest =
  "75b3b47369fa28685e8bfeaad7e87ca049d1990dc645ea959db3ae1571801f73";
if (encodedDigest !== expectedEncodedDigest) {
  throw new Error(
    `Operational Atlas encoded patch checksum mismatch: ${encodedDigest}`,
  );
}

const patch = gunzipSync(Buffer.from(encoded, "base64"));
const patchDigest = createHash("sha256").update(patch).digest("hex");
const expectedPatchDigest =
  "7de1e94a029be8e395cac25def32b0dc6f4a699cd92db1caa5efd920d9fd223f";
if (patchDigest !== expectedPatchDigest) {
  throw new Error(`Operational Atlas patch checksum mismatch: ${patchDigest}`);
}

function gitApply(args) {
  return spawnSync("git", ["apply", ...args, "-"], {
    cwd: root,
    encoding: "utf8",
    input: patch,
  });
}

const check = gitApply(["--check"]);
if (check.status === 0) {
  const applied = gitApply([]);
  if (applied.status !== 0) {
    throw new Error(
      `Operational Atlas patch failed:\n${applied.stdout}\n${applied.stderr}`,
    );
  }
} else {
  const reverseCheck = gitApply(["--reverse", "--check"]);
  if (reverseCheck.status !== 0) {
    throw new Error(
      `Operational Atlas patch anchors do not match the source tree.\n` +
        `Forward check:\n${check.stdout}\n${check.stderr}\n` +
        `Reverse check:\n${reverseCheck.stdout}\n${reverseCheck.stderr}`,
    );
  }
}

replaceOnce(
  "src/client/components/PlayPage.ts",
  'class="command-home-steam lg:hidden"',
  'class="command-home-steam command-steam-promo-slot lg:hidden"',
  "compact Steam slot",
);
replaceOnce(
  "src/client/hud/layers/BuildMenu.ts",
  'class="build-menu ${this._hidden ? "hidden" : ""}"',
  'class="build-menu command-build-dock ${this._hidden ? "hidden" : ""}"',
  "nonmodal build dock",
);

for (const [relativePath, marker] of markerChecks) {
  if (!contains(relativePath, marker)) {
    throw new Error(`Operational Atlas marker missing after apply: ${relativePath}`);
  }
}

console.log("Applied the Operational Atlas UI system and browser audit.");
