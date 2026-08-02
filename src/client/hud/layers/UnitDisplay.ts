import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { EventBus } from "../../../core/EventBus";
import {
  BuildableUnit,
  BuildMenus,
  Gold,
  PlayerBuildableUnitType,
  UnitType,
} from "../../../core/game/Game";
import { UserSettings } from "../../../core/game/UserSettings";
import { Controller } from "../../Controller";
import { ToggleStructureEvent } from "../../InputHandler";
import { UIState } from "../../UIState";
import { renderNumber, translateText } from "../../Utils";
import { GameView } from "../../view";
import {
  atomBombIcon,
  cityIcon,
  defensePostIcon,
  factoryIcon,
  goldCoinIcon,
  hydrogenBombIcon,
  mirvIcon,
  missileSiloIcon,
  portIcon,
  samLauncherIcon,
  warshipIcon,
} from "../HotbarIcons";

interface UnitDisplayItem {
  icon: string;
  type: PlayerBuildableUnitType;
  structureKey: string;
  keybindSetting: string;
  fallbackKey: string;
  countable?: boolean;
}

const UNIT_DISPLAY_ITEMS: UnitDisplayItem[] = [
  {
    icon: cityIcon,
    type: UnitType.City,
    structureKey: "city",
    keybindSetting: "buildCity",
    fallbackKey: "1",
  },
  {
    icon: factoryIcon,
    type: UnitType.Factory,
    structureKey: "factory",
    keybindSetting: "buildFactory",
    fallbackKey: "2",
  },
  {
    icon: portIcon,
    type: UnitType.Port,
    structureKey: "port",
    keybindSetting: "buildPort",
    fallbackKey: "3",
  },
  {
    icon: defensePostIcon,
    type: UnitType.DefensePost,
    structureKey: "defense_post",
    keybindSetting: "buildDefensePost",
    fallbackKey: "4",
  },
  {
    icon: missileSiloIcon,
    type: UnitType.MissileSilo,
    structureKey: "missile_silo",
    keybindSetting: "buildMissileSilo",
    fallbackKey: "5",
  },
  {
    icon: samLauncherIcon,
    type: UnitType.SAMLauncher,
    structureKey: "sam_launcher",
    keybindSetting: "buildSamLauncher",
    fallbackKey: "6",
  },
  {
    icon: warshipIcon,
    type: UnitType.Warship,
    structureKey: "warship",
    keybindSetting: "buildWarship",
    fallbackKey: "7",
  },
  {
    icon: atomBombIcon,
    type: UnitType.AtomBomb,
    structureKey: "atom_bomb",
    keybindSetting: "buildAtomBomb",
    fallbackKey: "8",
    countable: false,
  },
  {
    icon: hydrogenBombIcon,
    type: UnitType.HydrogenBomb,
    structureKey: "hydrogen_bomb",
    keybindSetting: "buildHydrogenBomb",
    fallbackKey: "9",
    countable: false,
  },
  {
    icon: mirvIcon,
    type: UnitType.MIRV,
    structureKey: "mirv",
    keybindSetting: "buildMIRV",
    fallbackKey: "0",
    countable: false,
  },
];

