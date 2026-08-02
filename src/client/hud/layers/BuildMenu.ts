import { css, html, LitElement, nothing } from "lit";
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
import {
  cityUpgradePreview,
  type CityUpgradePreview,
} from "../../../core/game/FortressBalance";
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
import { renderNumber, renderTroops } from "../../Utils";
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
    {
      unitType: UnitType.Port,
      icon: portIcon,
      description: "build_menu.desc.port",
      key: "unit_type.port",
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
      unitType: UnitType.Warship,
      icon: warshipIcon,
      description: "build_menu.desc.warship",
      key: "unit_type.warship",
      countable: true,
    },
    {
      unitType: UnitType.AtomBomb,
      icon: atomBombIcon,
      description: "build_menu.desc.atom_bomb",
      key: "unit_type.atom_bomb",
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
      unitType: UnitType.MIRV,
      icon: mirvIcon,
      description: "build_menu.desc.mirv",
      key: "unit_type.mirv",
      countable: false,
    },
  ],
];

export const flattenedBuildTable = buildTable.flat();

@customElement("build-menu")
export class BuildMenu extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  public uiState: UIState;
  public transformHandler: TransformHandler;
  public playerBuildables: BuildableUnit[] | null = null;

  private clickedTile: TileRef;
  private filteredBuildTable: BuildItemDisplay[][] = buildTable;
  @state() private _hidden = true;

  static styles = css`
    :host {
      display: block;
      color: #f4f7fa;
    }
    .hidden {
      display: none !important;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      background: rgba(0, 0, 0, 0.58);
    }
    .sheet {
      width: 100%;
      max-height: min(82dvh, 720px);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #11171e;
      border: 1px solid rgba(226, 232, 240, 0.14);
      border-bottom: 0;
      border-radius: 8px 8px 0 0;
      box-shadow: 0 -12px 36px rgba(0, 0, 0, 0.36);
    }
    .header {
      min-height: 52px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border-bottom: 1px solid rgba(226, 232, 240, 0.1);
    }
    .header h2 {
      margin: 0;
      flex: 1;
      font-size: 15px;
      font-weight: 650;
    }
    .close {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(226, 232, 240, 0.12);
      border-radius: 4px;
      background: #171e27;
      color: rgba(255, 255, 255, 0.75);
      font-size: 20px;
    }
    .scroll {
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 10px;
      padding-bottom: max(12px, env(safe-area-inset-bottom));
    }
    .city-preview {
      margin-bottom: 10px;
      border: 1px solid rgba(0, 132, 209, 0.45);
      border-radius: 6px;
      background: #12212c;
      overflow: hidden;
    }
    .city-preview-head {
      min-height: 48px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-bottom: 1px solid rgba(226, 232, 240, 0.1);
    }
    .city-preview-head img {
      width: 24px;
      height: 24px;
    }
    .city-preview-title {
      flex: 1;
      min-width: 0;
    }
    .city-preview-title strong {
      display: block;
      font-size: 14px;
    }
    .city-preview-title span {
      display: block;
      margin-top: 2px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.48);
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1px;
      background: rgba(226, 232, 240, 0.08);
    }
    .metric {
      min-width: 0;
      padding: 9px 10px;
      background: #11171e;
    }
    .metric-label {
      display: block;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.42);
    }
    .metric-value {
      display: block;
      margin-top: 3px;
      font-size: 12px;
      font-weight: 650;
      font-variant-numeric: tabular-nums;
    }
    .metric-value .before {
      color: rgba(255, 255, 255, 0.46);
    }
    .metric-value .arrow {
      padding: 0 4px;
      color: rgba(255, 255, 255, 0.32);
    }
    .metric-value .after {
      color: #b8e1fa;
    }
    .tier-unlock {
      padding: 9px 10px;
      border-top: 1px solid rgba(226, 232, 240, 0.1);
      font-size: 12px;
      color: rgba(255, 255, 255, 0.68);
    }
    .tier-unlock strong {
      color: #b8e1fa;
    }
    .build-list {
      display: grid;
      gap: 6px;
    }
    .build-button {
      position: relative;
      width: 100%;
      min-height: 64px;
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border: 1px solid rgba(226, 232, 240, 0.11);
      border-radius: 4px;
      background: #0d1116;
      color: white;
      text-align: left;
      transition:
        background-color 140ms cubic-bezier(0.2, 0, 0, 1),
        border-color 140ms cubic-bezier(0.2, 0, 0, 1),
        transform 140ms cubic-bezier(0.2, 0, 0, 1),
        opacity 140ms cubic-bezier(0.2, 0, 0, 1);
    }
    .build-button:not(:disabled):hover {
      border-color: rgba(226, 232, 240, 0.25);
      background: #171e27;
    }
    .build-button:not(:disabled):active {
      transform: translateY(1px);
    }
    .build-button:focus-visible,
    .close:focus-visible {
      outline: 2px solid rgba(63, 169, 245, 0.7);
      outline-offset: 2px;
    }
    .build-button:disabled {
      cursor: not-allowed;
      opacity: 0.35;
    }
    .build-icon {
      width: 32px;
      height: 32px;
      justify-self: center;
    }
    .build-copy {
      min-width: 0;
    }
    .build-name {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 650;
    }
    .build-description {
      margin-top: 3px;
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      font-size: 11px;
      line-height: 1.25;
      color: rgba(255, 255, 255, 0.46);
    }
    .build-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }
    .build-cost {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #fde68a;
      font-weight: 650;
    }
    .build-cost img {
      width: 13px;
      height: 13px;
    }
    .build-count {
      color: rgba(255, 255, 255, 0.42);
    }
    @media (min-width: 768px) {
      .backdrop {
        align-items: center;
        padding: 32px;
      }
      .sheet {
        width: min(820px, 94vw);
        max-height: min(84dvh, 760px);
        border-bottom: 1px solid rgba(226, 232, 240, 0.14);
        border-radius: 8px;
        box-shadow: 0 18px 56px rgba(0, 0, 0, 0.48);
      }
      .scroll {
        padding: 14px;
      }
      .metric-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .build-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .build-button {
        transition: none;
      }
    }
  `;

  init() {
    this.eventBus.on(ShowBuildMenuEvent, (event) => {
      if (!this.game.myPlayer()?.isAlive() || !this._hidden) return;
      const clicked = this.transformHandler.screenToWorldCoordinates(
        event.x,
        event.y,
      );
      if (!this.game.isValidCoord(clicked.x, clicked.y)) return;
      this.showMenu(this.game.ref(clicked.x, clicked.y));
    });
    this.eventBus.on(CloseViewEvent, () => this.hideMenu());
    this.eventBus.on(ShowEmojiMenuEvent, () => this.hideMenu());
    this.eventBus.on(MouseDownEvent, () => this.hideMenu());
  }

  tick() {
    if (!this._hidden) this.refresh();
  }

  public canBuildOrUpgrade(item: BuildItemDisplay): boolean {
    const unit = this.playerBuildables?.find(
      (candidate) => candidate.type === item.unitType,
    );
    return unit ? unit.canBuild !== false || unit.canUpgrade !== false : false;
  }

  public cost(item: BuildItemDisplay): Gold {
    return (
      this.playerBuildables?.find((unit) => unit.type === item.unitType)?.cost ??
      0n
    );
  }

  public count(item: BuildItemDisplay): string {
    return (
      this.game?.myPlayer()?.totalUnitLevels(item.unitType).toString() ?? "?"
    );
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

  private cityPreview(): {
    buildable: BuildableUnit;
    preview: CityUpgradePreview;
    currentLevel: number;
  } | null {
    const player = this.game?.myPlayer();
    const buildable = this.playerBuildables?.find(
      (candidate) => candidate.type === UnitType.City,
    );
    if (!player || !buildable) return null;
    if (buildable.canBuild === false && buildable.canUpgrade === false) return null;
    const currentLevel =
      buildable.canUpgrade === false
        ? 0
        : (this.game.unit(buildable.canUpgrade)?.level() ?? 0);
    return {
      buildable,
      currentLevel,
      preview: cityUpgradePreview(player, currentLevel),
    };
  }

  private renderMetric(
    label: string,
    before: string,
    after: string,
  ): ReturnType<typeof html> {
    return html`<div class="metric">
      <span class="metric-label">${label}</span>
      <span class="metric-value">
        <span class="before">${before}</span>
        <span class="arrow" aria-hidden="true">→</span>
        <span class="after">${after}</span>
      </span>
    </div>`;
  }

  private renderCityPreview() {
    const data = this.cityPreview();
    if (!data) return nothing;
    const { preview, buildable, currentLevel } = data;
    const enabled =
      buildable.canBuild !== false || buildable.canUpgrade !== false;
    const cityAction = currentLevel > 0 ? "도시 업그레이드" : "도시 건설";
    const tierText = preview.unlocksTier
      ? `${preview.currentTier.label} → ${preview.nextTier.label} · 최대 품질 ×${preview.nextTier.quality.toFixed(2)}`
      : preview.followingTier
        ? `${preview.nextTier.label} 유지 · ${preview.followingTier.label}까지 도시 ${preview.levelsToFollowingTier}레벨`
        : `${preview.nextTier.label} · 최고 등급`;

    return html`<section class="city-preview" aria-label="도시 발전 미리보기">
      <div class="city-preview-head">
        <img src=${cityIcon} alt="" />
        <div class="city-preview-title">
          <strong
            >${cityAction} · Lv${preview.currentLevel} →
            Lv${preview.nextLevel}</strong
          >
          <span>경제·행정·군사 효과가 국가 전체에 적용됩니다.</span>
        </div>
        <button
          type="button"
          class="build-button"
          style="width:auto;min-height:44px;grid-template-columns:auto;padding:8px 10px;"
          ?disabled=${!enabled}
          @click=${() => this.sendBuildOrUpgrade(buildable, this.clickedTile)}
        >
          <span class="build-cost">
            <img src=${goldCoinIcon} alt="" />
            ${renderNumber(buildable.cost)}
          </span>
        </button>
      </div>
      <div class="metric-grid">
        ${this.renderMetric(
          "도시 기본 생산",
          `${renderNumber(preview.currentCityBaseGoldPerSecond)}/s`,
          `${renderNumber(preview.nextCityBaseGoldPerSecond)}/s`,
        )}
        ${this.renderMetric(
          "전체 도시 생산",
          `${renderNumber(Math.floor(preview.currentCityNetworkGoldPerSecond))}/s`,
          `${renderNumber(Math.floor(preview.nextCityNetworkGoldPerSecond))}/s`,
        )}
        ${this.renderMetric(
          "훈련 수용량",
          renderTroops(preview.currentTrainingCapacity),
          renderTroops(preview.nextTrainingCapacity),
        )}
        ${this.renderMetric(
          "최대 병력",
          renderTroops(preview.currentMaxTroopsFromCities),
          renderTroops(preview.nextMaxTroopsFromCities),
        )}
        ${this.renderMetric(
          "행정 수용량",
          renderNumber(preview.currentAdministrativeCapacity),
          renderNumber(preview.nextAdministrativeCapacity),
        )}
        ${this.renderMetric(
          "행정 효율",
          `${Math.round(preview.currentAdministrativeEfficiency * 100)}%`,
          `${Math.round(preview.nextAdministrativeEfficiency * 100)}%`,
        )}
        ${this.renderMetric(
          "군사 등급",
          preview.currentTier.label,
          preview.nextTier.label,
        )}
      </div>
      <div class="tier-unlock">
        <strong>${tierText}</strong>
      </div>
    </section>`;
  }

  private renderBuildItem(item: BuildItemDisplay) {
    const buildable = this.playerBuildables?.find(
      (candidate) => candidate.type === item.unitType,
    );
    if (!buildable) return nothing;
    const enabled =
      buildable.canBuild !== false || buildable.canUpgrade !== false;
    const isUpgrade = buildable.canUpgrade !== false;
    const label = item.key ? translateText(item.key) : String(item.unitType);
    return html`
      <button
        type="button"
        class="build-button"
        ?disabled=${!enabled}
        title=${!enabled ? translateText("build_menu.not_enough_money") : ""}
        @click=${() => this.sendBuildOrUpgrade(buildable, this.clickedTile)}
      >
        <img class="build-icon" src=${item.icon} alt="" />
        <span class="build-copy">
          <span class="build-name">
            ${label}
            ${isUpgrade
              ? html`<span style="font-size:10px;color:#b8e1fa;"
                  >UPGRADE</span
                >`
              : nothing}
          </span>
          <span class="build-description">
            ${item.description ? translateText(item.description) : ""}
          </span>
        </span>
        <span class="build-meta" translate="no">
          <span class="build-cost">
            <img src=${goldCoinIcon} alt="" />${renderNumber(buildable.cost)}
          </span>
          ${item.countable
            ? html`<span class="build-count">보유 ${this.count(item)}</span>`
            : nothing}
        </span>
      </button>
    `;
  }

  render() {
    if (this._hidden) return html``;
    const items = this.filteredBuildTable.flat();
    return html`
      <div
        class="backdrop"
        role="presentation"
        @contextmenu=${(event: MouseEvent) => event.preventDefault()}
        @click=${(event: MouseEvent) => {
          if (event.target === event.currentTarget) this.hideMenu();
        }}
      >
        <section
          class="sheet"
          role="dialog"
          aria-modal="true"
          aria-label="건설 메뉴"
          @click=${(event: Event) => event.stopPropagation()}
        >
          <header class="header">
            <h2>건설 및 도시 발전</h2>
            <button
              type="button"
              class="close"
              aria-label="닫기"
              @click=${this.hideMenu}
            >
              ×
            </button>
          </header>
          <div class="scroll">
            ${this.renderCityPreview()}
            <div class="build-list">
              ${items.map((item) => this.renderBuildItem(item))}
            </div>
          </div>
        </section>
      </div>
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
    void this.game
      .myPlayer()
      ?.buildables(this.clickedTile, BuildMenus.types)
      .then((buildables) => {
        this.playerBuildables = buildables;
        this.requestUpdate();
      });
    this.filteredBuildTable = buildTable.map((row) =>
      row.filter((item) => !this.game?.config()?.isUnitDisabled(item.unitType)),
    );
  }

  get isVisible() {
    return !this._hidden;
  }
}
