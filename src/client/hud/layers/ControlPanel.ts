import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { keyed } from "lit/directives/keyed.js";
import { assetUrl } from "../../../core/AssetUrls";
import { EventBus } from "../../../core/EventBus";
import { ClientID } from "../../../core/Schemas";
import {
  Config,
  type GoldIncomeBreakdown,
} from "../../../core/configuration/Config";
import { GameMode, GameType, Gold } from "../../../core/game/Game";
import {
  fortressEconomyProfile,
  militaryProfile,
  type TrainingCoverageStatus,
} from "../../../core/game/FortressBalance";
import { TileRef } from "../../../core/game/GameMap";
import { GameUpdateType } from "../../../core/game/GameUpdates";
import { UserSettings } from "../../../core/game/UserSettings";
import { Controller } from "../../Controller";
import { AttackRatioEvent } from "../../InputHandler";
import { UIState } from "../../UIState";
import {
  getGamesPlayed,
  renderNumber,
  renderTroops,
  translateText,
} from "../../Utils";
import { GameView } from "../../view";
import { PlayerView } from "../../view/PlayerView";
import { goldCoinIcon, soldierIcon } from "../HotbarIcons";

const swordIcon = assetUrl("images/SwordIcon.svg");

@customElement("control-panel")
export class ControlPanel extends LitElement implements Controller {
  public game: GameView;
  public clientID: ClientID;
  public eventBus: EventBus;
  public uiState: UIState;

  @state() private attackRatio = 0.2;
  @state() private _maxTroops = 0;
  @state() private troopRate = 0;
  @state() private _troops = 0;
  @state() private _isVisible = false;
  @state() private _notification: {
    type: "warning" | "info";
    message: string;
  } | null = null;
  @state() private _gold: Gold = 0n;
  @state() private _attackingTroops = 0;

  @state() private _militaryTier = 0;
  @state() private _militaryLabel = "징집군";
  @state() private _militaryGlyph = "Ⅰ";
  @state() private _militaryQuality = 1;
  @state() private _militaryMaxQuality = 1;
  @state() private _trainingCoverage = 0;
  @state() private _trainingCapacity = 0;
  @state() private _trainedManpower = 0;
  @state() private _totalManpower = 0;
  @state() private _coverageStatus: TrainingCoverageStatus = "완전 훈련";
  @state() private _highestCityLevel = 0;
  @state() private _nextTierLabel: string | null = "훈련군";
  @state() private _nextTierLevel = 3;
  @state() private _cityLevelsToNextTier = 3;

  @state() private _administrativeCapacity = 0;
  @state() private _administrativeEfficiency = 0.4;
  @state() private _territoryTiles = 0;
  @state() private _cityGoldPerSecond = 0;
  @state() private _goldIncome: GoldIncomeBreakdown = {
    baseGoldPerTick: 100,
    cityBaseGoldPerTick: 0,
    administrativeEfficiency: 0.4,
    cityGoldPerTick: 0,
    multiplier: 1,
    totalGoldPerTick: 100,
    totalGoldPerSecond: 1_000,
  };

  @state() private _developmentExpanded = false;
  @state() private _goldBreakdownOpen = false;
  @state() private _tierAnnouncement: {
    from: string;
    to: string;
    maxQuality: number;
    actualQuality: number;
    trainingCapacity: number;
  } | null = null;

  @state() private _goldGain: bigint | null = null;
  @state() private _goldGainPulseId = 0;

  private _goldGainTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private _tierAnnouncementTimeoutId: ReturnType<typeof setTimeout> | null =
    null;
  private _lastMilitaryTier: number | null = null;
  private _lastMilitaryLabel = "징집군";
  private _troopRateIsIncreasing = true;
  private _lastTroopIncreaseRate = 0;

  private _nearbyPlayerIDs: Set<number> = new Set();
  private _borderRefreshCounter = 0;
  private _borderTilesPromise: Promise<void> | null = null;
  private _lastAttackTickByTarget: Map<number, number> = new Map();
  private static readonly BORDER_REFRESH_INTERVAL = 10;
  private static readonly ATTACK_THRESHOLD_TICKS = 15 * 10;

