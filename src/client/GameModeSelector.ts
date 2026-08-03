import { html, LitElement, nothing, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ClientEnv } from "src/client/ClientEnv";
import {
  Duos,
  GameMapType,
  GameMode,
  HumansVsNations,
  Quads,
  Trios,
} from "../core/game/Game";
import { PublicGameInfo, PublicGames } from "../core/Schemas";
import "./components/IOSAddToHomeScreenBanner";
import { HostLobbyModal } from "./HostLobbyModal";
import { JoinLobbyModal } from "./JoinLobbyModal";
import { PublicLobbySocket } from "./LobbySocket";
import { JoinLobbyEvent } from "./Main";
import { SinglePlayerModal } from "./SinglePlayerModal";
import { terrainMapFileLoader } from "./TerrainMapFileLoader";
import { UsernameInput } from "./UsernameInput";
import {
  calculateServerTimeOffset,
  getMapName,
  getModifierLabels,
  getSecondsUntilServerTimestamp,
  renderDuration,
  translateText,
} from "./Utils";

@customElement("game-mode-selector")
export class GameModeSelector extends LitElement {
  @state() private lobbies: PublicGames | null = null;
  @state() private mapAspectRatios: Map<GameMapType, number> = new Map();
  @state() private inputValid: boolean = true;
  private serverTimeOffset: number = 0;
  private defaultLobbyTime: number = 0;

  private lobbySocket = new PublicLobbySocket((lobbies) =>
    this.handleLobbiesUpdate(lobbies),
  );

  createRenderRoot() {
    return this;
  }

  // Silent backstop; the buttons are already disabled while input is invalid.
  private validateUsername(): boolean {
    const usernameInput = document.querySelector(
      "username-input",
    ) as UsernameInput | null;
    return usernameInput ? usernameInput.canPlay() : true;
  }

  connectedCallback() {
    super.connectedCallback();
    this.lobbySocket.start();
    this.defaultLobbyTime = ClientEnv.gameCreationRate() / 1000;
    window.addEventListener(
      "username-validity-change",
      this.handleValidityChange,
    );
    // Pick up the current value in case username-input validated before us.
    const usernameInput = document.querySelector(
      "username-input",
    ) as UsernameInput | null;
    if (usernameInput) {
      this.inputValid = usernameInput.canPlay();
    }
  }

  disconnectedCallback() {
    this.stop();
    window.removeEventListener(
      "username-validity-change",
      this.handleValidityChange,
    );
    super.disconnectedCallback();
  }

  private handleValidityChange = (e: Event) => {
    this.inputValid = (e as CustomEvent).detail?.isValid ?? true;
  };

  public stop() {
    this.lobbySocket.stop();
  }

  private handleLobbiesUpdate(lobbies: PublicGames) {
    this.lobbies = lobbies;
    this.serverTimeOffset = calculateServerTimeOffset(lobbies.serverTime);
    document.dispatchEvent(
      new CustomEvent("public-lobbies-update", {
        detail: { payload: lobbies },
      }),
    );
    this.requestUpdate();

    const allGames = Object.values(lobbies.games ?? {}).flat();
    for (const game of allGames) {
      const mapType = game.gameConfig?.gameMap as GameMapType;
      if (mapType && !this.mapAspectRatios.has(mapType)) {
        // New Map reference triggers Lit reactivity; placeholder ratio 1 lets
        // has() guard against duplicate in-flight fetches.
        this.mapAspectRatios = new Map(this.mapAspectRatios).set(mapType, 1);
        terrainMapFileLoader
          .getMapData(mapType)
          .manifest()
          .then((m: any) => {
            if (m?.map?.width && m?.map?.height) {
              this.mapAspectRatios = new Map(this.mapAspectRatios).set(
                mapType,
                m.map.width / m.map.height,
              );
            }
          })
          .catch((e) =>
            console.error(`Failed to load manifest for ${mapType}`, e),
          );
      }
    }
  }

