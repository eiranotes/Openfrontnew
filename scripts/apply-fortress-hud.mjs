import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ?? ".";
const lines = (...values) => values.join("\n");

function edit(relativePath, edits) {
  const file = path.join(root, relativePath);
  let content = fs.readFileSync(file, "utf8");
  for (const [before, after] of edits) {
    if (!content.includes(before)) {
      throw new Error(
        `HUD patch anchor missing in ${relativePath}: ${before.slice(0, 80)}`,
      );
    }
    content = content.replace(before, after);
  }
  fs.writeFileSync(file, content);
}

edit("src/core/game/FortressBalance.ts", [
  [
    'import { UnitType, type Game, type Player } from "./Game";',
    'import { UnitType, type Game } from "./Game";',
  ],
  [
    "function completedCityLevels(player: Player): number[] {",
    lines(
      "interface MilitaryUnitLike {",
      "  level(): number;",
      "  isActive(): boolean;",
      "  isUnderConstruction(): boolean;",
      "  troops(): number;",
      "}",
      "",
      "interface MilitaryAttackLike {",
      "  troops: number | (() => number);",
      "}",
      "",
      "export interface MilitaryPlayerLike {",
      "  units(type: UnitType): MilitaryUnitLike[];",
      "  outgoingAttacks(): MilitaryAttackLike[];",
      "  troops(): number;",
      "  numTilesOwned(): number;",
      "}",
      "",
      "function attackTroops(attack: MilitaryAttackLike): number {",
      '  return typeof attack.troops === "function" ? attack.troops() : attack.troops;',
      "}",
      "",
      "function completedCityLevels(player: MilitaryPlayerLike): number[] {",
    ),
  ],
  [
    lines(
      "export function totalMilitaryManpower(player: Player): number {",
      "  const fieldArmies = player.outgoingAttacks().reduce(",
      "    (sum, attack) => sum + attack.troops(),",
    ),
    lines(
      "export function totalMilitaryManpower(player: MilitaryPlayerLike): number {",
      "  const fieldArmies = player.outgoingAttacks().reduce(",
      "    (sum, attack) => sum + attackTroops(attack),",
    ),
  ],
  [
    "export function militaryProfile(player: Player): MilitaryProfile {",
    "export function militaryProfile(player: MilitaryPlayerLike): MilitaryProfile {",
  ],
  [
    "export function militaryQuality(player: Player): MilitaryProfile {",
    "export function militaryQuality(player: MilitaryPlayerLike): MilitaryProfile {",
  ],
  [
    lines("  player: Player,", "): OverextensionPenalties {"),
    lines("  player: MilitaryPlayerLike,", "): OverextensionPenalties {"),
  ],
]);

edit("src/client/hud/layers/ControlPanel.ts", [
  [
    'import { GameMode, GameType, Gold } from "../../../core/game/Game";',
    lines(
      'import { GameMode, GameType, Gold } from "../../../core/game/Game";',
      'import { militaryProfile } from "../../../core/game/FortressBalance";',
    ),
  ],
  [
    lines(
      "  @state()",
      "  private _attackingTroops: number = 0;",
      "",
      "  @state()",
      "  private _goldGain: bigint | null = null;",
    ),
    lines(
      "  @state()",
      "  private _attackingTroops: number = 0;",
      "",
      "  @state()",
      '  private _militaryLabel = "징집군";',
      "",
      "  @state()",
      "  private _militaryQuality = 1;",
      "",
      "  @state()",
      "  private _trainingCoverage = 0;",
      "",
      "  @state()",
      "  private _trainingCapacity = 0;",
      "",
      "  @state()",
      "  private _goldGain: bigint | null = null;",
    ),
  ],
  [
    lines(
      "    this._attackingTroops = player",
      "      .outgoingAttacks()",
      "      .map((a) => a.troops)",
      "      .reduce((a, b) => a + b, 0);",
      "    this.troopRate = config.troopIncreaseRate(player) * 10;",
    ),
    lines(
      "    this._attackingTroops = player",
      "      .outgoingAttacks()",
      "      .map((a) => a.troops)",
      "      .reduce((a, b) => a + b, 0);",
      "    const military = militaryProfile(player);",
      "    this._militaryLabel = military.label;",
      "    this._militaryQuality = military.quality;",
      "    this._trainingCoverage = military.coverage;",
      "    this._trainingCapacity = military.trainingCapacity;",
      "    this.troopRate = config.troopIncreaseRate(player) * 10;",
    ),
  ],
  [
    lines(
      "      <!-- Row 2: attack ratio | slider -->",
      '      <div class="flex items-center gap-1.5" translate="no">',
    ),
    lines(
      "      <!-- Row 2: military quality | attack ratio | slider -->",
      '      <div class="flex items-center gap-1.5" translate="no">',
      "        <div",
      '          class="flex items-center justify-between gap-1 shrink-0 border border-sky-400/60 bg-sky-400/10 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-sky-200 min-w-[9.5rem]"',
      '          title="훈련 수용량 ${renderTroops(this._trainingCapacity)}"',
      "        >",
      "          <span>◆ ${this._militaryLabel}</span>",
      '          <span class="tabular-nums">×${this._militaryQuality.toFixed(2)}</span>',
      '          <span class="text-sky-300/70 tabular-nums">${Math.round(',
      "            this._trainingCoverage * 100,",
      "          )}%</span>",
      "        </div>",
    ),
  ],
  [
    lines("      </div>", "    `;", "  }", "", "  render() {"),
    lines(
      "      </div>",
      "      <div",
      '        class="mt-1 flex items-center justify-center gap-2 text-[10px] font-bold text-sky-200"',
      '        translate="no"',
      '        title="훈련 수용량 ${renderTroops(this._trainingCapacity)}"',
      "      >",
      "        <span>◆ ${this._militaryLabel} ×${this._militaryQuality.toFixed(2)}</span>",
      '        <span class="text-sky-300/70">훈련 ${Math.round(',
      "          this._trainingCoverage * 100,",
      "        )}%</span>",
      "      </div>",
      "    `;",
      "  }",
      "",
      "  render() {",
    ),
  ],
]);

console.log("Applied Fortress HUD patch.");
