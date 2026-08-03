import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import Countries from "resources/countries.json" with { type: "json" };
import { assetUrl } from "../../../core/AssetUrls";
import { EventBus } from "../../../core/EventBus";
import {
  AllPlayers,
  GameType,
  PlayerActions,
  PlayerProfile,
  PlayerType,
  Relation,
  UnitType,
} from "../../../core/game/Game";
import { TileRef } from "../../../core/game/GameMap";
import { Emoji, flattenedEmojiTable } from "../../../core/Util";
import { fetchLobbyListed } from "../../Api";
import { actionButton } from "../../components/ui/ActionButton";
import "../../components/ui/Divider";
import { Controller } from "../../Controller";
import {
  CloseViewEvent,
  MouseUpEvent,
  SwapRocketDirectionEvent,
} from "../../InputHandler";
import {
  SendAllianceRequestIntentEvent,
  SendAttackIntentEvent,
  SendBoatAttackIntentEvent,
  SendBreakAllianceIntentEvent,
  SendEmbargoAllIntentEvent,
  SendEmbargoIntentEvent,
  SendEmojiIntentEvent,
  SendQuickChatEvent,
  SendTargetPlayerIntentEvent,
} from "../../Transport";
import { UIState } from "../../UIState";
import {
  renderDuration,
  renderNumber,
  renderTroops,
  translateText,
} from "../../Utils";
import { GameView, PlayerView } from "../../view";
import { ChatModal } from "./ChatModal";
import { EmojiTable } from "./EmojiTable";
import "./PlayerModerationModal";
import "./SendResourceModal";
const allianceIcon = assetUrl("images/AllianceIconWhite.svg");
const boatIcon = assetUrl("images/BoatIconWhite.svg");
const chatIcon = assetUrl("images/ChatIconWhite.svg");
const donateGoldIcon = assetUrl("images/DonateGoldIconWhite.svg");
const donateTroopIcon = assetUrl("images/DonateTroopIconWhite.svg");
const emojiIcon = assetUrl("images/EmojiIconWhite.svg");
const shieldIcon = assetUrl("images/ShieldIconWhite.svg");
const stopTradingIcon = assetUrl("images/StopIconWhite.png");
const targetIcon = assetUrl("images/TargetIconWhite.svg");
const startTradingIcon = assetUrl("images/TradingIconWhite.png");
const traitorIcon = assetUrl("images/TraitorIconLightRed.svg");
const breakAllianceIcon = assetUrl("images/TraitorIconWhite.svg");
const goldIcon = assetUrl("images/GoldCoinIcon.svg");
const troopIcon = assetUrl("images/TroopIconWhite.svg");

const COMMAND_ACTION_REFRESH_INTERVAL_TICKS = 5;

@customElement("player-panel")
export class PlayerPanel extends LitElement implements Controller {
  public g: GameView;
  public eventBus: EventBus;
  public emojiTable: EmojiTable;
  public uiState: UIState;

  private actions: PlayerActions | null = null;
  private tile: TileRef | null = null;
  private _profileForPlayerId: number | null = null;
  private kickedPlayerIDs = new Set<string>();
  private selectionRevision = 0;
  private actionsRefreshInFlight = false;
  private nextActionsRefreshTick = 0;

  @state() private selectedPlayer: PlayerView | null = null;
  @state() private sendTarget: PlayerView | null = null;
  @state() private sendMode: "troops" | "gold" | "none" = "none";
  @state() public isVisible: boolean = false;
  @state() private allianceExpiryText: string | null = null;
  @state() private allianceExpirySeconds: number | null = null;
  @state() private otherProfile: PlayerProfile | null = null;
  @state() private suppressNextHide: boolean = false;
  @state() private moderationTarget: PlayerView | null = null;
  @state() private playerRole: string | null = null;
  // Whether this game is a publicly listed lobby. Kept out of
  // GameStartInfo (never touches records), so it's fetched from the worker.
  @state() private gameListed = false;
  @state() private detailsExpanded = false;
  @state() private selectionLoading = false;

  setRole(role: string | null): void {
    this.playerRole = role;
  }

  private get isAdminRole(): boolean {
    return this.playerRole === "admin" || this.playerRole === "root";
  }

  private ctModal: ChatModal;

  createRenderRoot() {
    return this;
  }

