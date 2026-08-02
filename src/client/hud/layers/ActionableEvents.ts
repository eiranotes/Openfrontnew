import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { EventBus } from "../../../core/EventBus";
import { coordinatedAttackTick } from "../../../core/game/AllianceCoordination";
import { MessageType, Tick } from "../../../core/game/Game";
import {
  AllianceExtensionUpdate,
  AllianceRequestReplyUpdate,
  AllianceRequestUpdate,
  BrokeAllianceUpdate,
  DisplayChatMessageUpdate,
  GameUpdateType,
  TargetPlayerUpdate,
} from "../../../core/game/GameUpdates";
import { Controller } from "../../Controller";
import { PlaySoundEffectEvent } from "../../sound/Sounds";
import { GoToPlayerEvent } from "../../TransformHandler";
import {
  SendAllianceExtensionIntentEvent,
  SendAllianceRejectIntentEvent,
  SendAllianceRequestIntentEvent,
  SendAttackIntentEvent,
  SendDonateGoldIntentEvent,
  SendDonateTroopsIntentEvent,
} from "../../Transport";
import { UIState } from "../../UIState";
import { getMessageTypeClasses, translateText } from "../../Utils";
import { GameView, PlayerView } from "../../view";
import type { PlayerPanel } from "./PlayerPanel";

interface ActionableEvent {
  description: string;
  type: MessageType;
  createdAt: number;
  focusID: number;
  buttons: {
    text: string;
    className: string;
    action: () => void;
    preventClose?: boolean;
  }[];
  priority?: number;
  allianceID?: number;
  duration?: Tick;
  requestorID?: number;
  requestKey?: string;
}

interface ScheduledAttack {
  targetID: number;
  executeAt: Tick;
}

const REQUEST_DURATION = 150; // 15 seconds.

@customElement("actionable-events")
export class ActionableEvents extends LitElement implements Controller {
  public eventBus: EventBus;
  public game: GameView;
  public uiState: UIState;
  public playerPanel: PlayerPanel | null = null;

  private active = false;
  private events: ActionableEvent[] = [];
  private scheduledAttacks: ScheduledAttack[] = [];
  private alliancesCheckedAt = new Map<number, Tick>();
  @state() private _isVisible = false;
  @state() private expanded = false;

  private updateMap = [
    [GameUpdateType.AllianceRequest, this.onAllianceRequestEvent.bind(this)],
    [
      GameUpdateType.AllianceRequestReply,
      this.onAllianceRequestReplyEvent.bind(this),
    ],
    [GameUpdateType.BrokeAlliance, this.onBrokeAllianceEvent.bind(this)],
    [
      GameUpdateType.AllianceExtension,
      this.onAllianceExtensionEvent.bind(this),
    ],
    [GameUpdateType.TargetPlayer, this.onTargetPlayerEvent.bind(this)],
    [GameUpdateType.DisplayChatEvent, this.onDisplayChatEvent.bind(this)],
  ] as const;

  createRenderRoot() {
    return this;
  }

  private addEvent(event: ActionableEvent) {
    if (event.requestKey) {
      this.events = this.events.filter((item) => item.requestKey !== event.requestKey);
    }
    this.events = [...this.events, event].slice(-12);
    this.requestUpdate();
  }

  private removeEvent(index: number) {
    this.events = [
      ...this.events.slice(0, index),
      ...this.events.slice(index + 1),
    ];
    if (this.events.length <= 1) this.expanded = false;
  }

  private removeAllianceRenewalEvents(allianceID: number) {
    this.events = this.events.filter(
      (event) =>
        !(
          event.type === MessageType.RENEW_ALLIANCE &&
          event.allianceID === allianceID
        ),
    );
  }

  private scheduleAttack(targetID: number, executeAt: Tick) {
    if (
      this.scheduledAttacks.some(
        (attack) =>
          attack.targetID === targetID &&
          Math.abs(attack.executeAt - executeAt) <= 2,
      )
    ) {
      return;
    }
    this.scheduledAttacks.push({ targetID, executeAt });
  }

