import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(process.argv[2] ?? ".");

function run(relativeScript, label) {
  const script = path.join(root, relativeScript);
  const result = spawnSync(process.execPath, [script, root], {
    cwd: root,
    encoding: "utf8",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

run(
  "scripts/apply-alliance-command-fixes.mjs",
  "Fortress, landing and command patch chain",
);
run("scripts/apply-operational-atlas-ui.mjs", "Operational Atlas UI patch");

console.log("Applied the complete Fortress UI overhaul chain.");
