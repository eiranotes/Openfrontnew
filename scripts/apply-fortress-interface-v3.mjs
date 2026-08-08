import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";

const root = path.resolve(process.argv[2] ?? ".");
const scriptsDir = path.join(root, "scripts");
const parts = fs
  .readdirSync(scriptsDir)
  .filter((name) => /^fortress-interface-v3\.patch\.part-\d+$/.test(name))
  .sort();

if (parts.length === 0) {
  throw new Error("Fortress Interface V3 patch parts are missing");
}

const encoded = parts
  .map((name) => fs.readFileSync(path.join(scriptsDir, name), "utf8"))
  .join("")
  .replace(/\s+/g, "");
const patchPath = path.join(os.tmpdir(), "fortress-interface-v3.patch");
fs.writeFileSync(patchPath, gunzipSync(Buffer.from(encoded, "base64")));

function gitApply(args) {
  return spawnSync("git", ["apply", ...args, patchPath], {
    cwd: root,
    encoding: "utf8",
  });
}

const check = gitApply(["--check"]);
if (check.status === 0) {
  const applied = gitApply(["--whitespace=nowarn"]);
  if (applied.status !== 0) {
    if (applied.stderr) process.stderr.write(applied.stderr);
    throw new Error("Failed to apply Fortress Interface V3 patch");
  }
  console.log("Applied Fortress Interface V3 source patch.");
} else {
  const reverseCheck = gitApply(["--reverse", "--check"]);
  if (reverseCheck.status !== 0) {
    if (check.stderr) process.stderr.write(check.stderr);
    throw new Error("Fortress Interface V3 patch does not match this source tree");
  }
  console.log("Fortress Interface V3 already materialized.");
}