  initEventBus(eventBus: EventBus) {
    this.eventBus = eventBus;
    eventBus.on(CloseViewEvent, (e) => {
      if (this.isVisible) {
        this.hide();
      }
    });
    eventBus.on(SwapRocketDirectionEvent, (event) => {
      this.uiState.rocketDirectionUp = event.rocketDirectionUp;
      this.requestUpdate();
    });
  }
  init() {
    this.eventBus.on(MouseUpEvent, () => {
      if (this.suppressNextHide) {
        this.suppressNextHide = false;
        return;
      }
      this.hide();
    });

    this.ctModal = document.querySelector("chat-modal") as ChatModal;
    if (!this.ctModal) {
      console.warn("ChatModal element not found in DOM");
    }

    // Only private games can be listed.
    if (this.g.config().gameConfig().gameType === GameType.Private) {
      void fetchLobbyListed(this.g.gameID()).then((listed) => {
        this.gameListed = listed;
      });
    }
  }

  private updateAllianceExpiry() {
    const expiresAt = this.actions?.interaction?.allianceInfo?.expiresAt;
    if (expiresAt === undefined) {
      this.allianceExpirySeconds = null;
      this.allianceExpiryText = null;
      return;
    }

    const remainingTicks = expiresAt - this.g.ticks();
    if (remainingTicks <= 0) {
      this.allianceExpirySeconds = null;
      this.allianceExpiryText = null;
      return;
    }

    const remainingSeconds = Math.max(0, Math.floor(remainingTicks / 10));
    this.allianceExpirySeconds = remainingSeconds;
    this.allianceExpiryText = renderDuration(remainingSeconds);
  }

  async tick() {
    if (!this.isVisible || this.tile === null) return;

    this.updateAllianceExpiry();
    const currentTick = this.g.ticks();
    if (
      this.actionsRefreshInFlight ||
      currentTick < this.nextActionsRefreshTick
    ) {
      return;
    }

    const myPlayer = this.g.myPlayer();
    if (myPlayer === null || !myPlayer.isAlive()) return;

    const tile = this.tile;
    const owner = this.g.owner(tile);
    if (!owner.isPlayer()) return;

    const selectedPlayer = owner as PlayerView;
    const playerID = Number(selectedPlayer.id());
    const revision = this.selectionRevision;
    const shouldFetchProfile = this._profileForPlayerId !== playerID;

    this.actionsRefreshInFlight = true;
    this.nextActionsRefreshTick =
      currentTick + COMMAND_ACTION_REFRESH_INTERVAL_TICKS;

    try {
      const [actions, profile] = await Promise.all([
        // The command sheet only consumes transport availability. Passing null
        // empties buildableUnits and silently removes the landing command.
        myPlayer.actions(tile, [UnitType.TransportShip]),
        shouldFetchProfile
          ? selectedPlayer.profile()
          : Promise.resolve<PlayerProfile | null>(null),
      ]);

      if (
        revision !== this.selectionRevision ||
        !this.isVisible ||
        this.tile !== tile
      ) {
        return;
      }

      const currentOwner = this.g.owner(tile);
      if (!currentOwner.isPlayer() || currentOwner.id() !== selectedPlayer.id()) {
        return;
      }

      this.actions = actions;
      this.selectedPlayer = selectedPlayer;
      this.selectionLoading = false;
      if (profile !== null) {
        this.otherProfile = profile;
        this._profileForPlayerId = playerID;
      }
      this.updateAllianceExpiry();
      this.requestUpdate();
    } catch (error) {
      console.warn("Unable to refresh country command actions", error);
    } finally {
      this.actionsRefreshInFlight = false;
    }
  }

  public beginSelection(tile: TileRef) {
    this.selectionRevision++;
    this.nextActionsRefreshTick =
      this.g.ticks() + COMMAND_ACTION_REFRESH_INTERVAL_TICKS;
    const owner = this.g.owner(tile);
    const nextPlayer = owner.isPlayer() ? (owner as PlayerView) : null;
    if (nextPlayer === null) return;
    const changedPlayer = this.selectedPlayer?.id() !== nextPlayer.id();
    this.actions = null;
    this.tile = tile;
    this.selectedPlayer = nextPlayer;
    this.selectionLoading = true;
    this.moderationTarget = null;
    if (changedPlayer) {
      this.detailsExpanded = false;
      this.otherProfile = null;
      this._profileForPlayerId = null;
    }
    this.isVisible = true;
    this.requestUpdate();
  }