  render() {
    const ffa = this.lobbies?.games?.["ffa"]?.[0];
    const teams = this.lobbies?.games?.["team"]?.[0];
    const special = this.lobbies?.games?.["special"]?.[0];

    return html`
      <div class="command-home">
        <section
          class="command-operation-deck"
          aria-labelledby="command-operation-title"
        >
          <h2
            id="command-operation-title"
            class="sr-only"
            data-i18n="main.play"
          ></h2>
          <div class="command-home-actions">
            ${this.renderSmallActionCard(
              translateText("main.solo"),
              this.openSinglePlayerModal,
              true,
            )}
            <div class="command-secondary-actions">
              ${this.renderSmallActionCard(
                translateText("main.create"),
                this.openHostLobby,
              )}
              ${this.renderSmallActionCard(
                translateText("mode_selector.ranked_title"),
                this.openRankedMenu,
              )}
              ${this.renderSmallActionCard(
                translateText("main.join"),
                this.openJoinLobby,
                false,
                this.hostedLobbyCount(),
              )}
            </div>
          </div>
        </section>

        <ios-add-to-home-screen-banner
          class="no-crazygames"
        ></ios-add-to-home-screen-banner>

        <section
          class="command-live-games"
          aria-labelledby="command-live-title"
          aria-live="polite"
        >
          <h2
            id="command-live-title"
            class="sr-only"
            data-i18n="main.join"
          ></h2>
          ${this.lobbies === null
            ? html`<div class="command-loading-panel" aria-label="Loading games">
                <span></span><span></span><span></span>
              </div>`
            : html`<div class="command-lobby-stage">
                ${ffa
                  ? html`<div class="min-h-0 sm:row-span-2">
                      ${this.renderLobbyCard(ffa, this.getLobbyTitle(ffa))}
                    </div>`
                  : nothing}
                ${special
                  ? html`<div class="min-h-0">
                      ${this.renderSpecialLobbyCard(special)}
                    </div>`
                  : nothing}
                ${teams
                  ? html`<div class="min-h-0">
                      ${this.renderLobbyCard(teams, this.getLobbyTitle(teams))}
                    </div>`
                  : nothing}
              </div>`}
        </section>
      </div>
    `;
  }

  private renderSpecialLobbyCard(lobby: PublicGameInfo) {
    return this.renderLobbyCard(lobby, this.getLobbyTitle(lobby));
  }

  private openRankedMenu = () => {
    if (!this.validateUsername()) return;
    window.showPage?.("page-ranked");
  };

  private openSinglePlayerModal = () => {
    if (!this.validateUsername()) return;
    (
      document.querySelector("single-player-modal") as SinglePlayerModal
    )?.open();
  };

  private openHostLobby = () => {
    if (!this.validateUsername()) return;
    (document.querySelector("host-lobby-modal") as HostLobbyModal)?.open();
  };

  private openJoinLobby = () => {
    if (!this.validateUsername()) return;
    (document.querySelector("join-lobby-modal") as JoinLobbyModal)?.open();
  };

  // Number of open hosted lobbies waiting in the browser; shown as a chip
  // on the Join button.
  private hostedLobbyCount(): number {
    return this.lobbies?.games?.hosted?.length ?? 0;
  }

  private renderSmallActionCard(
    title: string,
    onClick: () => void,
    primary = false,
    badge?: number,
  ) {
    return html`
      <button
        @click=${onClick}
        ?disabled=${!this.inputValid}
        data-primary=${primary ? "true" : "false"}
        data-action=${primary ? "solo" : "secondary"}
        class="command-action-button ${!this.inputValid
          ? "pointer-events-none cursor-not-allowed opacity-45"
          : ""}"
      >
        <span class="command-action-button__label min-w-0 truncate"
          >${title}</span
        >
        ${primary
          ? html`<span class="command-action-button__arrow" aria-hidden="true"
              >→</span
            >`
          : badge
            ? html`<span class="command-action-badge">${badge}</span>`
            : nothing}
      </button>
    `;
  }