  init() {
    this.attackRatio = new UserSettings().attackRatio();
    this.uiState.attackRatio = this.attackRatio;
    this.eventBus.on(AttackRatioEvent, (event) => {
      this.setAttackRatio(this.attackRatio + event.attackRatio / 100);
    });
  }

  tick() {
    if (!this._isVisible && !this.game.inSpawnPhase()) {
      this.setVisible(true);
    }

    const player = this.game.myPlayer();
    if (player === null || !player.isAlive()) {
      this.setVisible(false);
      return;
    }

    this.updateTroopIncrease();

    const config = this.game.config();
    this._maxTroops = config.maxTroops(player);
    this._gold = player.gold();
    this._troops = player.troops();
    this._attackingTroops = player
      .outgoingAttacks()
      .map((attack) => attack.troops)
      .reduce((sum, troops) => sum + troops, 0);
    this.troopRate = config.troopIncreaseRate(player) * 10;

    const military = militaryProfile(player);
    this.maybeAnnounceTierChange(military.tier, military.label, {
      maxQuality: military.maxQuality,
      actualQuality: military.quality,
      trainingCapacity: military.trainingCapacity,
    });
    this._militaryTier = military.tier;
    this._militaryLabel = military.label;
    this._militaryGlyph = military.glyph;
    this._militaryQuality = military.quality;
    this._militaryMaxQuality = military.maxQuality;
    this._trainingCoverage = military.coverage;
    this._trainingCapacity = military.trainingCapacity;
    this._trainedManpower = military.trainedManpower;
    this._totalManpower = military.totalManpower;
    this._coverageStatus = military.coverageStatus;
    this._highestCityLevel = military.highestCityLevel;
    this._nextTierLabel = military.nextTier?.label ?? null;
    this._nextTierLevel = military.nextTier?.minCityLevel ?? 0;
    this._cityLevelsToNextTier = military.cityLevelsToNextTier;

    const economy = fortressEconomyProfile(player);
    this._administrativeCapacity = economy.administrativeCapacity;
    this._administrativeEfficiency = economy.administrativeEfficiency;
    this._territoryTiles = player.numTilesOwned();
    this._cityGoldPerSecond = economy.cityGoldPerSecond;
    this._goldIncome = config.goldIncomeBreakdown(player);

    const helpEnabled = new UserSettings().helpMessages();
    if (helpEnabled && getGamesPlayed() < 20) {
      this.trackOutgoingAttacks(player);
      this.refreshNearbyPlayers(player);
      this._notification = this.computeNotification(player, config);
    } else {
      this._notification = null;
    }

    const updates = this.game.updatesSinceLastTick();
    if (updates) {
      const myID = player.id();
      for (const event of updates[GameUpdateType.BonusEvent] ?? []) {
        if (event.player === myID && event.gold > 0) {
          this.addGoldGain(BigInt(event.gold));
        }
      }
      for (const event of updates[GameUpdateType.ConquestEvent] ?? []) {
        if (event.conquerorId === myID && event.gold > 0n) {
          this.addGoldGain(event.gold);
        }
      }
      for (const event of updates[GameUpdateType.DonateEvent] ?? []) {
        if (
          event.donationType === "gold" &&
          event.recipientId === myID &&
          event.amount > 0n
        ) {
          this.addGoldGain(event.amount);
        }
      }
    }

    this.requestUpdate();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._goldGainTimeoutId !== null) {
      clearTimeout(this._goldGainTimeoutId);
    }
    if (this._tierAnnouncementTimeoutId !== null) {
      clearTimeout(this._tierAnnouncementTimeoutId);
    }
  }

  private maybeAnnounceTierChange(
    tier: number,
    label: string,
    details: {
      maxQuality: number;
      actualQuality: number;
      trainingCapacity: number;
    },
  ) {
    if (this._lastMilitaryTier === null) {
      this._lastMilitaryTier = tier;
      this._lastMilitaryLabel = label;
      return;
    }
    if (tier > this._lastMilitaryTier) {
      this._tierAnnouncement = {
        from: this._lastMilitaryLabel,
        to: label,
        ...details,
      };
      if (this._tierAnnouncementTimeoutId !== null) {
        clearTimeout(this._tierAnnouncementTimeoutId);
      }
      this._tierAnnouncementTimeoutId = setTimeout(() => {
        this._tierAnnouncement = null;
        this._tierAnnouncementTimeoutId = null;
        this.requestUpdate();
      }, 4_200);
    }
    this._lastMilitaryTier = tier;
    this._lastMilitaryLabel = label;
  }

  private addGoldGain(amount: bigint) {
    this._goldGain = amount;
    this._goldGainPulseId++;
    if (this._goldGainTimeoutId !== null) {
      clearTimeout(this._goldGainTimeoutId);
    }
    this._goldGainTimeoutId = setTimeout(() => {
      this._goldGain = null;
      this._goldGainTimeoutId = null;
      this.requestUpdate();
    }, 2_000);
  }

  private trackOutgoingAttacks(player: PlayerView) {
    const currentTick = this.game.ticks();
    for (const attack of player.outgoingAttacks()) {
      if (attack.targetID !== 0 && !attack.retreating) {
        this._lastAttackTickByTarget.set(attack.targetID, currentTick);
      }
    }
    for (const [playerID, tick] of this._lastAttackTickByTarget.entries()) {
      if (currentTick - tick > ControlPanel.ATTACK_THRESHOLD_TICKS * 2) {
        this._lastAttackTickByTarget.delete(playerID);
      }
    }
  }

  private refreshNearbyPlayers(player: PlayerView) {
    this._borderRefreshCounter++;
    if (
      this._borderRefreshCounter < ControlPanel.BORDER_REFRESH_INTERVAL ||
      this._borderTilesPromise !== null
    ) {
      return;
    }
    this._borderRefreshCounter = 0;
    this._borderTilesPromise = player.borderTiles().then((borderData) => {
      this._borderTilesPromise = null;
      const myID = player.smallID();
      const nearby = new Set<number>();
      for (const tile of borderData.borderTiles) {
        for (const neighbor of this.game.neighbors(tile as TileRef)) {
          const ownerID = this.game.ownerID(neighbor);
          if (ownerID !== 0 && ownerID !== myID) nearby.add(ownerID);
        }
      }
      this._nearbyPlayerIDs = nearby;
    });
  }

  private computeNotification(
    player: PlayerView,
    config: Config,
  ): { type: "warning" | "info"; message: string } | null {
    const currentTick = this.game.ticks();
    const { gameMode, gameType } = config.gameConfig();
    const isPublicTeamGame =
      gameMode === GameMode.Team && gameType === GameType.Public;
    if (isPublicTeamGame && config.donateTroops()) {
      const ratio = this._troops / Math.max(this._maxTroops, 1);
      if (ratio >= config.armyLimitWarningThreshold()) {
        return {
          type: "warning",
          message: "control_panel.army_limit_warning",
        };
      }
    }

    if (this._troops < 10_000 && this._troops > 0) {
      return { type: "warning", message: "control_panel.low_troops_warning" };
    }

    for (const nearbyID of this._nearbyPlayerIDs) {
      let other: PlayerView;
      try {
        other = this.game.playerBySmallID(nearbyID);
      } catch {
        continue;
      }
      if (!other.isPlayer() || !other.isAlive()) continue;
      const lastAttackTick = this._lastAttackTickByTarget.get(nearbyID) ?? -1;
      const secondsSinceAttack = (currentTick - lastAttackTick) / 10;
      if (lastAttackTick >= 0 && secondsSinceAttack <= 15) continue;
      if (other.isTraitor() && player.isAlliedWith(other)) {
        return { type: "info", message: "control_panel.traitor_neighbor_info" };
      }
      if (other.isDisconnected() && player.isAlliedWith(other)) {
        return {
          type: "info",
          message: "control_panel.allied_afk_neighbor_info",
        };
      }
      if (other.isDisconnected() && player.isOnSameTeam(other)) {
        return {
          type: "info",
          message: "control_panel.teammate_afk_neighbor_info",
        };
      }
    }
    return null;
  }

  private updateTroopIncrease() {
    const player = this.game?.myPlayer();
    if (player === null) return;
    const rate = this.game.config().troopIncreaseRate(player);
    this._troopRateIsIncreasing = rate >= this._lastTroopIncreaseRate;
    this._lastTroopIncreaseRate = rate;
  }

  private setAttackRatio(value: number) {
    let next = Math.max(0.01, Math.min(1, value));
    if (next === 0.11 && this.attackRatio === 0.01) next = 0.1;
    this.attackRatio = next;
    this.uiState.attackRatio = next;
  }

  onAttackRatioChange(newRatio: number) {
    this.setAttackRatio(newRatio);
  }

  setVisibile(visible: boolean) {
    this.setVisible(visible);
  }

  private setVisible(visible: boolean) {
    this._isVisible = visible;
    this.requestUpdate();
  }

  private handleRatioSliderInput(event: Event) {
    this.setAttackRatio(Number((event.target as HTMLInputElement).value) / 100);
  }

  private handleRatioSliderPointerUp(event: Event) {
    (event.target as HTMLInputElement).blur();
  }

  private calculateTroopBar(): { home: number; field: number } {
    const base = Math.max(this._maxTroops, 1);
    const home = Math.max(0, Math.min(100, (this._troops / base) * 100));
    const field = Math.max(
      0,
      Math.min(100 - home, (this._attackingTroops / base) * 100),
    );
    return { home, field };
  }

  private coverageTone(): string {
    if (this._trainingCoverage >= 0.9) return "text-emerald-300";
    if (this._trainingCoverage >= 0.6) return "text-sky-300";
    if (this._trainingCoverage >= 0.3) return "text-amber-300";
    return "text-red-300";
  }

  private renderTroopBar(compact = false) {
    const { home, field } = this.calculateTroopBar();
    return html`
      <div
        class="relative w-full overflow-hidden rounded-[3px] border border-white/15 bg-[#080b0f] ${compact
          ? "h-8"
          : "h-9"}"
      >
        <div
          class="absolute inset-y-0 left-0 bg-malibu-blue transition-[width] duration-150"
          style="width:${home}%"
        ></div>
        <div
          class="absolute inset-y-0 bg-aquarius/80 transition-[left,width] duration-150"
          style="left:${home}%;width:${field}%"
        ></div>
        <div
          class="absolute inset-0 flex items-center justify-between px-2 text-xs font-semibold text-white tabular-nums"
          translate="no"
        >
          <span>${renderTroops(this._troops)}</span>
          <span class="flex items-center gap-1 text-white/85">
            <span
              class=${this._troopRateIsIncreasing
                ? "text-emerald-200"
                : "text-amber-200"}
              >+${renderTroops(this.troopRate)}/s</span
            >
            <span class="text-white/45">/</span>
            <span>${renderTroops(this._maxTroops)}</span>
          </span>
        </div>
      </div>
    `;
  }

  private renderNotification() {
    if (!this._notification) return html``;
    const warning = this._notification.type === "warning";
    return html`<div
      class="mb-1 flex items-center gap-2 rounded-[4px] border px-2 py-1.5 text-xs ${warning
        ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
        : "border-sky-300/35 bg-sky-300/10 text-sky-100"}"
    >
      <span aria-hidden="true">${warning ? "!" : "i"}</span>
      <span>${translateText(this._notification.message)}</span>
    </div>`;
  }

  private renderTierAnnouncement() {
    if (!this._tierAnnouncement) return html``;
    return html`
      <div
        class="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+4.25rem)] z-[6100] w-[min(92vw,420px)] -translate-x-1/2 rounded-[6px] border border-malibu-blue/50 bg-[#11171e] px-4 py-3 text-white shadow-[0_12px_28px_rgba(0,0,0,0.35)]"
        role="status"
        aria-live="polite"
      >
        <div class="text-xs font-semibold text-malibu-blue">군사 개혁 완료</div>
        <div class="mt-1 flex items-baseline gap-2 text-base font-semibold">
          <span class="text-white/55">${this._tierAnnouncement.from}</span>
          <span aria-hidden="true">→</span>
          <span>${this._tierAnnouncement.to}</span>
        </div>
        <div class="mt-1 text-xs text-white/55 tabular-nums">
          최대 품질 ×${this._tierAnnouncement.maxQuality.toFixed(2)} · 현재
          ×${this._tierAnnouncement.actualQuality.toFixed(2)} · 훈련
          ${renderTroops(this._tierAnnouncement.trainingCapacity)}
        </div>
      </div>
    `;
  }

  private renderMilitaryDetails() {
    const nextRequirement = this._nextTierLabel
      ? `${this._nextTierLabel} · 최고 도시 Lv${this._nextTierLevel}`
      : "최고 군사 등급 달성";
    return html`
      <div
        class="absolute left-0 right-0 top-full mt-1 rounded-[6px] border border-white/12 bg-[#11171e] p-3 text-left shadow-[0_14px_32px_rgba(0,0,0,0.38)]"
      >
        <div class="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
          <div>
            <div class="text-white/45">병력 품질</div>
            <div class="mt-0.5 font-semibold text-white tabular-nums">
              ×${this._militaryQuality.toFixed(2)} / 최대
              ×${this._militaryMaxQuality.toFixed(2)}
            </div>
          </div>
          <div>
            <div class="text-white/45">훈련 충족률</div>
            <div class="mt-0.5 font-semibold ${this.coverageTone()}">
              ${Math.round(this._trainingCoverage * 100)}% ·
              ${this._coverageStatus}
            </div>
          </div>
          <div>
            <div class="text-white/45">훈련 병력</div>
            <div class="mt-0.5 font-semibold text-white tabular-nums">
              ${renderTroops(this._trainedManpower)} /
              ${renderTroops(this._trainingCapacity)}
            </div>
            <div class="mt-0.5 text-[11px] text-white/35">
              전체 군사 인원 ${renderTroops(this._totalManpower)}
            </div>
          </div>
          <div>
            <div class="text-white/45">다음 군사 등급</div>
            <div class="mt-0.5 font-semibold text-white">
              ${nextRequirement}
            </div>
            ${this._nextTierLabel
              ? html`<div class="mt-0.5 text-[11px] text-white/35">
                  현재 최고 도시 Lv${this._highestCityLevel} ·
                  ${this._cityLevelsToNextTier}레벨 필요
                </div>`
              : null}
          </div>
          <div>
            <div class="text-white/45">도시 금 생산</div>
            <div class="mt-0.5 font-semibold text-yellow-200 tabular-nums">
              +${renderNumber(Math.floor(this._cityGoldPerSecond))}/s
            </div>
          </div>
          <div>
            <div class="text-white/45">행정 효율</div>
            <div class="mt-0.5 font-semibold text-white tabular-nums">
              ${Math.round(this._administrativeEfficiency * 100)}%
            </div>
            <div class="mt-0.5 text-[11px] text-white/35">
              ${renderNumber(this._administrativeCapacity)} / 영토
              ${renderNumber(this._territoryTiles)}
            </div>
            ${this._administrativeEfficiency < 1
              ? html`<div class="mt-0.5 text-[10px] text-amber-200/80">
                  도시 금 생산 ${Math.round(
                    (1 - this._administrativeEfficiency) * 100,
                  )}% 감소
                </div>`
              : this._administrativeEfficiency > 1
                ? html`<div class="mt-0.5 text-[10px] text-emerald-200/80">
                    밀집 행정 보너스
                    +${Math.round(
                      (this._administrativeEfficiency - 1) * 100,
                    )}%
                  </div>`
                : null}
          </div>
        </div>
        <div class="mt-3 h-1 overflow-hidden rounded-full bg-white/8">
          <div
            class="h-full bg-malibu-blue transition-[width] duration-150"
            style="width:${Math.round(this._trainingCoverage * 100)}%"
          ></div>
        </div>
      </div>
    `;
  }

  private renderMilitaryStatus() {
    return html`
      <div
        class="pointer-events-auto fixed left-1/2 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[6000] w-[min(92vw,390px)] -translate-x-1/2"
      >
        <button
          type="button"
          aria-expanded=${this._developmentExpanded}
          @click=${() => {
            this._developmentExpanded = !this._developmentExpanded;
            if (this._developmentExpanded) this._goldBreakdownOpen = false;
          }}
          class="fortress-control flex min-h-11 w-full items-center gap-3 rounded-[6px] border border-white/15 bg-[#11171e]/95 px-3 text-left shadow-[0_8px_22px_rgba(0,0,0,0.28)] transition-[background-color,border-color,transform] duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-malibu-blue/35"
        >
          <span
            class="flex h-7 min-w-7 items-center justify-center rounded-[3px] border border-malibu-blue/50 bg-malibu-blue/10 px-1 text-xs font-bold text-sky-200"
            aria-hidden="true"
            >${this._militaryGlyph}</span
          >
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline gap-2">
              <strong class="truncate text-sm font-semibold text-white"
                >${this._militaryLabel}</strong
              >
              <span class="text-sm font-semibold text-sky-200 tabular-nums"
                >×${this._militaryQuality.toFixed(2)}</span
              >
            </span>
            <span class="mt-0.5 block truncate text-[11px] text-white/45">
              훈련 ${renderTroops(this._trainedManpower)} /
              ${renderTroops(this._trainingCapacity)} ·
              <span class=${this.coverageTone()}>${this._coverageStatus}</span>
            </span>
          </span>
          <span
            class="text-sm text-white/40 transition-transform duration-150 ${this
              ._developmentExpanded
              ? "rotate-180"
              : ""}"
            aria-hidden="true"
            >⌄</span
          >
        </button>
        ${this._developmentExpanded ? this.renderMilitaryDetails() : html``}
      </div>
    `;
  }

  private renderGoldBreakdown() {
    if (!this._goldBreakdownOpen) return html``;
    const basePerSecond =
      this._goldIncome.baseGoldPerTick * 10 * this._goldIncome.multiplier;
    const cityBasePerSecond = this._goldIncome.cityBaseGoldPerTick * 10;
    const cityFinalPerSecond =
      this._goldIncome.cityGoldPerTick * 10 * this._goldIncome.multiplier;
    return html`
      <div
        class="absolute bottom-full left-2 right-2 mb-2 rounded-[6px] border border-white/12 bg-[#11171e] p-3 text-xs text-white shadow-[0_14px_32px_rgba(0,0,0,0.38)] sm:left-auto sm:w-72"
      >
        <div class="mb-2 flex items-center justify-between">
          <span class="font-semibold">총 금 수입</span>
          <span class="font-semibold text-yellow-200 tabular-nums"
            >+${renderNumber(Math.floor(this._goldIncome.totalGoldPerSecond))}/s</span
          >
        </div>
        <div class="space-y-1.5 text-white/65 tabular-nums">
          <div class="flex justify-between">
            <span>기본 생산</span><span>${renderNumber(basePerSecond)}/s</span>
          </div>
          <div class="flex justify-between">
            <span>도시 기본 생산</span
            ><span>${renderNumber(cityBasePerSecond)}/s</span>
          </div>
          <div class="flex justify-between">
            <span>행정 효율</span
            ><span>×${this._goldIncome.administrativeEfficiency.toFixed(2)}</span>
          </div>
          <div class="flex justify-between text-white">
            <span>도시 적용 생산</span
            ><span>${renderNumber(Math.floor(cityFinalPerSecond))}/s</span>
          </div>
          ${this._goldIncome.multiplier !== 1
            ? html`<div class="flex justify-between text-sky-200">
                <span>경기 금 배율</span
                ><span>×${this._goldIncome.multiplier.toFixed(2)}</span>
              </div>`
            : null}
        </div>
        <div class="mt-2 border-t border-white/8 pt-2 text-[11px] text-white/35">
          철도·해상 교역, 기부, 정복 보상은 발생 시 별도로 추가됩니다.
        </div>
      </div>
    `;
  }

  private renderGoldButton(compact = false) {
    return html`
      <button
        type="button"
        aria-label="금 수입 내역"
        aria-expanded=${this._goldBreakdownOpen}
        @click=${() => {
          this._goldBreakdownOpen = !this._goldBreakdownOpen;
          if (this._goldBreakdownOpen) this._developmentExpanded = false;
        }}
        class="fortress-control relative flex min-h-11 items-center justify-center gap-1.5 rounded-[4px] border border-yellow-300/35 bg-yellow-300/5 px-2 font-semibold text-yellow-200 transition-[background-color,border-color,transform] duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/25 ${compact
          ? "min-w-20 text-xs"
          : "min-w-28 text-sm"}"
        translate="no"
      >
        ${this._goldGain !== null
          ? keyed(
              this._goldGainPulseId,
              html`<span
                class="gold-gain-pop pointer-events-none absolute -top-5 right-1 text-xs font-bold text-emerald-300 tabular-nums"
                >+${renderNumber(this._goldGain)}</span
              >`,
            )
          : ""}
        <img src=${goldCoinIcon} width="14" height="14" alt="" />
        <span class="tabular-nums">${renderNumber(this._gold)}</span>
        <span class="text-[10px] text-yellow-100/45" aria-hidden="true">⌃</span>
      </button>
    `;
  }

  private renderAttackSlider() {
    return html`
      <input
        type="range"
        min="1"
        max="100"
        aria-label="공격 투입 비율"
        .value=${String(Math.round(this.attackRatio * 100))}
        @input=${this.handleRatioSliderInput}
        @pointerup=${this.handleRatioSliderPointerUp}
        class="fortress-range h-11 min-w-0 flex-1 cursor-pointer accent-aquarius focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-malibu-blue/30"
      />
    `;
  }

  private renderDesktop() {
    return html`
      ${this.renderNotification()}
      <div class="flex items-center gap-2">
        <div
          class="flex min-h-11 min-w-24 items-center gap-1.5 rounded-[4px] border px-2 text-xs font-semibold tabular-nums ${this
            ._troopRateIsIncreasing
            ? "border-emerald-300/35 text-emerald-200"
            : "border-amber-300/35 text-amber-200"}"
          translate="no"
        >
          <img src=${soldierIcon} width="14" height="14" alt="" />
          +${renderTroops(this.troopRate)}/s
        </div>
        <div class="min-w-0 flex-1">${this.renderTroopBar()}</div>
        ${this.renderGoldButton()}
      </div>
      <div class="mt-2 flex min-h-11 items-center gap-2" translate="no">
        <div
          class="flex min-h-11 min-w-32 items-center gap-2 rounded-[4px] border border-white/12 bg-[#0d1116] px-2 text-sm font-semibold text-white"
        >
          <img
            src=${swordIcon}
            alt=""
            width="14"
            height="14"
            class="brightness-0 invert"
          />
          <span class="tabular-nums">${Math.round(this.attackRatio * 100)}%</span>
          <span class="text-xs text-white/45 tabular-nums">
            ${renderTroops(this._troops * this.attackRatio)}
          </span>
        </div>
        ${this.renderAttackSlider()}
      </div>
    `;
  }

  private renderMobile() {
    return html`
      ${this.renderNotification()}
      <div class="flex items-center gap-2">
        <div class="min-w-0 flex-1">${this.renderTroopBar(true)}</div>
        ${this.renderGoldButton(true)}
      </div>
      <div class="mt-2 grid grid-cols-[44px_minmax(0,1fr)_44px_54px] gap-1.5">
        <button
          type="button"
          aria-label="공격 비율 10% 감소"
          @click=${() => this.setAttackRatio(this.attackRatio - 0.1)}
          class="fortress-control min-h-11 rounded-[4px] border border-white/15 bg-[#0d1116] text-lg font-semibold text-white/75 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-malibu-blue/30"
        >
          −
        </button>
        ${this.renderAttackSlider()}
        <button
          type="button"
          aria-label="공격 비율 10% 증가"
          @click=${() => this.setAttackRatio(this.attackRatio + 0.1)}
          class="fortress-control min-h-11 rounded-[4px] border border-white/15 bg-[#0d1116] text-lg font-semibold text-white/75 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-malibu-blue/30"
        >
          +
        </button>
        <div
          class="flex min-h-11 items-center justify-center rounded-[4px] border border-white/12 bg-[#0d1116] text-sm font-semibold text-white tabular-nums"
          translate="no"
        >
          ${Math.round(this.attackRatio * 100)}%
        </div>
      </div>
    `;
  }

  render() {
    if (!this._isVisible) return html``;
    return html`
      <style>
        @keyframes gold-gain-pop {
          from {
            transform: translateY(3px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .gold-gain-pop {
          animation: gold-gain-pop 160ms ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .gold-gain-pop {
            animation: none;
          }
        }
      </style>
      ${this.renderMilitaryStatus()} ${this.renderTierAnnouncement()}
      <div
        class="relative w-full px-2 py-2 text-sm"
        @contextmenu=${(event: MouseEvent) => event.preventDefault()}
      >
        ${this.renderGoldBreakdown()}
        <div class="lg:hidden">${this.renderMobile()}</div>
        <div class="hidden lg:block">${this.renderDesktop()}</div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
