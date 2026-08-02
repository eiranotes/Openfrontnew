import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { gunzipSync } from "node:zlib";

const root = path.resolve(process.argv[2] ?? ".");
const inputPath = path.join(root, "src/client/InputHandler.ts");
const panelPath = path.join(root, "src/client/hud/layers/PlayerPanel.ts");

if (
  fs.existsSync(inputPath) &&
  fs.existsSync(panelPath) &&
  fs.readFileSync(inputPath, "utf8").includes("TOUCH_TAP_SLOP_PX = 22") &&
  fs.readFileSync(panelPath, "utf8").includes("command-player-layer")
) {
  console.log("Touch selection and command UI polish already applied.");
  process.exit(0);
}

const scriptsDir = path.join(root, "scripts");
const partNames = fs
  .readdirSync(scriptsDir)
  .filter((name) => name.startsWith("touch-ui-patch.part-"))
  .sort();

if (partNames.length !== 6) {
  throw new Error(`Expected 6 touch UI patch parts, found ${partNames.length}`);
}

const encoded = partNames
  .map((name) => fs.readFileSync(path.join(scriptsDir, name), "utf8"))
  .join("")
  .replace(/\s+/g, "");

const encodedHash = createHash("sha256").update(encoded).digest("hex");
if (encodedHash !== "d921f2bee8ef4395706d37c8d80ab12cb87673d5a55dd774cba2dc1af8a0321a") {
  throw new Error(`Touch UI payload checksum mismatch: ${encodedHash}`);
}

const patch = gunzipSync(Buffer.from(encoded, "base64"));
const patchHash = createHash("sha256").update(patch).digest("hex");
if (patchHash !== "d06ad8d2f5d9da969dc56a58f5489d359b9be1f12b782ff9b54c5e4e66cf9284") {
  throw new Error(`Touch UI patch checksum mismatch: ${patchHash}`);
}

const patchPath = path.join(os.tmpdir(), `touch-ui-${process.pid}.patch`);
fs.writeFileSync(patchPath, patch);
const result = spawnSync(
  "git",
  ["apply", "--whitespace=nowarn", patchPath],
  { cwd: root, encoding: "utf8" },
);
fs.rmSync(patchPath, { force: true });

if (result.status !== 0) {
  throw new Error(`Touch UI patch failed:\n${result.stdout}\n${result.stderr}`);
}

console.log("Applied one-tap selection, non-modal country dock, and HUD polish.");