  private renderLobbyCard(
    lobby: PublicGameInfo,
    titleContent: string | TemplateResult,
  ) {
    const mapType = lobby.gameConfig!.gameMap as GameMapType;
    const mapImageSrc = terrainMapFileLoader.getMapData(mapType).webpPath;
    const aspectRatio = this.mapAspectRatios.get(mapType);
    const useContain =
      aspectRatio !== undefined && (aspectRatio > 4 || aspectRatio < 0.25);
    const timeRemaining = lobby.startsAt
      ? getSecondsUntilServerTimestamp(lobby.startsAt, this.serverTimeOffset)
      : undefined;

    let timeDisplay: string;
    if (timeRemaining === undefined) {
      timeDisplay = renderDuration(this.defaultLobbyTime);
    } else if (timeRemaining > 0) {
      timeDisplay = renderDuration(timeRemaining);
    } else {
      timeDisplay = translateText("public_lobby.starting_game");
    }

    const mapName = getMapName(lobby.gameConfig?.gameMap);
    const modifierLabels = getModifierLabels(
      lobby.gameConfig?.publicGameModifiers,
      lobby.gameConfig?.doomsdayClock?.speed,
    );
    if (modifierLabels.length > 1) {
      modifierLabels.sort((a, b) => a.length - b.length);
    }

    return html`
      <button
        @click=${() => this.validateAndJoin(lobby)}
        ?disabled=${!this.inputValid}
        class="command-lobby-card group ${!this.inputValid
          ? "pointer-events-none cursor-not-allowed opacity-45"
          : ""}"
      >
        <div class="command-lobby-card__image pointer-events-none">
          ${mapImageSrc
            ? html`<img
                src=${mapImageSrc}
                alt=${mapName ?? lobby.gameConfig?.gameMap ?? "map"}
                draggable="false"
                class="absolute inset-0 h-full w-full ${useContain
                  ? "object-contain"
                  : "object-cover object-center"} [image-rendering:auto]"
              />`
            : nothing}
        </div>
        <div class="command-lobby-card__meta">
          <div class="command-lobby-card__tags">
            ${modifierLabels.map(
              (label) => html`<span class="command-status-tag">${label}</span>`,
            )}
            <span class="command-status-tag">${timeDisplay}</span>
          </div>
          <div class="command-lobby-card__title">
            <div class="truncate text-sm font-semibold sm:text-base">
              ${mapName ?? lobby.gameConfig?.gameMap}
            </div>
            <div class="mt-1 flex items-center justify-end gap-2 text-xs text-white/60">
              <span class="truncate">${titleContent}</span>
              <span class="tabular-nums text-white/80"
                >${lobby.numClients}/${lobby.gameConfig?.maxPlayers}</span
              >
            </div>
          </div>
        </div>
      </button>
    `;
  }

  private validateAndJoin(lobby: PublicGameInfo) {
    if (!this.validateUsername()) return;

    this.dispatchEvent(
      new CustomEvent("join-lobby", {
        detail: {
          gameID: lobby.gameID,
          source: "public",
          publicLobbyInfo: lobby,
        } as JoinLobbyEvent,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private getLobbyTitle(lobby: PublicGameInfo): string {
    const config = lobby.gameConfig!;
    if (config.gameMode === GameMode.FFA) {
      return translateText("game_mode.ffa");
    }

    if (config?.gameMode === GameMode.Team) {
      const totalPlayers = config.maxPlayers ?? lobby.numClients ?? undefined;
      const formatTeamsOf = (
        teamCount: number | undefined,
        playersPerTeam: number | undefined,
        label?: string,
      ) => {
        if (!teamCount)
          return label ?? translateText("mode_selector.teams_title");
        const baseTitle = playersPerTeam
          ? translateText("mode_selector.teams_of", {
              teamCount: String(teamCount),
              playersPerTeam: String(playersPerTeam),
            })
          : translateText("mode_selector.teams_count", {
              teamCount: String(teamCount),
            });
        return `${baseTitle}${label ? ` (${label})` : ""}`;
      };

      switch (config.playerTeams) {
        case Duos: {
          const teamCount = totalPlayers
            ? Math.floor(totalPlayers / 2)
            : undefined;
          return formatTeamsOf(teamCount, 2);
        }
        case Trios: {
          const teamCount = totalPlayers
            ? Math.floor(totalPlayers / 3)
            : undefined;
          return formatTeamsOf(teamCount, 3);
        }
        case Quads: {
          const teamCount = totalPlayers
            ? Math.floor(totalPlayers / 4)
            : undefined;
          return formatTeamsOf(teamCount, 4);
        }
        case HumansVsNations: {
          const humanSlots = config.maxPlayers ?? lobby.numClients;
          return humanSlots
            ? translateText("public_lobby.teams_hvn_detailed", {
                num: String(humanSlots),
              })
            : translateText("public_lobby.teams_hvn");
        }
        default:
          if (typeof config.playerTeams === "number") {
            const teamCount = config.playerTeams;
            const playersPerTeam =
              totalPlayers && teamCount > 0
                ? Math.floor(totalPlayers / teamCount)
                : undefined;
            return formatTeamsOf(teamCount, playersPerTeam);
          }
      }
    }

    return "";
  }
}