@customElement("unit-display")
export class UnitDisplay extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  public uiState: UIState;
  private playerBuildables: BuildableUnit[] | null = null;
  private keybinds: Record<string, { value: string; key: string }> = {};
  private counts = new Map<PlayerBuildableUnitType, number>();
  private allDisabled = false;

  @state() private mobileBuildOpen = false;

  createRenderRoot() {
    return this;
  }

  init() {
    const config = this.game.config();
    this.keybinds = new UserSettings().parsedUserKeybinds();
    this.allDisabled = BuildMenus.types.every((type) =>
      config.isUnitDisabled(type),
    );
    this.requestUpdate();
  }

  private cost(item: PlayerBuildableUnitType): Gold {
    return this.playerBuildables?.find((unit) => unit.type === item)?.cost ?? 0n;
  }

  private canBuild(item: PlayerBuildableUnitType): boolean {
    if (this.game?.config().isUnitDisabled(item)) return false;
    const player = this.game?.myPlayer();
    const affordable = this.cost(item) <= (player?.gold() ?? 0n);
    switch (item) {
      case UnitType.AtomBomb:
      case UnitType.HydrogenBomb:
      case UnitType.MIRV:
        return affordable && (player?.units(UnitType.MissileSilo).length ?? 0) > 0;
      case UnitType.Warship:
        return affordable && (player?.units(UnitType.Port).length ?? 0) > 0;
      default:
        return affordable;
    }
  }

  tick() {
    const player = this.game?.myPlayer();
    if (!player) return;
    void player.buildables(undefined, BuildMenus.types).then((buildables) => {
      this.playerBuildables = buildables;
      this.requestUpdate();
    });
    for (const type of BuildMenus.types) {
      this.counts.set(type, player.totalUnitLevels(type));
    }
    this.requestUpdate();
  }

  private highlight(type: PlayerBuildableUnitType) {
    switch (type) {
      case UnitType.AtomBomb:
      case UnitType.HydrogenBomb:
      case UnitType.MIRV:
        this.eventBus?.emit(
          new ToggleStructureEvent([
            UnitType.MissileSilo,
            UnitType.SAMLauncher,
          ]),
        );
        break;
      case UnitType.Warship:
        this.eventBus?.emit(new ToggleStructureEvent([UnitType.Port]));
        break;
      default:
        this.eventBus?.emit(new ToggleStructureEvent([type]));
    }
  }

  private clearHighlight() {
    this.eventBus?.emit(new ToggleStructureEvent(null));
  }

  private toggleSelection(type: PlayerBuildableUnitType) {
    if (this.uiState.ghostStructure === type) {
      this.uiState.ghostStructure = null;
    } else if (this.canBuild(type)) {
      this.uiState.ghostStructure = type;
    }
    this.requestUpdate();
  }

  private renderUnitItem(
    icon: string,
    type: PlayerBuildableUnitType,
    structureKey: string,
    hotkey: string,
    countable = true,
  ) {
    if (this.game.config().isUnitDisabled(type)) return html``;
    const selected = this.uiState.ghostStructure === type;
    const enabled = this.canBuild(type);
    const displayHotkey = hotkey
      .replace("Digit", "")
      .replace("Key", "")
      .toUpperCase();
    const label = translateText(`unit_type.${structureKey}`);
    return html`
      <button
        type="button"
        aria-label="${label}, ${renderNumber(this.cost(type))} gold"
        aria-pressed=${selected}
        ?disabled=${!enabled}
        @click=${() => this.toggleSelection(type)}
        @pointerenter=${() => this.highlight(type)}
        @pointerleave=${this.clearHighlight}
        @focus=${() => this.highlight(type)}
        @blur=${this.clearHighlight}
        class="fortress-control group relative flex min-h-[58px] min-w-[64px] snap-start flex-col items-center justify-center gap-0.5 rounded-[4px] border px-1.5 py-1 text-white transition-[color,background-color,border-color,opacity,transform] duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-malibu-blue/30 lg:min-h-[54px] lg:min-w-[62px] ${selected
          ? "border-malibu-blue bg-[#173044]"
          : "border-white/10 bg-[#0d1116] hover:border-white/25 hover:bg-[#151c24]"} ${enabled
          ? ""
          : "cursor-not-allowed opacity-35"}"
      >
        <span
          class="absolute left-1 top-0.5 hidden text-[9px] text-white/35 lg:block"
          translate="no"
          >${displayHotkey}</span
        >
        ${countable
          ? html`<span
              class="absolute right-1 top-0.5 text-[9px] text-white/45 tabular-nums"
              translate="no"
              >${renderNumber(this.counts.get(type) ?? 0)}</span
            >`
          : null}
        <img src=${icon} alt="" class="h-5 w-5" />
        <span class="max-w-[58px] truncate text-[10px] text-white/75"
          >${label}</span
        >
        <span
          class="flex items-center gap-0.5 text-[9px] text-yellow-200/70 tabular-nums"
          translate="no"
        >
          <img src=${goldCoinIcon} alt="" class="h-2.5 w-2.5" />
          ${renderNumber(this.cost(type))}
        </span>
      </button>
    `;
  }

  private itemHotkey(item: UnitDisplayItem): string {
    const binding = this.keybinds[item.keybindSetting];
    return binding?.key ?? item.fallbackKey;
  }

  private renderMobileUnitItem(item: UnitDisplayItem) {
    if (this.game.config().isUnitDisabled(item.type)) return html``;
    const selected = this.uiState.ghostStructure === item.type;
    const enabled = this.canBuild(item.type);
    const label = translateText(`unit_type.${item.structureKey}`);
    const countable = item.countable !== false;
    return html`
      <button
        type="button"
        aria-label="${label}, ${renderNumber(this.cost(item.type))} gold"
        aria-pressed=${selected}
        ?disabled=${!enabled}
        @click=${() => {
          this.toggleSelection(item.type);
          this.mobileBuildOpen = false;
        }}
        class="fortress-control grid min-h-16 w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-[4px] border px-3 py-2 text-left transition-[color,background-color,border-color,opacity,transform] duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-malibu-blue/30 ${selected
          ? "border-malibu-blue bg-[#173044]"
          : "border-white/10 bg-[#11171e]"} ${enabled
          ? ""
          : "cursor-not-allowed opacity-35"}"
      >
        <img src=${item.icon} alt="" class="h-8 w-8 justify-self-center" />
        <span class="min-w-0">
          <span class="block truncate text-sm font-semibold text-white"
            >${label}</span
          >
          <span class="mt-0.5 block text-[11px] text-white/45">
            ${countable
              ? `${renderNumber(this.counts.get(item.type) ?? 0)}개 보유 · `
              : ""}선택 후 지도에서 배치
          </span>
        </span>
        <span
          class="flex items-center gap-1 text-xs font-semibold text-yellow-200 tabular-nums"
          translate="no"
        >
          <img src=${goldCoinIcon} alt="" class="h-3 w-3" />
          ${renderNumber(this.cost(item.type))}
        </span>
      </button>
    `;
  }

  private renderMobileBuildSheet() {
    if (!this.mobileBuildOpen) return html``;
    return html`
      <div
        class="fixed inset-0 z-[10010] bg-black/45 lg:hidden"
        @click=${() => {
          this.mobileBuildOpen = false;
        }}
      >
        <section
          aria-label="건설 시설 선택"
          role="dialog"
          aria-modal="true"
          class="absolute inset-x-0 bottom-0 flex max-h-[78dvh] flex-col overflow-hidden rounded-t-[8px] border-t border-white/15 bg-[#0d1218] pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-16px_36px_rgba(0,0,0,0.42)]"
          @click=${(event: Event) => event.stopPropagation()}
        >
          <header
            class="flex min-h-14 items-center justify-between border-b border-white/10 px-3"
          >
            <div>
              <div class="text-sm font-semibold">건설 시설 선택</div>
              <div class="mt-0.5 text-[11px] text-white/45">
                시설을 선택한 뒤 지도에서 위치를 지정합니다.
              </div>
            </div>
            <button
              type="button"
              aria-label="건설 시설 선택 닫기"
              @click=${() => {
                this.mobileBuildOpen = false;
              }}
              class="fortress-control grid min-h-11 min-w-11 place-items-center rounded-[4px] border border-white/12 bg-[#171e27] text-xl text-white/70 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-malibu-blue/30"
            >
              ×
            </button>
          </header>
          <div
            class="hide-scrollbar grid flex-1 grid-cols-1 gap-1.5 overflow-y-auto overscroll-contain p-2 sm:grid-cols-2"
          >
            ${UNIT_DISPLAY_ITEMS.map((item) => this.renderMobileUnitItem(item))}
          </div>
        </section>
      </div>
    `;
  }

  render() {
    const player = this.game?.myPlayer();
    if (
      !this.game ||
      !player ||
      this.game.inSpawnPhase() ||
      !player.isAlive() ||
      this.allDisabled
    ) {
      return null;
    }

    const selectedItem = UNIT_DISPLAY_ITEMS.find(
      (item) => item.type === this.uiState.ghostStructure,
    );
    const selectedLabel = selectedItem
      ? translateText(`unit_type.${selectedItem.structureKey}`)
      : null;

    return html`
      ${this.renderMobileBuildSheet()}
      <div class="border-t border-white/10 bg-[#11171e] px-1.5 py-1.5">
        <div class="lg:hidden">
          <button
            type="button"
            aria-expanded=${this.mobileBuildOpen}
            @click=${() => {
              this.mobileBuildOpen = !this.mobileBuildOpen;
            }}
            class="fortress-control flex min-h-11 w-full items-center justify-center gap-2 rounded-[4px] border border-white/15 bg-[#171e27] px-3 text-sm font-semibold text-white active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-malibu-blue/30"
          >
            <span aria-hidden="true">＋</span>
            <span>${selectedLabel ? `건설 · ${selectedLabel}` : "건설"}</span>
            <span class="text-[11px] font-normal text-white/40"
              >${UNIT_DISPLAY_ITEMS.filter(
                (item) => !this.game.config().isUnitDisabled(item.type),
              ).length}개 시설</span
            >
          </button>
        </div>
        <div
          class="hide-scrollbar hidden w-full snap-x gap-1 overflow-x-auto overscroll-x-contain lg:flex lg:justify-center"
          aria-label="건설 도구"
        >
          ${UNIT_DISPLAY_ITEMS.map((item) =>
            this.renderUnitItem(
              item.icon,
              item.type,
              item.structureKey,
              this.itemHotkey(item),
              item.countable !== false,
            ),
          )}
        </div>
      </div>
    `;
  }
}
