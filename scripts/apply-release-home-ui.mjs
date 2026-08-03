import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";

const root = path.resolve(process.argv[2] ?? ".");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const encodedPatchPath = path.join(scriptDir, "release-home-ui.patch.gz.b64");
const markerChecks = [
  [
    "src/client/components/PlayPage.ts",
    'import "../styles/home-operations-desk.css";',
  ],
  ["src/client/components/PlayPage.ts", 'class="command-home-shell"'],
  [
    "src/client/components/DesktopNavBar.ts",
    'class="command-desktop-nav__more-menu"',
  ],
  [
    "src/client/sound/SoundManager.ts",
    "BACKGROUND_MUSIC_TRACK_PATHS: readonly string[] = []",
  ],
  ["scripts/browser-single-player-smoke.mjs", "modal.randomSpawn = true"],
  [
    "src/client/styles/home-operations-desk.css",
    "Clean Operations Desk homepage",
  ],
  [
    "tests/OperationalAtlasUi.test.ts",
    "uses a clean operations desk and collapses secondary desktop navigation",
  ],
];

function contains(relativePath, marker) {
  const absolutePath = path.join(root, relativePath);
  return (
    fs.existsSync(absolutePath) &&
    fs.readFileSync(absolutePath, "utf8").includes(marker)
  );
}

if (markerChecks.every(([relativePath, marker]) => contains(relativePath, marker))) {
  console.log("Release stabilization and clean homepage UI are already materialized.");
  process.exit(0);
}

if (!fs.existsSync(encodedPatchPath)) {
  throw new Error(`Missing release/home patch archive: ${encodedPatchPath}`);
}

const encoded = fs.readFileSync(encodedPatchPath, "utf8").replace(/\s/g, "");
const encodedDigest = createHash("sha256").update(encoded).digest("hex");
const expectedEncodedDigest =
  "5cede833e460e30a03252d30bd2dd6e85cf19ed94c69bce653a18cf476fda935";
if (encodedDigest !== expectedEncodedDigest) {
  throw new Error(
    `Release/home encoded patch checksum mismatch: ${encodedDigest}`,
  );
}

const patch = gunzipSync(Buffer.from(encoded, "base64"));
const patchDigest = createHash("sha256").update(patch).digest("hex");
const expectedPatchDigest =
  "e7096cc79a95e035a06fb577292843a3edb8eb7512c4886793a5c36af9db50ca";
if (patchDigest !== expectedPatchDigest) {
  throw new Error(`Release/home patch checksum mismatch: ${patchDigest}`);
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
      `Release/home patch failed:\n${applied.stdout}\n${applied.stderr}`,
    );
  }
} else {
  const reverseCheck = gitApply(["--reverse", "--check"]);
  if (reverseCheck.status !== 0) {
    throw new Error(
      "Release/home patch anchors do not match the source tree.\n" +
        `Forward check:\n${forwardCheck.stdout}\n${forwardCheck.stderr}\n` +
        `Reverse check:\n${reverseCheck.stdout}\n${reverseCheck.stderr}`,
    );
  }
}

for (const [relativePath, marker] of markerChecks) {
  if (!contains(relativePath, marker)) {
    throw new Error(`Release/home marker missing after apply: ${relativePath}`);
  }
}

console.log(
  "Applied deterministic browser startup, asset cleanup, and the clean Operations Desk homepage.",
);
