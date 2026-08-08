import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
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

function restoreStrategicBalancePatch() {
  const scriptsDir = path.join(root, "scripts");
  const driver = path.join(scriptsDir, "apply-strategic-balance-pages.mjs");
  const parts = fs
    .readdirSync(scriptsDir)
    .filter((name) => /^strategic-balance-pages\.part-\d+$/.test(name))
    .sort();

  if (parts.length > 0) {
    const encoded = parts
      .map((name) => fs.readFileSync(path.join(scriptsDir, name), "utf8"))
      .join("")
      .replace(/\s+/g, "");
    fs.writeFileSync(driver, gunzipSync(Buffer.from(encoded, "base64")));
  }

  if (!fs.existsSync(driver)) {
    throw new Error("Strategic balance patch driver is missing");
  }

  run(
    "scripts/apply-strategic-balance-pages.mjs",
    "Strategic balance and GitHub Pages routing patch",
  );

  for (const name of parts) {
    fs.rmSync(path.join(scriptsDir, name));
  }
}

run(
  "scripts/apply-alliance-command-fixes.mjs",
  "Fortress, landing and command patch chain",
);
run("scripts/apply-operational-atlas-ui.mjs", "Operational Atlas UI patch");
run(
  "scripts/apply-release-home-ui.mjs",
  "Release stabilization and clean homepage patch",
);
run(
  "scripts/apply-fortress-balance-p0.mjs",
  "Fortress P0 investment and territory balance patch",
);
run(
  "scripts/apply-fortress-balance-p1-p2.mjs",
  "Fortress P1/P2 combat and economy balance patch",
);
restoreStrategicBalancePatch();

console.log("Applied the complete Fortress UI and balance patch chain.");