  public show(actions: PlayerActions, tile: TileRef) {
    this.selectionRevision++;
    this.nextActionsRefreshTick =
      this.g.ticks() + COMMAND_ACTION_REFRESH_INTERVAL_TICKS;
    const owner = this.g.owner(tile);
    const nextPlayer = owner.isPlayer() ? (owner as PlayerView) : null;
    const changedPlayer = this.selectedPlayer?.id() !== nextPlayer?.id();
    this.actions = actions;
    this.tile = tile;
    this.selectedPlayer = nextPlayer;
    this.selectionLoading = false;
    this.moderationTarget = null;
    if (changedPlayer) this.detailsExpanded = false;
    this.isVisible = nextPlayer !== null;
    this.requestUpdate();
  }

  public openResourceTransfer(
    target: PlayerView,
    mode: "troops" | "gold",
  ) {
    this.selectionRevision++;
    this.suppressNextHide = true;
    this.selectedPlayer = target;
    this.tile = null;
    this.actions = null;
    this.sendTarget = target;
    this.sendMode = mode;
    this.moderationTarget = null;
    this.isVisible = true;
    this.requestUpdate();
  }

  public openSendGoldModal(
    actions: PlayerActions,
    tile: TileRef,
    target: PlayerView,
  ) {
    this.selectionRevision++;
    this.suppressNextHide = true;
    this.actions = actions;
    this.tile = tile;
    this.selectedPlayer = target;
    this.sendTarget = target;
    this.sendMode = "gold";
    this.moderationTarget = null;
    this.isVisible = true;
    this.requestUpdate();
  }

  public hide() {
    this.selectionRevision++;
    this.isVisible = false;
    this.sendMode = "none";
    this.sendTarget = null;
    this.selectedPlayer = null;
    this.moderationTarget = null;
    this.detailsExpanded = false;
    this.selectionLoading = false;
    this.requestUpdate();
  }

  private handleClose(e: Event) {
    e.stopPropagation();
    this.hide();
  }

  private handleAllianceClick(
    e: Event,
    myPlayer: PlayerView,
    other: PlayerView,
  ) {
    e.stopPropagation();
    this.eventBus.emit(new SendAllianceRequestIntentEvent(myPlayer, other));
    this.hide();
  }

  private handleBreakAllianceClick(
    e: Event,
    myPlayer: PlayerView,
    other: PlayerView,
  ) {
    e.stopPropagation();
    this.eventBus.emit(new SendBreakAllianceIntentEvent(myPlayer, other));
    this.hide();
  }

  private openSendTroops(target: PlayerView) {
    this.suppressNextHide = true;
    this.sendTarget = target;
    this.sendMode = "troops";
  }

  private openSendGold(target: PlayerView) {
    this.suppressNextHide = true;
    this.sendTarget = target;
    this.sendMode = "gold";
  }

  private handleDonateTroopClick(
    e: Event,
    myPlayer: PlayerView,
    other: PlayerView,
  ) {
    e.stopPropagation();
    this.openSendTroops(other);
  }

  private handleDonateGoldClick(
    e: Event,
    myPlayer: PlayerView,
    other: PlayerView,
  ) {
    e.stopPropagation();
    this.openSendGold(other);
  }

  private closeSend = () => {
    this.sendTarget = null;
    this.sendMode = "none";
  };

  private confirmSend = (
    e: CustomEvent<{ amount: number; closePanel?: boolean }>,
  ) => {
    this.closeSend();
    if (e.detail?.closePanel) this.hide();
  };

  private handleEmbargoClick(
    e: Event,
    myPlayer: PlayerView,
    other: PlayerView,
  ) {
    e.stopPropagation();
    this.eventBus.emit(new SendEmbargoIntentEvent(other, "start"));
    this.hide();
  }

  private handleStopEmbargoClick(
    e: Event,
    myPlayer: PlayerView,
    other: PlayerView,
  ) {
    e.stopPropagation();
    this.eventBus.emit(new SendEmbargoIntentEvent(other, "stop"));
    this.hide();
  }

  private onStopTradingAllClick(e: Event) {
    e.stopPropagation();
    this.eventBus.emit(new SendEmbargoAllIntentEvent("start"));
  }

  private onStartTradingAllClick(e: Event) {
    e.stopPropagation();
    this.eventBus.emit(new SendEmbargoAllIntentEvent("stop"));
  }

