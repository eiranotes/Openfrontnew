import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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

const eventsPath = "src/client/hud/layers/EventsDisplay.ts";
let events = read(eventsPath);
const arrayAtExpression =
  "const compactEvent = tier1Events.at(-1) ?? tier2Events.at(-1);";
const indexedExpression =
  "const compactEvent =\n      tier1Events[tier1Events.length - 1] ??\n      tier2Events[tier2Events.length - 1];";
if (!events.includes(indexedExpression)) {
  if (!events.includes(arrayAtExpression)) {
    throw new Error("Alliance fix anchor missing: compact event selection");
  }
  events = events.replace(arrayAtExpression, indexedExpression);
  write(eventsPath, events);
}

const playerPanelPath = "src/client/hud/layers/PlayerPanel.ts";
let playerPanel = read(playerPanelPath);
const unguardedCoordinate =
  "const canCoordinateAttack = !!this.actions?.interaction?.canTarget;";
const guardedCoordinate =
  "const canCoordinateAttack =\n      !!this.actions?.interaction?.canTarget && my.allies().length > 0;";
if (!playerPanel.includes(guardedCoordinate)) {
  if (!playerPanel.includes(unguardedCoordinate)) {
    throw new Error("Alliance fix anchor missing: coordinated attack visibility");
  }
  playerPanel = playerPanel.replace(unguardedCoordinate, guardedCoordinate);
  write(playerPanelPath, playerPanel);
}

const touchScript = path.join(root, "scripts/apply-touch-ui-polish.mjs");
if (fs.existsSync(touchScript)) {
  const touchResult = spawnSync(process.execPath, [touchScript, root], {
    cwd: root,
    encoding: "utf8",
  });
  if (touchResult.status !== 0) {
    throw new Error(
      `Touch UI polish failed:\n${touchResult.stdout}\n${touchResult.stderr}`,
    );
  }
  if (touchResult.stdout) process.stdout.write(touchResult.stdout);

  const coordinationTestPath = "tests/AllianceCoordination.test.ts";
  let coordinationTest = read(coordinationTestPath);
  const touchTestImport = 'import "./TouchSelectionUi.test";';
  if (!coordinationTest.includes(touchTestImport)) {
    coordinationTest = `${touchTestImport}\n${coordinationTest}`;
    write(coordinationTestPath, coordinationTest);
  }

  const commandUiPath = "src/client/styles/command-ui.css";
  let commandUi = read(commandUiPath);
  const layerBefore = `.command-player-layer {\n  pointer-events: none;`;
  const layerAfter = `.command-player-layer {\n  pointer-events: none;\n  box-sizing: border-box;\n  padding: 0 !important;\n  margin: 0 !important;`;
  if (!commandUi.includes(layerAfter)) {
    if (!commandUi.includes(layerBefore)) {
      throw new Error("Touch UI fix anchor missing: command player layer");
    }
    commandUi = commandUi.replace(layerBefore, layerAfter);
  }
  commandUi = commandUi.replace(
    "background: rgba(10, 15, 20, 0.97);",
    "background: #0a0f14;",
  );

  const mobileChromeMarker = "/* Mobile tactical chrome compression. */";
  if (!commandUi.includes(mobileChromeMarker)) {
    commandUi += `\n\n${mobileChromeMarker}\n@media (max-width: 639px) {\n  game-left-sidebar aside,\n  game-right-sidebar aside {\n    min-height: 52px;\n    gap: 0 !important;\n    padding: 4px 6px !important;\n    border-top: 0 !important;\n    background: #0a0f14 !important;\n    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.24) !important;\n  }\n\n  game-left-sidebar aside {\n    border-left: 0 !important;\n    border-radius: 0 0 7px 0 !important;\n  }\n\n  game-right-sidebar aside {\n    border-right: 0 !important;\n    border-radius: 0 0 0 7px !important;\n  }\n\n  game-right-sidebar aside > div:first-child {\n    min-width: 58px;\n    padding-inline: 8px;\n    color: #cbd5e1;\n    font-size: 13px;\n    font-variant-numeric: tabular-nums;\n  }\n\n  game-left-sidebar [role=\"button\"],\n  game-right-sidebar .cursor-pointer {\n    min-width: 44px;\n    min-height: 44px;\n    border-radius: 4px !important;\n  }\n\n  game-left-sidebar img,\n  game-right-sidebar img {\n    width: 18px !important;\n    height: 18px !important;\n    opacity: 0.9;\n  }\n}\n`;
  }

  const boundedAnimationMarker =
    "/* Keep the dock entrance animation inside the viewport. */";
  if (!commandUi.includes(boundedAnimationMarker)) {
    commandUi += `\n\n${boundedAnimationMarker}\n.command-player-dock {\n  transform-origin: bottom center;\n}\n`;
  }

  const fullSizeAnimationMarker =
    "/* Preserve full control geometry throughout dock entrance. */";
  if (!commandUi.includes(fullSizeAnimationMarker)) {
    commandUi += `\n\n${fullSizeAnimationMarker}\n@keyframes command-dock-enter {\n  from {\n    opacity: 0;\n  }\n}\n`;
  }

  write(commandUiPath, commandUi);
}

console.log(
  "Applied alliance support, touch selection, compatibility, and command UI fixes.",
);