  private executeScheduledAttacks() {
    const myPlayer = this.game.myPlayer();
    if (!myPlayer?.isAlive() || this.scheduledAttacks.length === 0) return;

    const pending: ScheduledAttack[] = [];
    for (const attack of this.scheduledAttacks) {
      if (attack.executeAt > this.game.ticks()) {
        pending.push(attack);
        continue;
      }
      const target = this.game.playerBySmallID(attack.targetID) as PlayerView;
      if (!target?.isAlive() || myPlayer.isFriendly(target)) continue;
      this.eventBus.emit(
        new SendAttackIntentEvent(
          target.id(),
          this.uiState.attackRatio * myPlayer.troops(),
        ),
      );
    }
    this.scheduledAttacks = pending;
  }

  tick() {
    this.active = true;
    this.executeScheduledAttacks();

    if (!this._isVisible && !this.game.inSpawnPhase()) {
      this._isVisible = true;
      this.requestUpdate();
    }

    const myPlayer = this.game.myPlayer();
    if (!myPlayer || !myPlayer.isAlive()) {
      if (this._isVisible) {
        this._isVisible = false;
        this.requestUpdate();
      }
      return;
    }

    this.checkForAllianceExpirations();

    const updates = this.game.updatesSinceLastTick();
    if (updates) {
      for (const [ut, fn] of this.updateMap) {
        updates[ut]?.forEach(fn as (event: unknown) => void);
      }
    }

    const remainingEvents = this.events.filter(
      (event) =>
        (event.duration === undefined ||
          this.game.ticks() - event.createdAt < event.duration) &&
        (event.type !== MessageType.ALLIANCE_REQUEST ||
          (event.requestorID !== undefined &&
            (this.game.playerBySmallID(event.requestorID) as PlayerView).isAlive() &&
            (this.game.playerBySmallID(event.requestorID) as PlayerView).isRequestingAllianceWith(
              myPlayer,
            ))),
    );

    if (this.events.length !== remainingEvents.length) {
      this.events = remainingEvents;
      this.requestUpdate();
    }
  }

  private checkForAllianceExpirations() {
    const myPlayer = this.game.myPlayer();
    if (!myPlayer?.isAlive()) return;

    const currentAllianceIds = new Set<number>();
    for (const alliance of myPlayer.alliances()) {
      currentAllianceIds.add(alliance.id);
      if (
        alliance.expiresAt >
        this.game.ticks() + this.game.config().allianceExtensionPromptOffset()
      ) {
        continue;
      }
      if (
        (this.alliancesCheckedAt.get(alliance.id) ?? 0) >=
        this.game.ticks() - this.game.config().allianceExtensionPromptOffset()
      ) {
        continue;
      }

      this.alliancesCheckedAt.set(alliance.id, this.game.ticks());
      const other = this.game.player(alliance.other) as PlayerView;
      this.addEvent({
        description: translateText("events_display.about_to_expire", {
          name: other.displayName(),
        }),
        type: MessageType.RENEW_ALLIANCE,
        buttons: [
          {
            text: translateText("events_display.focus"),
            className: "btn-gray",
            action: () => this.eventBus.emit(new GoToPlayerEvent(other)),
            preventClose: true,
          },
          {
            text: translateText("events_display.renew_alliance", {
              name: other.displayName(),
            }),
            className: "btn",
            action: () =>
              this.eventBus.emit(new SendAllianceExtensionIntentEvent(other)),
          },
          {
            text: translateText("events_display.ignore"),
            className: "btn-info",
            action: () => {},
          },
        ],
        createdAt: this.game.ticks(),
        focusID: other.smallID(),
        allianceID: alliance.id,
        requestorID: other.smallID(),
        priority: 30,
        requestKey: `renew:${alliance.id}`,
      });
    }

    for (const [allianceId] of this.alliancesCheckedAt) {
      if (!currentAllianceIds.has(allianceId)) {
        this.removeAllianceRenewalEvents(allianceId);
        this.alliancesCheckedAt.delete(allianceId);
        this.requestUpdate();
      }
    }
  }