  private handleEmojiClick(e: Event, myPlayer: PlayerView, other: PlayerView) {
    e.stopPropagation();
    this.emojiTable.showTable((emoji: string) => {
      if (myPlayer === other) {
        this.eventBus.emit(
          new SendEmojiIntentEvent(
            AllPlayers,
            flattenedEmojiTable.indexOf(emoji as Emoji),
          ),
        );
      } else {
        this.eventBus.emit(
          new SendEmojiIntentEvent(
            other,
            flattenedEmojiTable.indexOf(emoji as Emoji),
          ),
        );
      }
      this.emojiTable.hideTable();
      this.hide();
    });
  }

  private handleChat(e: Event, sender: PlayerView, other: PlayerView) {
    e.stopPropagation();

    if (!this.ctModal) {
      console.warn("ChatModal element not found in DOM");
      return;
    }

    this.ctModal.open(sender, other);
    this.hide();
  }

  private handleTargetClick(e: Event, other: PlayerView) {
    e.stopPropagation();
    this.eventBus.emit(new SendTargetPlayerIntentEvent(other.id()));
    this.hide();
  }

  private handleGroundAttack(e: Event, my: PlayerView, other: PlayerView) {
    e.stopPropagation();
    this.eventBus.emit(
      new SendAttackIntentEvent(
        other.id(),
        this.uiState.attackRatio * my.troops(),
      ),
    );
    this.hide();
  }

  private handleBoatAttack(e: Event, my: PlayerView) {
    e.stopPropagation();
    if (this.tile === null) return;
    this.eventBus.emit(
      new SendBoatAttackIntentEvent(
        this.tile,
        this.uiState.attackRatio * my.troops(),
      ),
    );
    this.hide();
  }

  private handleCoordinateAttack(e: Event, other: PlayerView) {
    e.stopPropagation();
    this.eventBus.emit(new SendTargetPlayerIntentEvent(other.id()));
    this.hide();
  }

  private handleResourceRequest(
    e: Event,
    ally: PlayerView,
    resource: "gold" | "troops",
  ) {
    e.stopPropagation();
    this.eventBus.emit(new SendQuickChatEvent(ally, `help.${resource}`));
    this.hide();
  }

  private openModeration(e: MouseEvent, other: PlayerView) {
    e.stopPropagation();
    this.suppressNextHide = true;
    this.moderationTarget = other;
  }

  private closeModeration = () => {
    this.moderationTarget = null;
  };

  private handleModerationKicked = (e: CustomEvent<{ playerId?: string }>) => {
    const playerId = e.detail?.playerId;
    if (playerId) this.kickedPlayerIDs.add(String(playerId));
    this.closeModeration();
    this.hide();
  };

  private handleToggleRocketDirection(e: Event) {
    e.stopPropagation();
    const next = !this.uiState.rocketDirectionUp;
    this.eventBus.emit(new SwapRocketDirectionEvent(next));
  }

  private identityChipProps(type: PlayerType) {
    switch (type) {
      case PlayerType.Nation:
        return { labelKey: "player_type.nation", classes: "text-sky-300" };
      case PlayerType.Bot:
        return { labelKey: "player_type.bot", classes: "text-violet-300" };
      case PlayerType.Human:
      default:
        return { labelKey: "player_type.player", classes: "text-slate-300" };
    }
  }

  private getRelationClass(relation: Relation): string {
    switch (relation) {
      case Relation.Hostile:
        return "text-red-300";
      case Relation.Distrustful:
        return "text-amber-300";
      case Relation.Friendly:
        return "text-emerald-300";
      case Relation.Neutral:
      default:
        return "text-slate-300";
    }
  }

  private getRelationName(relation: Relation): string {
    switch (relation) {
      case Relation.Hostile:
        return translateText("relation.hostile");
      case Relation.Distrustful:
        return translateText("relation.distrustful");
      case Relation.Friendly:
        return translateText("relation.friendly");
      case Relation.Neutral:
      default:
        return translateText("relation.neutral");
    }
  }

  private getExpiryColorClass(seconds: number | null): string {
    if (seconds === null) return "text-slate-200";
    if (seconds <= 30) return "text-red-300";
    if (seconds <= 60) return "text-amber-300";
    return "text-emerald-300";
  }

