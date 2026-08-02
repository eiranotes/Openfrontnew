import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { translateText } from "../../../client/Utils";
import { assetUrl } from "../../../core/AssetUrls";
import { EventBus } from "../../../core/EventBus";
import {
  BuildableUnit,
  BuildMenus,
  Gold,
  PlayerBuildableUnitType,
  UnitType,
} from "../../../core/game/Game";
import { TileRef } from "../../../core/game/GameMap";
import { Controller } from "../../Controller";
import {
  CloseViewEvent,
  MouseDownEvent,
  ShowBuildMenuEvent,
  ShowEmojiMenuEvent,
} from "../../InputHandler";
import { TransformHandler } from "../../TransformHandler";
import {
  BuildUnitIntentEvent,
  SendUpgradeStructureIntentEvent,
} from "../../Transport";
import { UIState } from "../../UIState";
import { renderNumber } from "../../Utils";
import { GameView } from "../../view";

const warshipIcon = assetUrl("images/BattleshipIconWhite.svg");
const cityIcon = assetUrl("images/CityIconWhite.svg");
const factoryIcon = assetUrl("images/FactoryIconWhite.svg");
const goldCoinIcon = assetUrl("images/GoldCoinIcon.svg");
const mirvIcon = assetUrl("images/MIRVIcon.svg");
const missileSiloIcon = assetUrl("images/MissileSiloIconWhite.svg");
const hydrogenBombIcon = assetUrl("images/MushroomCloudIconWhite.svg");
const atomBombIcon = assetUrl("images/NukeIconWhite.svg");
const portIcon = assetUrl("images/PortIcon.svg");
const samlauncherIcon = assetUrl("images/SamLauncherIconWhite.svg");
const shieldIcon = assetUrl("images/ShieldIconWhite.svg");

export interface BuildItemDisplay {
  unitType: PlayerBuildableUnitType;
  icon: string;
  description?: string;
  key?: string;
  countable?: boolean;
}

export const buildTable: BuildItemDisplay[][] = [
  [
    {
      unitType: UnitType.AtomBomb,
      icon: atomBombIcon,
      description: "build_menu.desc.atom_bomb",
      key: "unit_type.atom_bomb",
      countable: false,
    },
    {
      unitType: UnitType.MIRV,
      icon: mirvIcon,
      description: "build_menu.desc.mirv",
      key: "unit_type.mirv",
      countable: false,
    },
    {
      unitType: UnitType.HydrogenBomb,
      icon: hydrogenBombIcon,
      description: "build_menu.desc.hydrogen_bomb",
      key: "unit_type.hydrogen_bomb",
      countable: false,
    },
    {
      unitType: UnitType.Warship,
      icon: warshipIcon,
      description: "build_menu.desc.warship",
      key: "unit_type.warship",
      countable: true,
    },
    {
      unitType: UnitType.Port,
      icon: portIcon,
      description: "build_menu.desc.port",
      key: "unit_type.port",
      countable: true,
    },
    {
      unitType: UnitType.MissileSilo,
      icon: missileSiloIcon,
      description: "build_menu.desc.missile_silo",
      key: "unit_type.missile_silo",
      countable: true,
    },
    {
      unitType: UnitType.SAMLauncher,
      icon: samlauncherIcon,
      description: "build_menu.desc.sam_launcher",
      key: "unit_type.sam_launcher",
      countable: true,
    },
    {
      unitType: UnitType.DefensePost,
      icon: shieldIcon,
      description: "build_menu.desc.defense_post",
      key: "unit_type.defense_post",
      countable: true,
    },
    {
      unitType: UnitType.City,
      icon: cityIcon,
      description: "build_menu.desc.city",
      key: "unit_type.city",
      countable: true,
    },
    {
      unitType: UnitType.Factory,
      icon: factoryIcon,
      description: "build_menu.desc.factory",
      key: "unit_type.factory",
      countable: true,
    },
  ],
];

export const flattenedBuildTable = buildTable.flat();