  onAllianceRequestEvent(update: AllianceRequestUpdate) {
    const myPlayer = this.game.myPlayer();
    if (!myPlayer || update.recipientID !== myPlayer.smallID()) return;

    const requestor = this.game.playerBySmallID(update.requestorID) as PlayerView;
    const recipient = this.game.playerBySmallID(update.recipientID) as PlayerView;
    if (!requestor.isAlliedWith(recipient)) {
      this.eventBus.emit(new PlaySoundEffectEvent("alliance-suggested"));
    }
    this.addEvent({
      description: translateText("events_display.request_alliance", {
        name: requestor.displayName(),
      }),
      buttons: [
        {
          text: translateText("events_display.focus"),
          className: "btn-gray",
          action: () => this.eventBus.emit(new GoToPlayerEvent(requestor)),
          preventClose: true,
        },
        {
          text: translateText("events_display.accept_alliance"),
          className: "btn",
          action: () =>
            this.eventBus.emit(
              new SendAllianceRequestIntentEvent(recipient, requestor),
            ),
        },
        {
          text: translateText("events_display.reject_alliance"),
          className: "btn-info",
          action: () =>
            this.eventBus.emit(new SendAllianceRejectIntentEvent(requestor)),
        },
      ],
      type: MessageType.ALLIANCE_REQUEST,
      createdAt: this.game.ticks(),
      priority: 10,
      duration: this.game.config().allianceRequestDuration(),
      focusID: update.requestorID,
      requestorID: update.requestorID,
      requestKey: `alliance:${update.requestorID}`,
    });
  }

  private onAllianceRequestReplyEvent(update: AllianceRequestReplyUpdate) {
    const myPlayer = this.game.myPlayer();
    if (!myPlayer || update.request.recipientID !== myPlayer.smallID()) return;
    const requestorID = update.request.requestorID;
    this.events = this.events.filter(
      (event) =>
        !(
          event.type === MessageType.ALLIANCE_REQUEST &&
          event.focusID === requestorID
        ),
    );
    this.requestUpdate();
  }

  onBrokeAllianceEvent(update: BrokeAllianceUpdate) {
    this.removeAllianceRenewalEvents(update.allianceID);
    this.alliancesCheckedAt.delete(update.allianceID);
    this.requestUpdate();
  }

  private onAllianceExtensionEvent(update: AllianceExtensionUpdate) {
    const myPlayer = this.game.myPlayer();
    if (!myPlayer || myPlayer.smallID() !== update.playerID) return;
    this.removeAllianceRenewalEvents(update.allianceID);
    this.requestUpdate();
  }

  private onTargetPlayerEvent(update: TargetPlayerUpdate) {
    const myPlayer = this.game.myPlayer();
    if (!myPlayer?.isAlive()) return;

    const coordinator = this.game.playerBySmallID(update.playerID) as PlayerView;
    const target = this.game.playerBySmallID(update.targetID) as PlayerView;
    if (!coordinator || !target || target === myPlayer) return;
    if (coordinator !== myPlayer && !myPlayer.isFriendly(coordinator)) return;

    const executeAt = coordinatedAttackTick(this.game.ticks());
    if (coordinator === myPlayer) {
      this.scheduleAttack(update.targetID, executeAt);
      return;
    }

    this.eventBus.emit(new PlaySoundEffectEvent("message"));
    this.addEvent({
      description: translateText("events_display.attack_request", {
        name: coordinator.displayName(),
        target: target.displayName(),
      }),
      type: MessageType.ATTACK_REQUEST,
      createdAt: this.game.ticks(),
      duration: REQUEST_DURATION,
      priority: 0,
      focusID: update.targetID,
      requestorID: update.playerID,
      requestKey: `attack:${update.playerID}:${update.targetID}`,
      buttons: [
        {
          text: translateText("events_display.focus"),
          className: "btn-gray",
          action: () => this.eventBus.emit(new GoToPlayerEvent(target)),
          preventClose: true,
        },
        {
          text: translateText("alliance_commands.join_attack"),
          className: "btn",
          action: () => this.scheduleAttack(update.targetID, executeAt),
        },
        {
          text: translateText("events_display.ignore"),
          className: "btn-info",
          action: () => {},
        },
      ],
    });
  }

