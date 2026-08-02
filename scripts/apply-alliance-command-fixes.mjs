import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function write(relativePath, content) {
  fs.writeFileSync(path.join(root, relativePath), content);
}

const coordinationPath = "src/core/game/AllianceCoordination.ts";
let coordination = read(coordinationPath);
const integerReserve = "const reserve = Math.ceil((maxTroops * 55) / 100);";
if (!coordination.includes(integerReserve)) {
  const directAvailable =
    "const available = troops - maxTroops * ALLIANCE_TROOP_RESERVE_RATIO;";
  const floatingReserve =
    "const reserve = Math.ceil(maxTroops * ALLIANCE_TROOP_RESERVE_RATIO);";
  if (coordination.includes(directAvailable)) {
    coordination = coordination.replace(
      directAvailable,
      `${integerReserve}\n  const available = troops - reserve;`,
    );
  } else if (coordination.includes(floatingReserve)) {
    coordination = coordination.replace(floatingReserve, integerReserve);
  } else {
    throw new Error("Alliance fix anchor missing: troop reserve calculation");
  }
  write(coordinationPath, coordination);
}

const fortressTestPath = "tests/FortressBalance.test.ts";
let fortressTest = read(fortressTestPath);
const currentAssertion =
  'expect(touch).toContain("this.game.hasOwner(clickRef)");';
if (!fortressTest.includes(currentAssertion)) {
  const legacyAssertion = 'expect(touch).toContain("const isOwnedByMe");';
  if (!fortressTest.includes(legacyAssertion)) {
    throw new Error("Alliance fix anchor missing: mobile touch assertion");
  }
  fortressTest = fortressTest.replace(legacyAssertion, currentAssertion);
  write(fortressTestPath, fortressTest);
}

console.log("Applied alliance support rounding and touch-test fixes.");