  private getTraitorRemainingSeconds(player: PlayerView): number | null {
    const ticksLeft = player.getTraitorRemainingTicks();
    if (!player.isTraitor() || ticksLeft <= 0) return null;
    return Math.ceil(ticksLeft / 10);
  }

  private renderTraitorBadge(other: PlayerView) {
    if (!other.isTraitor()) return html``;
    const secs = this.getTraitorRemainingSeconds(other);
    return html`<span class="command-player-warning">
      <img src=${traitorIcon} alt="" aria-hidden="true" />
      ${translateText("player_panel.traitor")}
      ${secs !== null ? html`<span>${renderDuration(secs)}</span>` : ""}
    </span>`;
  }

  private renderModeration(
    my: PlayerView,
    other: PlayerView,
    isAdmin: boolean,
  ) {
    if (!my.isLobbyCreator() && !isAdmin) return html``;
    // The host of a publicly listed game cannot kick (server-enforced), so
    // don't offer the panel; admins keep it for moderation.
    if (this.gameListed && !isAdmin) return html``;
    const moderationTitle = translateText("player_panel.moderation");

    return html`
      <ui-divider></ui-divider>
      <div class="grid auto-cols-fr grid-flow-col gap-1">
        ${actionButton({
          onClick: (e: MouseEvent) => this.openModeration(e, other),
          icon: shieldIcon,
          iconAlt: "Moderation",
          title: moderationTitle,
          label: moderationTitle,
          type: "red",
        })}
      </div>
    `;
  }

  private renderRelationPillIfNation(other: PlayerView, my: PlayerView) {
    if (other.isTraitor()) return html``;
    if (my?.isAlliedWith && my.isAlliedWith(other)) {
      return html`<span class="text-emerald-300">
        ${translateText("alliance_commands.allied")}
      </span>`;
    }
    if (other.type() !== PlayerType.Nation) return html``;
    if (!this.otherProfile || !my) return html``;
    const relation =
      this.otherProfile.relations?.[my.smallID()] ?? Relation.Neutral;
    return html`<span class=${this.getRelationClass(relation)}>
      ${this.getRelationName(relation)}
    </span>`;
  }