  private onDisplayChatEvent(update: DisplayChatMessageUpdate) {
    const myPlayer = this.game.myPlayer();
    if (
      !myPlayer?.isAlive() ||
      update.playerID !== myPlayer.smallID() ||
      !update.isFrom ||
      update.category !== "help" ||
      (update.key !== "gold" && update.key !== "troops")
    ) {
      return;
    }

    const requestor = this.game.player(update.recipient) as PlayerView;
    if (!requestor?.isAlive() || !myPlayer.isFriendly(requestor)) return;
    const resource = update.key as "gold" | "troops";
    const isGold = resource === "gold";

    this.eventBus.emit(new PlaySoundEffectEvent("message"));
    this.addEvent({
      description: translateText(
        isGold
          ? "alliance_commands.gold_request_from"
          : "alliance_commands.troop_request_from",
        { name: requestor.displayName() },
      ),
      type: MessageType.CHAT,
      createdAt: this.game.ticks(),
      duration: REQUEST_DURATION,
      priority: 5,
      focusID: requestor.smallID(),
      requestorID: requestor.smallID(),
      requestKey: `resource:${resource}:${requestor.smallID()}`,
      buttons: [
        {
          text: translateText("events_display.focus"),
          className: "btn-gray",
          action: () => this.eventBus.emit(new GoToPlayerEvent(requestor)),
          preventClose: true,
        },
        {
          text: translateText("alliance_commands.send_ten_percent"),
          className: "btn",
          action: () => {
            if (isGold) {
              const amount = myPlayer.gold() / 10n;
              this.eventBus.emit(
                new SendDonateGoldIntentEvent(requestor, amount),
              );
            } else {
              const amount = Math.max(1, Math.floor(myPlayer.troops() * 0.1));
              this.eventBus.emit(
                new SendDonateTroopsIntentEvent(requestor, amount),
              );
            }
          },
        },
        {
          text: translateText("alliance_commands.custom_amount"),
          className: "btn-info",
          action: () =>
            this.playerPanel?.openResourceTransfer(requestor, resource),
        },
      ],
    });
  }

  private emitGoToPlayerEvent(focusID: number) {
    const target = this.game.playerBySmallID(focusID) as PlayerView;
    if (target) this.eventBus.emit(new GoToPlayerEvent(target));
  }

  private renderEvent(event: ActionableEvent) {
    return html`
      <div class="command-request-card border-l-4 border-yellow-400 p-3 text-white">
        <button
          class="w-full cursor-pointer text-left text-sm font-semibold ${getMessageTypeClasses(
            event.type,
          )}"
          @click=${() => this.emitGoToPlayerEvent(event.focusID)}
        >
          ${event.description}
        </button>
        <div class="mt-2 grid grid-cols-3 gap-1.5">
          ${event.buttons.map(
            (btn) => html`
              <button
                class="min-h-11 rounded px-2 py-2 text-xs font-semibold text-white ${btn.className.includes(
                  "btn-info",
                )
                  ? "bg-blue-600 hover:bg-blue-500"
                  : btn.className.includes("btn-gray")
                    ? "bg-slate-600 hover:bg-slate-500"
                    : "bg-emerald-700 hover:bg-emerald-600"}"
                @click=${() => {
                  btn.action();
                  if (!btn.preventClose) {
                    const index = this.events.findIndex((item) => item === event);
                    if (index !== -1) this.removeEvent(index);
                  }
                  this.requestUpdate();
                }}
              >
                ${btn.text}
              </button>
            `,
          )}
        </div>
      </div>
    `;
  }

  render() {
    if (!this.active || !this._isVisible || this.events.length === 0) {
      return html``;
    }

    const sorted = [...this.events].sort((a, b) => {
      const priorityDelta = (a.priority ?? 100) - (b.priority ?? 100);
      return priorityDelta !== 0 ? priorityDelta : b.createdAt - a.createdAt;
    });
    const visibleEvents = this.expanded ? sorted : sorted.slice(0, 1);

    return html`
      <div class="command-request-inbox pointer-events-auto mt-1 w-full sm:w-96">
        <div class="flex items-center justify-between border-b border-white/10 px-3 py-2">
          <span class="text-xs font-semibold text-slate-200">
            ${translateText("alliance_commands.inbox")}
          </span>
          ${sorted.length > 1
            ? html`<button
                class="min-h-9 rounded px-2 text-xs font-semibold text-sky-200 hover:bg-white/10"
                @click=${() => {
                  this.expanded = !this.expanded;
                }}
              >
                ${this.expanded
                  ? translateText("alliance_commands.collapse")
                  : translateText("alliance_commands.more_requests", {
                      count: sorted.length - 1,
                    })}
              </button>`
            : ""}
        </div>
        <div class=${this.expanded ? "max-h-[42dvh] overflow-y-auto" : ""}>
          ${visibleEvents.map((event) => this.renderEvent(event))}
        </div>
      </div>
    `;
  }
}
