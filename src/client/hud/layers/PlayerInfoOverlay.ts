import { html, LitElement, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { assetUrl } from "../../../core/AssetUrls";
import { EventBus } from "../../../core/EventBus";
import {
  PlayerProfile,
  PlayerType,
  Relation,
  Unit,
  UnitType,
} from "../../../core/game/Game";
import {
  cityBaseGoldPerTick,
  cityUpgradePreview,
  fortressEconomyProfile,
  militaryProfile,
} from "../../../core/game/FortressBalance";
import { TileRef } from "../../../core/game/GameMap";
import { AllianceView } from "../../../core/game/GameUpdates";
import { Controller } from "../../Controller";
import {
  ContextMenuEvent,
  MouseMoveEvent,
  TouchEvent,
} from "../../InputHandler";
import { themeProvider } from "../../theme/ThemeProvider";
import { TransformHandler } from "../../TransformHandler";
import {
  getTranslatedPlayerTeamLabel,
  renderDuration,
  renderNumber,
  renderTroops,
  translateText,
} from "../../Utils";
import { GameView, PlayerView, UnitView } from "../../view";
import {
  EMOJI_ICON_KIND,
  getFirstPlacePlayer,
  getPlayerIcons,
  IMAGE_ICON_KIND,
} from "../PlayerIcons";
import { ImmunityBarVisibleEvent } from "./ImmunityTimer";
import { CloseRadialMenuEvent } from "./RadialMenu";
import "./RelationSmiley";
import { SpawnBarVisibleEvent } from "./SpawnTimer";
const soldierIconAquarius = assetUrl("images/SoldierIconAquarius.svg");
const allianceIcon = assetUrl("images/AllianceIcon.svg");
const warshipIcon = assetUrl("images/BattleshipIconWhite.svg");
const cityIcon = assetUrl("images/CityIconWhite.svg");
const factoryIcon = assetUrl("images/FactoryIconWhite.svg");
const goldCoinIcon = assetUrl("images/GoldCoinIcon.svg");
const missileSiloIcon = assetUrl("images/MissileSiloIconWhite.svg");
const portIcon = assetUrl("images/PortIcon.svg");
const samLauncherIcon = assetUrl("images/SamLauncherIconWhite.svg");
const soldierIcon = assetUrl("images/SoldierIcon.svg");

function euclideanDistWorld(
  coord: { x: number; y: number },
  tileRef: TileRef,
  game: GameView,
): number {
  const x = game.x(tileRef);
  const y = game.y(tileRef);
  const dx = coord.x - x;
  const dy = coord.y - y;
  return Math.sqrt(dx * dx + dy * dy);
}

function distSortUnitWorld(coord: { x: number; y: number }, game: GameView) {
  return (a: Unit | UnitView, b: Unit | UnitView) => {
    const distA = euclideanDistWorld(coord, a.tile(), game);
    const distB = euclideanDistWorld(coord, b.tile(), game);
    return distA - distB;
  };
}

@customElement("player-info-overlay")
export class PlayerInfoOverlay extends LitElement implements Controller {
  @property({ type: Object })
  public game!: GameView;

  @property({ type: Object })
  public eventBus!: EventBus;

  @property({ type: Object })
  public transform!: TransformHandler;

  @state()
  private player: PlayerView | null = null;

  @state()
  private playerProfile: PlayerProfile | null = null;

  @state()
  private unit: UnitView | null = null;

  @state()
  private _isInfoVisible: boolean = false;

  @state()
  private spawnBarVisible = false;
  @state()
  private immunityBarVisible = false;

  private _isActive = false;

  private get barOffset(): number {
    return (this.spawnBarVisible ? 7 : 0) + (this.immunityBarVisible ? 7 : 0);
  }

  private lastMouseUpdate = 0;

  init() {
    this.eventBus.on(MouseMoveEvent, (e: MouseMoveEvent) =>
      this.onMouseEvent(e),
    );
    this.eventBus.on(ContextMenuEvent, (e: ContextMenuEvent) =>
      this.maybeShow(e.x, e.y),
    );
    this.eventBus.on(TouchEvent, (e: TouchEvent) => this.maybeShow(e.x, e.y));
    this.eventBus.on(CloseRadialMenuEvent, () => this.hide());
    this.eventBus.on(SpawnBarVisibleEvent, (e) => {
      this.spawnBarVisible = e.visible;
    });
    this.eventBus.on(ImmunityBarVisibleEvent, (e) => {
      this.immunityBarVisible = e.visible;
    });
    this._isActive = true;
  }

  private onMouseEvent(event: MouseMoveEvent) {
    const now = Date.now();
    if (now - this.lastMouseUpdate < 100) {
      return;
    }
    this.lastMouseUpdate = now;
    this.maybeShow(event.x, event.y);
  }

  public hide() {
    this.setVisible(false);
    this.unit = null;
    this.player = null;
    this.playerProfile = null;
  }

  public maybeShow(x: number, y: number) {
    this.hide();
    const worldCoord = this.transform.screenToWorldCoordinates(x, y);
    if (!this.game.isValidCoord(worldCoord.x, worldCoord.y)) {
      return;
    }

    const tile = this.game.ref(worldCoord.x, worldCoord.y);
    if (!tile) return;

    const owner = this.game.owner(tile);

    if (owner && owner.isPlayer()) {
      this.player = owner as PlayerView;
      this.unit =
        this.game
          .units(UnitType.City)
          .find((candidate) => candidate.tile() === tile) ?? null;
      this.player.profile().then((profile) => {
        if (this.player === owner) this.playerProfile = profile;
      });
      this.setVisible(true);
    } else if (!this.game.isLand(tile)) {
      const units = this.game
        .units(UnitType.Warship, UnitType.TradeShip, UnitType.TransportShip)
        .filter((u) => euclideanDistWorld(worldCoord, u.tile(), this.game) < 50)
        .sort(distSortUnitWorld(worldCoord, this.game));

      if (units.length > 0) {
        this.unit = units[0];
        this.setVisible(true);
      }
    }
  }

  tick() {
    this.requestUpdate();
  }

  setVisible(visible: boolean) {
    this._isInfoVisible = visible;
    this.requestUpdate();
  }

  private getPlayerNameColor(isFriendly: boolean): string {
    if (isFriendly) return "text-green-500";
    return "text-white";
  }

  private getRelationSmiley(
    player: PlayerView,
    myPlayer: PlayerView | null | undefined,
  ): TemplateResult | string {
    if (!myPlayer || myPlayer === player || player.type() !== PlayerType.Nation)
      return "";
    const relation =
      this.playerProfile?.relations[myPlayer.smallID()] ?? Relation.Neutral;
    if (relation === Relation.Neutral) return "";
    return html`<relation-smiley .relation=${relation}></relation-smiley>`;
  }

  private getRelationName(relation: Relation): string {
    switch (relation) {
      case Relation.Hostile:
        return translateText("relation.hostile");
      case Relation.Distrustful:
        return translateText("relation.distrustful");
      case Relation.Neutral:
        return translateText("relation.neutral");
      case Relation.Friendly:
        return translateText("relation.friendly");
      default:
        return translateText("relation.default");
    }
  }

  private displayUnitCount(player: PlayerView, type: UnitType, icon: string) {
    return !this.game.config().isUnitDisabled(type)
      ? html`<div
          class="flex items-center justify-center gap-0.5 lg:gap-1 p-0.5 lg:p-1 border rounded-[3px] border-white/15 bg-[#0d1116] text-[10px] lg:text-xs w-9 lg:w-12 h-6 lg:h-7"
          translate="no"
        >
          <img
            src=${icon}
            class="w-3 h-3 lg:w-4 lg:h-4 object-contain shrink-0"
          />
          <span>${player.totalUnitLevels(type)}</span>
        </div>`
      : "";
  }

  private allianceExpirationText(alliance: AllianceView) {
    const { expiresAt } = alliance;
    const remainingTicks = expiresAt - this.game.ticks();
    let remainingSeconds = 0;
    if (remainingTicks > 0) {
      remainingSeconds = Math.max(0, Math.floor(remainingTicks / 10)); // 10 ticks per second
    }
    return renderDuration(remainingSeconds);
  }

  private renderPlayerNameIcons(player: PlayerView) {
    const firstPlace = getFirstPlacePlayer(this.game);
    const icons = getPlayerIcons({
      game: this.game,
      player,
      firstPlace,
    });

    if (icons.length === 0) {
      return html``;
    }

    return html`<span class="flex items-center gap-1 ml-1 shrink-0">
      ${icons.map((icon) =>
        icon.kind === EMOJI_ICON_KIND && icon.text
          ? html`<span class="text-sm shrink-0" translate="no"
              >${icon.text}</span
            >`
          : icon.kind === IMAGE_ICON_KIND && icon.src
            ? html`<img src=${icon.src} alt="" class="w-4 h-4 shrink-0" />`
            : html``,
      )}
    </span>`;
  }

  private relativeAssessment(ownPower: number, enemyPower: number): string {
    const ratio = ownPower / Math.max(1, enemyPower);
    if (ratio >= 1.55) return "크게 우세";
    if (ratio >= 1.12) return "우세";
    if (ratio >= 0.88) return "비등";
    if (ratio >= 0.64) return "불리";
    return "크게 불리";
  }

  private assessmentTone(assessment: string): string {
    if (assessment === "크게 우세") return "text-emerald-200";
    if (assessment === "우세") return "text-sky-200";
    if (assessment === "비등") return "text-white/70";
    if (assessment === "불리") return "text-amber-200";
    return "text-red-200";
  }

  private renderMilitaryComparison(player: PlayerView): TemplateResult {
    const profile = militaryProfile(player);
    const myPlayer = this.game.myPlayer();
    const myProfile = myPlayer ? militaryProfile(myPlayer) : null;
    const assessment =
      myPlayer && myPlayer !== player && myProfile
        ? this.relativeAssessment(
            myProfile.totalManpower * myProfile.quality,
            profile.totalManpower * profile.quality,
          )
        : null;

    return html`<div
      class="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-white/10 pt-2"
    >
      <div class="min-w-0">
        <div class="flex items-baseline gap-2">
          <span
            class="flex min-w-6 items-center justify-center rounded-[3px] border border-malibu-blue/45 bg-malibu-blue/10 px-1 text-[10px] font-bold text-sky-200"
            aria-hidden="true"
            >${profile.glyph}</span
          >
          <strong class="truncate text-xs font-semibold text-white"
            >${profile.label}</strong
          >
          <span class="text-xs font-semibold text-sky-200 tabular-nums"
            >×${profile.quality.toFixed(2)}</span
          >
          <span class="text-[10px] text-white/35 tabular-nums"
            >/ ×${profile.maxQuality.toFixed(2)}</span
          >
        </div>
        <div class="mt-1 text-[10px] text-white/45 tabular-nums">
          훈련 ${renderTroops(profile.trainedManpower)} /
          ${renderTroops(profile.trainingCapacity)} · ${profile.coverageStatus}
        </div>
      </div>
      ${assessment
        ? html`<div class="text-right">
            <div class="text-[10px] text-white/35">상대 전투력</div>
            <div
              class="mt-0.5 text-xs font-semibold ${this.assessmentTone(
                assessment,
              )}"
            >
              ${assessment}
            </div>
          </div>`
        : html``}
    </div>`;
  }

  private renderSelectedCityInfo(player: PlayerView): TemplateResult | string {
    const city =
      this.unit?.type() === UnitType.City && this.unit.owner() === player
        ? this.unit
        : null;
    if (!city) return "";

    const economy = fortressEconomyProfile(player);
    const preview = cityUpgradePreview(player, city.level());
    const cityAppliedPerSecond =
      cityBaseGoldPerTick(city.level()) *
      economy.administrativeEfficiency *
      10;
    const tierResult = preview.unlocksTier
      ? `${preview.currentTier.label} → ${preview.nextTier.label}`
      : preview.followingTier
        ? `${preview.nextTier.label} 유지 · ${preview.followingTier.label}까지 ${preview.levelsToFollowingTier}레벨`
        : `${preview.nextTier.label} · 최고 등급`;

    return html`<section
      class="mt-2 border-t border-white/10 pt-2 text-[11px]"
      aria-label="선택한 도시 발전 정보"
    >
      <div class="flex items-center justify-between gap-3">
        <strong class="text-xs text-white">도시 Lv${city.level()}</strong>
        <span class="text-yellow-200 tabular-nums"
          >+${renderNumber(Math.floor(cityAppliedPerSecond))}/s</span
        >
      </div>
      <div class="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-white/50 tabular-nums">
        <span>기본 생산</span>
        <span class="text-right text-white/75"
          >${renderNumber(preview.currentCityBaseGoldPerSecond)}/s</span
        >
        <span>행정 효율 적용</span>
        <span class="text-right text-white/75"
          >${Math.round(economy.administrativeEfficiency * 100)}%</span
        >
        <span>다음 레벨 비용</span>
        <span class="text-right text-yellow-200"
          >${renderNumber(preview.cost)}</span
        >
        <span>다음 도시 생산</span>
        <span class="text-right text-sky-200"
          >${renderNumber(preview.nextCityBaseGoldPerSecond)}/s</span
        >
        <span>최대 병력</span>
        <span class="text-right text-white/75"
          >${renderTroops(preview.currentMaxTroopsFromCities)} →
          ${renderTroops(preview.nextMaxTroopsFromCities)}</span
        >
      </div>
      <div class="mt-2 border-l-2 border-malibu-blue/60 pl-2 text-white/60">
        ${tierResult}
      </div>
    </section>`;
  }

  private renderPlayerInfo(player: PlayerView) {
    const myPlayer = this.game.myPlayer();
    const isFriendly = myPlayer?.isFriendly(player);
    const isAllied = myPlayer?.isAlliedWith(player);
    let allianceHtml: TemplateResult | null = null;
    const maxTroops = this.game.config().maxTroops(player);
    const attackingTroops = player
      .outgoingAttacks()
      .map((a) => a.troops)
      .reduce((a, b) => a + b, 0);
    const totalTroops = player.troops();

    if (isAllied) {
      const alliance = myPlayer
        ?.alliances()
        .find((alliance) => alliance.other === player.id());
      if (alliance !== undefined) {
        allianceHtml = html` <div
          class="flex items-center ml-auto mr-0 gap-1 text-sm font-bold leading-tight"
        >
          <img src=${allianceIcon} width="20" height="20" />
          ${this.allianceExpirationText(alliance)}
        </div>`;
      }
    }
    let playerType = "";
    switch (player.type()) {
      case PlayerType.Bot:
        playerType = translateText("player_type.bot");
        break;
      case PlayerType.Nation:
        playerType = translateText("player_type.nation");
        break;
      case PlayerType.Human:
        playerType = translateText("player_type.player");
        break;
    }
    const playerTeam = getTranslatedPlayerTeamLabel(player.team());

    return html`
      <div class="flex flex-col gap-2 p-2 sm:flex-row sm:items-start sm:gap-3">
        <!-- Left: Gold & Troop bar -->
        <div class="flex w-full shrink-0 flex-col gap-1 sm:w-36">
          <div class="flex items-center gap-1">
            <div
              class="flex items-center justify-center px-1 py-0.5 border rounded-[3px] border-yellow-400/50 bg-yellow-300/5 font-semibold text-yellow-200 text-sm lg:gap-1"
              translate="no"
            >
              <img src=${goldCoinIcon} width="13" height="13" />
              <span class="px-0.5">${renderNumber(player.gold())}</span>
            </div>
            <div
              class="flex flex-1 flex-col items-center justify-center text-xs font-bold ${attackingTroops >
              0
                ? "text-aquarius"
                : "text-white/40"} drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
              translate="no"
            >
              <span class="flex items-center gap-px leading-none text-xs"
                ><img
                  class="w-2.5 h-2.5 inline-block ${attackingTroops > 0
                    ? ""
                    : "brightness-0 invert opacity-40"}"
                  src=${attackingTroops > 0 ? soldierIconAquarius : soldierIcon}
                  alt=""
                  aria-hidden="true"
                />↑</span
              >
              <span class="tabular-nums leading-none text-sm mt-0.5"
                >${renderTroops(attackingTroops)}</span
              >
            </div>
          </div>
          <div class="w-full" translate="no">
            ${this.renderTroopBar(totalTroops, attackingTroops, maxTroops)}
          </div>
        </div>
        <!-- Right: Player identity + Units below -->
        <div class="flex min-w-0 flex-1 flex-col justify-between self-stretch">
          <div
            class="flex items-center gap-2 font-bold text-sm lg:text-lg ${this.getPlayerNameColor(
              isFriendly ?? false,
            )}"
          >
            ${player.cosmetics.flag
              ? html`<img
                  class="h-6 object-contain"
                  src=${assetUrl(player.cosmetics.flag!)}
                />`
              : html``}
            <span>${player.displayName()}</span>
            ${this.getRelationSmiley(player, myPlayer)}
            ${playerTeam !== "" && player.type() !== PlayerType.Bot
              ? html`<div class="flex flex-col leading-tight">
                  <span class="text-gray-400 text-xs font-normal"
                    >${playerType}</span
                  >
                  <span class="text-xs font-normal text-gray-400"
                    >[<span
                      style="color: ${themeProvider
                        .current()
                        .teamColor(player.team()!)
                        .toHex()}"
                      >${playerTeam}</span
                    >]</span
                  >
                </div>`
              : html`<span class="text-gray-400 text-xs font-normal"
                  >${playerType}</span
                >`}
            ${this.renderPlayerNameIcons(player)} ${allianceHtml ?? ""}
          </div>
          <div class="flex gap-0.5 lg:gap-1 items-center mt-0.5">
            ${this.displayUnitCount(player, UnitType.City, cityIcon)}
            ${this.displayUnitCount(player, UnitType.Factory, factoryIcon)}
            ${this.displayUnitCount(player, UnitType.Port, portIcon)}
            ${this.displayUnitCount(
              player,
              UnitType.MissileSilo,
              missileSiloIcon,
            )}
            ${this.displayUnitCount(
              player,
              UnitType.SAMLauncher,
              samLauncherIcon,
            )}
            ${this.displayUnitCount(player, UnitType.Warship, warshipIcon)}
          </div>
          ${this.renderMilitaryComparison(player)}
          ${this.renderSelectedCityInfo(player)}
        </div>
      </div>
    `;
  }

  private renderTroopBar(
    totalTroops: number,
    attackingTroops: number,
    maxTroops: number,
  ) {
    const base = Math.max(maxTroops, 1);
    const greenPercentRaw = (totalTroops / base) * 100;
    const orangePercentRaw = (attackingTroops / base) * 100;

    const greenPercent = Math.max(0, Math.min(100, greenPercentRaw));
    const orangePercent = Math.max(
      0,
      Math.min(100 - greenPercent, orangePercentRaw),
    );

    return html`
      <div
        class="w-full h-5 lg:h-6 border border-white/15 rounded-[3px] bg-[#080b0f] overflow-hidden relative"
      >
        <div class="relative h-full">
          <div
            class="absolute inset-y-0 left-0 w-full origin-left bg-sky-700 transition-transform duration-200 ease-out"
            style="transform: scaleX(${greenPercent / 100});"
          ></div>
          <div
            class="absolute inset-y-0 left-0 w-full origin-left bg-malibu-blue transition-transform duration-200 ease-out"
            style="transform: translateX(${greenPercent}%) scaleX(${orangePercent /
            100});"
          ></div>
        </div>
        <div
          class="absolute inset-0 flex items-center justify-between px-1.5 text-sm font-bold leading-none pointer-events-none"
          translate="no"
        >
          <span class="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
            >${renderTroops(totalTroops)}</span
          >
          <span class="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
            >${renderTroops(maxTroops)}</span
          >
        </div>
        <img
          src=${soldierIcon}
          alt=""
          aria-hidden="true"
          width="14"
          height="14"
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 brightness-0 invert drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] pointer-events-none"
        />
      </div>
    `;
  }

  private renderUnitInfo(unit: UnitView) {
    const isAlly =
      (unit.owner() === this.game.myPlayer() ||
        this.game.myPlayer()?.isFriendly(unit.owner())) ??
      false;

    return html`
      <div class="p-2">
        <div class="font-bold mb-1 ${isAlly ? "text-green-500" : "text-white"}">
          ${unit.owner().displayName()}
        </div>
        <div class="mt-1">
          <div class="text-sm opacity-80">${unit.type()}</div>
          ${unit.hasHealth()
            ? html` <div class="text-sm">Health: ${unit.health()}</div> `
            : ""}
          ${unit.type() === UnitType.TransportShip
            ? html`
                <div class="text-sm">
                  Troops: ${renderTroops(unit.troops())}
                </div>
              `
            : ""}
        </div>
      </div>
    `;
  }

  render() {
    if (!this._isActive) {
      return html``;
    }

    const containerClasses = this._isInfoVisible
      ? "opacity-100 visible"
      : "opacity-0 invisible pointer-events-none";

    return html`
      <div
        class="fixed top-0 left-0 right-0 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[1001]"
        style="margin-top: ${this.barOffset}px;"
        @click=${() => this.hide()}
        @contextmenu=${(e: MouseEvent) => e.preventDefault()}
      >
        <div
          class="border-b border-white/12 bg-[#11171e]/96 text-white text-lg lg:text-base w-full sm:w-[min(94vw,620px)] sm:rounded-b-[6px] sm:border-x overflow-hidden shadow-[0_10px_28px_rgba(0,0,0,0.32)] ${containerClasses}"
        >
          ${this.player !== null ? this.renderPlayerInfo(this.player) : ""}
          ${this.unit !== null ? this.renderUnitInfo(this.unit) : ""}
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    return this; // Disable shadow DOM to allow Tailwind styles
  }
}