  private renderIdentityRow(other: PlayerView, my: PlayerView) {
    const flagCode = other.cosmetics.flag;
    const country =
      typeof flagCode === "string"
        ? Countries.find((c) => c.code === flagCode)
        : undefined;
    const chip = this.identityChipProps(other.type());

    return html`
      <div class="command-player-identity">
        ${country && typeof flagCode === "string"
          ? html`<img
              src=${assetUrl(`flags/${encodeURIComponent(flagCode)}.svg`)}
              alt=${country?.name ?? "Flag"}
              class="command-player-flag"
              @error=${(e: Event) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />`
          : html`<div class="command-player-flag command-player-flag-fallback"></div>`}
        <div class="min-w-0 flex-1">
          <h2 title=${other.displayName()}>${other.displayName()}</h2>
          <div class="command-player-meta">
            <span class=${chip.classes}>${translateText(chip.labelKey)}</span>
            <span aria-hidden="true">·</span>
            ${this.renderRelationPillIfNation(other, my)}
          </div>
        </div>
        ${this.renderTraitorBadge(other)}
      </div>
    `;
  }

  private renderResources(other: PlayerView) {
    return html`
      <div class="command-player-metrics" aria-label="Resources">
        <div>
          <img src=${goldIcon} alt="" aria-hidden="true" />
          <span>${translateText("player_panel.gold")}</span>
          <strong translate="no">${renderNumber(other.gold() || 0)}</strong>
        </div>
        <div>
          <img src=${troopIcon} alt="" aria-hidden="true" />
          <span>${translateText("player_panel.troops")}</span>
          <strong translate="no">${renderTroops(other.troops() || 0)}</strong>
        </div>
      </div>
    `;
  }

  private renderRocketDirectionToggle() {
    return html`
      <ui-divider></ui-divider>
      <button
        class="flex w-full items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-left text-white hover:bg-white/8 active:scale-[0.995] transition"
        @click=${(e: Event) => this.handleToggleRocketDirection(e)}
      >
        <div class="flex flex-col">
          <span class="text-sm font-semibold tracking-tight">
            ${translateText("player_panel.flip_rocket_trajectory")}
          </span>
          <span class="text-xs text-zinc-300" translate="no">
            ${this.uiState.rocketDirectionUp
              ? translateText("player_panel.arc_up")
              : translateText("player_panel.arc_down")}
          </span>
        </div>
        <span class="text-lg" aria-hidden="true">🔀</span>
      </button>
    `;
  }

  private renderStats(other: PlayerView, my: PlayerView) {
    return html`
      <dl class="command-player-detail-list">
        <div>
          <dt>${translateText("player_panel.betrayals")}</dt>
          <dd>${other.betrayals()}</dd>
        </div>
        <div>
          <dt>${translateText("player_panel.trading")}</dt>
          <dd class=${other.hasEmbargoAgainst(my) ? "text-amber-300" : "text-sky-300"}>
            ${other.hasEmbargoAgainst(my)
              ? translateText("player_panel.stopped")
              : translateText("player_panel.active")}
          </dd>
        </div>
      </dl>
    `;
  }

  private renderAlliances(other: PlayerView) {
    const allies = [...other.allies()].sort((a, b) =>
      a.displayName().localeCompare(b.displayName()),
    );
    return html`
      <div class="command-player-allies">
        <div>
          <span>${translateText("player_panel.alliances")}</span>
          <strong>${allies.length}</strong>
        </div>
        ${allies.length === 0
          ? html`<p>${translateText("common.none")}</p>`
          : html`<ul translate="no">
              ${allies.map((ally) => html`<li>${ally.displayName()}</li>`)}
            </ul>`}
      </div>
    `;
  }

  private renderAllianceExpiry() {
    if (this.allianceExpiryText === null) return html``;
    return html`
      <div class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-base">
        <div class="font-semibold text-zinc-300">
          ${translateText("player_panel.alliance_time_remaining")}
        </div>
        <div class="text-right font-semibold">
          <span
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[14px] font-bold ${this.getExpiryColorClass(
              this.allianceExpirySeconds,
            )}"
            >${this.allianceExpiryText}</span
          >
        </div>
      </div>
    `;
  }

  private renderActions(my: PlayerView, other: PlayerView) {
    const myPlayer = this.g.myPlayer();
    const canDonateGold = this.actions?.interaction?.canDonateGold;
    const canDonateTroops = this.actions?.interaction?.canDonateTroops;
    const canSendAllianceRequest =
      this.actions?.interaction?.canSendAllianceRequest;
    const canSendEmoji =
      other === myPlayer
        ? this.actions?.canSendEmojiAllPlayers
        : this.actions?.interaction?.canSendEmoji;
    const canBreakAlliance = this.actions?.interaction?.canBreakAlliance;
    const canEmbargo = this.actions?.interaction?.canEmbargo;
    const canAttack = !!this.actions?.canAttack;
    const canCoordinateAttack =
      !!this.actions?.interaction?.canTarget && my.allies().length > 0;
    const canLand =
      this.tile !== null &&
      (this.actions?.buildableUnits.some(
        (unit) => unit.type === UnitType.TransportShip && unit.canBuild !== false,
      ) ?? false);
    const isAllied = other.isAlliedWith(my);
    const operationShare = Math.round(this.uiState.attackRatio * 100);
    const operationTroops = renderTroops(this.uiState.attackRatio * my.troops());
    const operationDetail = `${operationShare}% · ${operationTroops}`;

    if (this.selectionLoading || this.actions === null) {
      return html`<div class="command-player-loading" aria-live="polite">
        <span></span><span></span><span></span>
      </div>`;
    }

    return html`
      <div class="command-player-actions">
        ${other !== my && (canAttack || canCoordinateAttack || canLand)
          ? html`<div class="command-player-primary-actions">
              ${canAttack
                ? actionButton({
                    onClick: (e: MouseEvent) =>
                      this.handleGroundAttack(e, my, other),
                    icon: targetIcon,
                    iconAlt: "Attack",
                    title: translateText("alliance_commands.attack_now"),
                    label: translateText("alliance_commands.attack_now"),
                    detail: operationDetail,
                    type: "red",
                    priority: "primary",
                  })
                : ""}
              ${canLand
                ? actionButton({
                    onClick: (e: MouseEvent) => this.handleBoatAttack(e, my),
                    icon: boatIcon,
                    iconAlt: "Landing",
                    title: translateText("alliance_commands.land_now"),
                    label: translateText("alliance_commands.land_now"),
                    detail: operationDetail,
                    type: "sky",
                    priority: canAttack ? "secondary" : "primary",
                  })
                : ""}
              ${canCoordinateAttack
                ? actionButton({
                    onClick: (e: MouseEvent) =>
                      this.handleCoordinateAttack(e, other),
                    icon: targetIcon,
                    iconAlt: "Coordinate attack",
                    title: translateText("alliance_commands.coordinate_attack"),
                    label: translateText("alliance_commands.coordinate_attack"),
                    type: "indigo",
                    priority: "secondary",
                  })
                : ""}
            </div>`
          : ""}

        ${other !== my && isAllied
          ? html`<div class="command-player-support-actions">
              ${actionButton({
                onClick: (e: MouseEvent) =>
                  this.handleResourceRequest(e, other, "gold"),
                icon: donateGoldIcon,
                iconAlt: "Request gold",
                title: translateText("alliance_commands.request_gold"),
                label: translateText("alliance_commands.request_gold"),
                priority: "secondary",
              })}
              ${actionButton({
                onClick: (e: MouseEvent) =>
                  this.handleResourceRequest(e, other, "troops"),
                icon: donateTroopIcon,
                iconAlt: "Request troops",
                title: translateText("alliance_commands.request_troops"),
                label: translateText("alliance_commands.request_troops"),
                priority: "secondary",
              })}
            </div>`
          : ""}

        <div class="command-player-quick-actions">
          ${actionButton({
            onClick: (e: MouseEvent) => this.handleChat(e, my, other),
            icon: chatIcon,
            iconAlt: "Chat",
            title: translateText("player_panel.chat"),
            label: translateText("player_panel.chat"),
            priority: "quiet",
            layout: "stacked",
          })}
          ${canSendEmoji
            ? actionButton({
                onClick: (e: MouseEvent) => this.handleEmojiClick(e, my, other),
                icon: emojiIcon,
                iconAlt: "Emoji",
                title: translateText("player_panel.emotes"),
                label: translateText("player_panel.emotes"),
                priority: "quiet",
                layout: "stacked",
              })
            : ""}
          ${canDonateTroops
            ? actionButton({
                onClick: (e: MouseEvent) =>
                  this.handleDonateTroopClick(e, my, other),
                icon: donateTroopIcon,
                iconAlt: "Troops",
                title: translateText("player_panel.send_troops"),
                label: translateText("player_panel.troops"),
                priority: "quiet",
                layout: "stacked",
              })
            : ""}
          ${canDonateGold
            ? actionButton({
                onClick: (e: MouseEvent) =>
                  this.handleDonateGoldClick(e, my, other),
                icon: donateGoldIcon,
                iconAlt: "Gold",
                title: translateText("player_panel.send_gold"),
                label: translateText("player_panel.gold"),
                priority: "quiet",
                layout: "stacked",
              })
            : ""}
        </div>

        ${other === my
          ? html`<div class="command-player-diplomacy-actions">
              ${actionButton({
                onClick: (e: MouseEvent) => this.onStopTradingAllClick(e),
                icon: stopTradingIcon,
                iconAlt: "Stop Trading With All",
                title: translateText("player_panel.stop_trade_all"),
                label: translateText("player_panel.stop_trade_all"),
                type: "yellow",
                priority: "quiet",
                disabled: !this.actions?.canEmbargoAll,
              })}
              ${actionButton({
                onClick: (e: MouseEvent) => this.onStartTradingAllClick(e),
                icon: startTradingIcon,
                iconAlt: "Start Trading With All",
                title: translateText("player_panel.start_trade_all"),
                label: translateText("player_panel.start_trade_all"),
                type: "green",
                priority: "quiet",
                disabled: !this.actions?.canEmbargoAll,
              })}
            </div>`
          : html`<div class="command-player-diplomacy-actions">
              ${canSendAllianceRequest
                ? actionButton({
                    onClick: (e: MouseEvent) =>
                      this.handleAllianceClick(e, my, other),
                    icon: allianceIcon,
                    iconAlt: "Alliance",
                    title: translateText("player_panel.send_alliance"),
                    label: translateText("player_panel.send_alliance"),
                    type: "indigo",
                    priority: canAttack ? "secondary" : "primary",
                  })
                : ""}
              ${canEmbargo
                ? actionButton({
                    onClick: (e: MouseEvent) =>
                      this.handleEmbargoClick(e, my, other),
                    icon: stopTradingIcon,
                    iconAlt: "Stop Trading",
                    title: translateText("player_panel.stop_trade"),
                    label: translateText("player_panel.stop_trade"),
                    type: "yellow",
                    priority: "quiet",
                  })
                : actionButton({
                    onClick: (e: MouseEvent) =>
                      this.handleStopEmbargoClick(e, my, other),
                    icon: startTradingIcon,
                    iconAlt: "Start Trading",
                    title: translateText("player_panel.start_trade"),
                    label: translateText("player_panel.start_trade"),
                    type: "green",
                    priority: "quiet",
                  })}
              ${canBreakAlliance
                ? actionButton({
                    onClick: (e: MouseEvent) =>
                      this.handleBreakAllianceClick(e, my, other),
                    icon: breakAllianceIcon,
                    iconAlt: "Break Alliance",
                    title: translateText("player_panel.break_alliance"),
                    label: translateText("player_panel.break_alliance"),
                    type: "red",
                    priority: "quiet",
                  })
                : ""}
            </div>`}
      </div>
    `;
  }

  render() {
    if (!this.isVisible) return html``;

    const my = this.g.myPlayer();
    if (!my) return html``;
    let other = this.selectedPlayer;
    if (!other && this.tile !== null) {
      const owner = this.g.owner(this.tile);
      if (owner?.isPlayer()) other = owner as PlayerView;
    }
    if (!other) return html``;

    const myGoldNum = my.gold();
    const myTroopsNum = Number(my.troops());

    return html`
      <div class="command-player-layer fixed inset-0 z-10001">
        <section
          class=${`command-player-sheet command-player-dock ${
            other.isTraitor() ? "is-traitor" : ""
          }`}
          role="dialog"
          aria-modal="false"
          aria-label=${other.displayName()}
          @contextmenu=${(e: MouseEvent) => e.preventDefault()}
          @wheel=${(e: WheelEvent) => e.stopPropagation()}
        >
          <div class="command-player-scroll">
            <header class="command-player-header">
              ${this.renderIdentityRow(other, my)}
              <button
                class="command-player-close"
                @click=${this.handleClose}
                aria-label=${translateText("common.close") || "Close"}
                title=${translateText("common.close") || "Close"}
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            ${this.renderResources(other)}
            ${this.renderActions(my, other)}

            <button
              class="command-player-details-toggle"
              aria-expanded=${this.detailsExpanded}
              @click=${(e: Event) => {
                e.stopPropagation();
                this.detailsExpanded = !this.detailsExpanded;
              }}
            >
              <span>${translateText("alliance_commands.details")}</span>
              <span aria-hidden="true">${this.detailsExpanded ? "−" : "+"}</span>
            </button>

            ${this.detailsExpanded
              ? html`<div class="command-player-details">
                  ${this.renderStats(other, my)}
                  ${this.renderAlliances(other)}
                  ${this.renderAllianceExpiry()}
                  ${other === my ? this.renderRocketDirectionToggle() : ""}
                  ${this.renderModeration(my, other, this.isAdminRole)}
                </div>`
              : ""}
          </div>
        </section>

        ${this.sendTarget
          ? html`<send-resource-modal
              class="pointer-events-auto"
              .open=${this.sendMode !== "none"}
              .mode=${this.sendMode}
              .total=${this.sendMode === "troops" ? myTroopsNum : myGoldNum}
              .uiState=${this.uiState}
              .myPlayer=${my}
              .target=${this.sendTarget}
              .gameView=${this.g}
              .eventBus=${this.eventBus}
              .format=${this.sendMode === "troops" ? renderTroops : renderNumber}
              @confirm=${this.confirmSend}
              @close=${this.closeSend}
            ></send-resource-modal>`
          : ""}
        ${this.moderationTarget
          ? html`<player-moderation-modal
              class="pointer-events-auto"
              .open=${true}
              .myPlayer=${my}
              .target=${this.moderationTarget}
              .eventBus=${this.eventBus}
              .isAdmin=${this.isAdminRole}
              .alreadyKicked=${this.kickedPlayerIDs.has(
                String(this.moderationTarget.id()),
              )}
              @close=${this.closeModeration}
              @kicked=${this.handleModerationKicked}
            ></player-moderation-modal>`
          : ""}
      </div>
    `;
  }

}