@customElement("build-menu")
export class BuildMenu extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  public uiState: UIState;
  private clickedTile: TileRef;
  public playerBuildables: BuildableUnit[] | null = null;
  private filteredBuildTable: BuildItemDisplay[][] = buildTable;
  public transformHandler: TransformHandler;

  init() {
    this.eventBus.on(ShowBuildMenuEvent, (e) => {
      if (!this.game.myPlayer()?.isAlive() || !this._hidden) return;
      const clickedCell = this.transformHandler.screenToWorldCoordinates(
        e.x,
        e.y,
      );
      if (!this.game.isValidCoord(clickedCell.x, clickedCell.y)) return;
      this.showMenu(this.game.ref(clickedCell.x, clickedCell.y));
    });
    this.eventBus.on(CloseViewEvent, () => this.hideMenu());
    this.eventBus.on(ShowEmojiMenuEvent, () => this.hideMenu());
    this.eventBus.on(MouseDownEvent, () => this.hideMenu());
  }

  tick() {
    if (!this._hidden) this.refresh();
  }

  static styles = css`
    :host {
      display: block;
      --build-surface: var(--ui-surface, #0e151a);
      --build-raised: var(--ui-surface-raised, #131c22);
      --build-hover: var(--ui-surface-hover, #1a2730);
      --build-border: var(--ui-border, rgba(219, 234, 240, 0.13));
      --build-border-strong: var(
        --ui-border-strong,
        rgba(219, 234, 240, 0.23)
      );
      --build-text: var(--ui-text, #f1f5f6);
      --build-muted: var(--ui-text-muted, #8e9ca3);
      --build-accent: var(--ui-accent, #1596b5);
      --build-support: var(--ui-support, #c6a158);
    }

    * {
      box-sizing: border-box;
    }

    button {
      font: inherit;
      -webkit-tap-highlight-color: transparent;
    }

    .hidden {
      display: none !important;
    }

    .build-menu {
      position: fixed;
      z-index: 9999;
      left: 50%;
      bottom: max(14px, env(safe-area-inset-bottom));
      width: min(820px, calc(100vw - 32px));
      max-height: min(48dvh, 520px);
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      overflow: hidden;
      transform: translateX(-50%);
      border: 1px solid var(--build-border-strong);
      border-radius: var(--ui-radius-lg, 7px);
      background: var(--build-surface);
      color: var(--build-text);
      box-shadow: var(--ui-shadow-panel, 0 16px 38px rgba(0, 0, 0, 0.38));
    }

    .build-header {
      min-height: 58px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 38px;
      align-items: center;
      gap: 12px;
      padding: 9px 10px 9px 14px;
      border-bottom: 1px solid var(--build-border);
      background: var(--build-raised);
    }

    .build-heading {
      min-width: 0;
      display: grid;
      gap: 2px;
    }

    .build-heading strong {
      overflow: hidden;
      color: var(--build-text);
      font-size: 13px;
      font-weight: 760;
      letter-spacing: 0.015em;
      line-height: 1.2;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .build-heading small {
      overflow: hidden;
      color: var(--build-muted);
      font-size: 10px;
      line-height: 1.25;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .build-close {
      width: 38px;
      height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid transparent;
      border-radius: var(--ui-radius-md, 5px);
      background: transparent;
      color: var(--build-muted);
      cursor: pointer;
      transition:
        background-color 120ms ease,
        border-color 120ms ease,
        color 120ms ease,
        transform 80ms ease;
    }

    .build-close:hover,
    .build-close:focus-visible {
      border-color: var(--build-border);
      background: var(--build-hover);
      color: var(--build-text);
    }

    .build-close:active {
      transform: translateY(1px);
    }

    .build-close:focus-visible,
    .build-command:focus-visible {
      outline: 2px solid var(--build-accent);
      outline-offset: -2px;
    }

    .build-grid {
      min-height: 0;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 8px;
      scrollbar-width: thin;
      scrollbar-color: var(--build-border-strong) transparent;
    }

    .build-command {
      position: relative;
      min-width: 0;
      min-height: 66px;
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border: 1px solid var(--build-border);
      border-radius: var(--ui-radius-md, 5px);
      background: var(--ui-control, #10191f);
      color: var(--build-text);
      text-align: left;
      cursor: pointer;
      transition:
        background-color 120ms ease,
        border-color 120ms ease,
        color 120ms ease,
        transform 80ms ease;
    }

    .build-command:hover:not(:disabled) {
      border-color: var(--build-border-strong);
      background: var(--build-hover);
    }

    .build-command:active:not(:disabled) {
      transform: translateY(1px);
      background: var(--ui-surface-strong, #18232b);
    }

    .build-command:disabled {
      cursor: not-allowed;
      opacity: 0.52;
    }

    .build-command:disabled .build-cost {
      color: #df7a70;
    }

    .build-icon-frame {
      width: 38px;
      height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--build-border);
      border-radius: var(--ui-radius-sm, 3px);
      background: var(--build-raised);
    }

    .build-icon-frame img {
      width: 24px;
      height: 24px;
      object-fit: contain;
    }

    .build-copy {
      min-width: 0;
      display: grid;
      gap: 3px;
    }

    .build-name {
      overflow: hidden;
      color: var(--build-text);
      font-size: 12px;
      font-weight: 720;
      line-height: 1.2;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .build-description {
      display: -webkit-box;
      overflow: hidden;
      color: var(--build-muted);
      font-size: 10px;
      line-height: 1.25;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .build-meta {
      min-width: 66px;
      display: grid;
      justify-items: end;
      gap: 4px;
      font-variant-numeric: tabular-nums;
    }

    .build-cost {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--build-support);
      font-size: 11px;
      font-weight: 720;
      white-space: nowrap;
    }

    .build-cost img {
      width: 12px;
      height: 12px;
    }

    .build-count {
      min-width: 22px;
      padding: 1px 5px;
      border: 1px solid var(--build-border);
      border-radius: var(--ui-radius-xs, 2px);
      color: var(--build-muted);
      font-size: 9px;
      line-height: 16px;
      text-align: center;
    }

    @media (min-width: 980px) {
      .build-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 639px) {
      .build-menu {
        bottom: 0;
        width: 100vw;
        max-height: min(52dvh, 480px);
        border-right: 0;
        border-bottom: 0;
        border-left: 0;
        border-radius: var(--ui-radius-lg, 7px) var(--ui-radius-lg, 7px) 0 0;
      }

      .build-header {
        min-height: 54px;
        padding-left: 12px;
      }

      .build-heading small {
        max-width: 70vw;
      }

      .build-grid {
        grid-template-columns: 1fr;
        gap: 5px;
        padding: 6px 8px calc(8px + env(safe-area-inset-bottom));
      }

      .build-command {
        min-height: 58px;
        grid-template-columns: 34px minmax(0, 1fr) auto;
        padding: 7px 9px;
      }

      .build-icon-frame {
        width: 34px;
        height: 34px;
      }

      .build-icon-frame img {
        width: 22px;
        height: 22px;
      }

      .build-description {
        -webkit-line-clamp: 1;
      }
    }

    @media (pointer: coarse) {
      .build-close,
      .build-command {
        min-height: 44px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .build-close,
      .build-command {
        transition-duration: 1ms !important;
      }
    }
  `;

  @state() private _hidden = true;

  public canBuildOrUpgrade(item: BuildItemDisplay): boolean {
    if (this.game?.myPlayer() === null || this.playerBuildables === null) {
      return false;
    }
    const unit = this.playerBuildables.find((u) => u.type === item.unitType);
    return unit ? unit.canBuild !== false || unit.canUpgrade !== false : false;
  }

  public cost(item: BuildItemDisplay): Gold {
    return (
      this.playerBuildables?.find((unit) => unit.type === item.unitType)?.cost ??
      0n
    );
  }

  public count(item: BuildItemDisplay): string {
    return this.game?.myPlayer()?.totalUnitLevels(item.unitType).toString() ?? "?";
  }

  public sendBuildOrUpgrade(buildableUnit: BuildableUnit, tile: TileRef): void {
    if (buildableUnit.canUpgrade !== false) {
      this.eventBus.emit(
        new SendUpgradeStructureIntentEvent(
          buildableUnit.canUpgrade,
          buildableUnit.type,
        ),
      );
    } else if (buildableUnit.canBuild) {
      const rocketDirectionUp =
        buildableUnit.type === UnitType.AtomBomb ||
        buildableUnit.type === UnitType.HydrogenBomb
          ? this.uiState.rocketDirectionUp
          : undefined;
      this.eventBus.emit(
        new BuildUnitIntentEvent(buildableUnit.type, tile, rocketDirectionUp),
      );
    }
    this.hideMenu();
  }

  render() {
    const items = this.filteredBuildTable.flat();
    return html`
      <section
        class="build-menu command-build-dock ${this._hidden ? "hidden" : ""}"
        role="dialog"
        aria-modal="false"
        aria-label=${translateText("help_modal.build_menu_title")}
        @contextmenu=${(event: MouseEvent) => event.preventDefault()}
      >
        <header class="build-header">
          <div class="build-heading">
            <strong>${translateText("help_modal.build_menu_title")}</strong>
            <small>${translateText("help_modal.build_menu_desc")}</small>
          </div>
          <button
            class="build-close"
            @click=${this.hideMenu}
            aria-label="Close"
            title="Close"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M5.3 4.2 10 8.9l4.7-4.7 1.1 1.1-4.7 4.7 4.7 4.7-1.1 1.1-4.7-4.7-4.7 4.7-1.1-1.1L8.9 10 4.2 5.3l1.1-1.1Z" />
            </svg>
          </button>
        </header>

        <div class="build-grid">
          ${items.map((item) => {
            const buildableUnit = this.playerBuildables?.find(
              (unit) => unit.type === item.unitType,
            );
            if (buildableUnit === undefined) return html``;
            const enabled =
              buildableUnit.canBuild !== false ||
              buildableUnit.canUpgrade !== false;
            const name = item.key ? translateText(item.key) : item.unitType;
            const description = item.description
              ? translateText(item.description)
              : "";
            return html`
              <button
                class="build-command"
                @click=${() =>
                  this.sendBuildOrUpgrade(buildableUnit, this.clickedTile)}
                ?disabled=${!enabled}
                aria-label=${`${name}, ${renderNumber(this.cost(item))}`}
                title=${enabled
                  ? description
                  : translateText("build_menu.not_enough_money")}
              >
                <span class="build-icon-frame">
                  <img src=${item.icon} alt="" width="24" height="24" />
                </span>
                <span class="build-copy">
                  <span class="build-name">${name}</span>
                  <span class="build-description">${description}</span>
                </span>
                <span class="build-meta" translate="no">
                  <span class="build-cost">
                    ${renderNumber(this.cost(item))}
                    <img src=${goldCoinIcon} alt="" width="12" height="12" />
                  </span>
                  ${item.countable
                    ? html`<span class="build-count">×${this.count(item)}</span>`
                    : html``}
                </span>
              </button>
            `;
          })}
        </div>
      </section>
    `;
  }

  hideMenu = () => {
    this._hidden = true;
    this.requestUpdate();
  };

  showMenu(clickedTile: TileRef) {
    this.clickedTile = clickedTile;
    this._hidden = false;
    this.refresh();
  }

  private refresh() {
    this.game
      .myPlayer()
      ?.buildables(this.clickedTile, BuildMenus.types)
      .then((buildables) => {
        this.playerBuildables = buildables;
        this.requestUpdate();
      });
    this.filteredBuildTable = this.getBuildableUnits();
  }

  private getBuildableUnits(): BuildItemDisplay[][] {
    return buildTable.map((row) =>
      row.filter((item) => !this.game?.config()?.isUnitDisabled(item.unitType)),
    );
  }

  get isVisible() {
    return !this._hidden;
  }
}
