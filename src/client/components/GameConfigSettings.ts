import { LitElement, TemplateResult, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  DOOMSDAY_CLOCK_SPEEDS,
  DoomsdayClockSpeed,
} from "../../core/game/DoomsdayClock";
import {
  Difficulty,
  Duos,
  GameMapType,
  GameMode,
  HumansVsNations,
  Quads,
  Trios,
  UnitType,
} from "../../core/game/Game";
import { TeamCountConfig } from "../../core/Schemas";
import { translateText } from "../Utils";
import "./Difficulties";
import "./FluentSlider";
import "./map/MapPicker";

export type GameConfigMobileSection = "map" | "match" | "rules";

const DIFFICULTY_OPTIONS = Object.entries(Difficulty).filter(([key]) =>
  isNaN(Number(key)),
) as Array<[string, Difficulty]>;

const TEAM_COUNT_OPTIONS: TeamCountConfig[] = [
  2,
  3,
  4,
  5,
  6,
  7,
  Quads,
  Trios,
  Duos,
  HumansVsNations,
];

const unitOptions: { type: UnitType; translationKey: string }[] = [
  { type: UnitType.City, translationKey: "unit_type.city" },
  { type: UnitType.DefensePost, translationKey: "unit_type.defense_post" },
  { type: UnitType.Port, translationKey: "unit_type.port" },
  { type: UnitType.Warship, translationKey: "unit_type.warship" },
  { type: UnitType.TransportShip, translationKey: "unit_type.boat" },
  { type: UnitType.MissileSilo, translationKey: "unit_type.missile_silo" },
  { type: UnitType.SAMLauncher, translationKey: "unit_type.sam_launcher" },
  { type: UnitType.AtomBomb, translationKey: "unit_type.atom_bomb" },
  { type: UnitType.HydrogenBomb, translationKey: "unit_type.hydrogen_bomb" },
  { type: UnitType.MIRV, translationKey: "unit_type.mirv" },
  { type: UnitType.Factory, translationKey: "unit_type.factory" },
];

export interface ToggleOptionConfig {
  labelKey: string;
  checked: boolean;
  hidden?: boolean;
  doomsdayClockSpeed?: DoomsdayClockSpeed;
}

export interface GameConfigSettingsData {
  map: {
    selected: GameMapType;
    useRandom: boolean;
    randomMapDivider?: boolean;
    showMedals?: boolean;
    mapWins?: Map<GameMapType, Set<Difficulty>>;
  };
  difficulty: {
    selected: Difficulty;
    disabled: boolean;
  };
  gameMode: {
    selected: GameMode;
  };
  teamCount: {
    selected: TeamCountConfig;
  };
  options: {
    titleKey: string;
    changedCount?: number;
    bots: {
      value: number;
      labelKey: string;
      disabledKey: string;
    };
    nations?: {
      value: number;
      defaultValue?: number;
      labelKey: string;
      disabledKey: string;
      hidden?: boolean;
    };
    toggles: ToggleOptionConfig[];
    inputCards: TemplateResult[];
  };
  hostCheats?: {
    titleKey: string;
    visible: boolean;
    toggles: ToggleOptionConfig[];
    inputCards: TemplateResult[];
  };
  unitTypes: {
    titleKey: string;
    disabledUnits: UnitType[];
  };
}

@customElement("game-config-settings")
export class GameConfigSettings extends LitElement {
  @property({ attribute: false }) settings?: GameConfigSettingsData;
  @property({ attribute: false }) sectionGapClass = "space-y-4";
  @property({ type: String }) mobileSection: GameConfigMobileSection = "map";
  @state() private mapSearchQuery = "";

  createRenderRoot() {
    return this;
  }

  private emit<T>(name: string, detail: T) {
    this.dispatchEvent(
      new CustomEvent(name, {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private mobileVisibility(section: GameConfigMobileSection): string {
    return this.mobileSection === section ? "block" : "hidden lg:block";
  }

  private renderPanel(
    title: string,
    content: TemplateResult | TemplateResult[],
    meta?: string,
    className = "",
  ): TemplateResult {
    return html`
      <section
        class="rounded-[6px] border border-white/10 bg-[#11171e] ${className}"
      >
        <header
          class="flex min-h-12 items-center gap-3 border-b border-white/10 px-4"
        >
          <h3 class="text-sm font-semibold text-white">${title}</h3>
          ${meta
            ? html`<span class="ml-auto text-xs text-white/45">${meta}</span>`
            : nothing}
        </header>
        <div class="p-3 sm:p-4">${content}</div>
      </section>
    `;
  }

  private renderSegment(
    label: string,
    selected: boolean,
    onClick: () => void,
    disabled = false,
  ): TemplateResult {
    return html`
      <button
        type="button"
        ?disabled=${disabled}
        aria-pressed=${selected}
        @click=${onClick}
        class="fortress-control min-h-11 flex-1 border px-3 text-sm font-medium transition-[color,background-color,border-color,opacity,transform] duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-malibu-blue/30 ${selected
          ? "border-malibu-blue bg-[#173044] text-white"
          : "border-white/10 bg-[#0d1116] text-white/65 hover:border-white/25 hover:text-white"} ${disabled
          ? "cursor-not-allowed opacity-35"
          : ""}"
      >
        ${label}
      </button>
    `;
  }

  private renderSwitch(
    label: string,
    checked: boolean,
    onClick: () => void,
    trailing: TemplateResult | null = null,
  ): TemplateResult {
    return html`
      <div
        class="flex min-h-12 items-center gap-3 border-b border-white/8 px-3 last:border-b-0"
      >
        <button
          type="button"
          role="switch"
          aria-checked=${checked}
          @click=${onClick}
          class="fortress-control relative h-7 w-12 shrink-0 rounded-full border transition-[background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-malibu-blue/30 ${checked
            ? "border-malibu-blue bg-malibu-blue"
            : "border-white/20 bg-[#0a0e13]"}"
        >
          <span
            class="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white transition-transform duration-150 ${checked
              ? "translate-x-[22px]"
              : "translate-x-[3px]"}"
          ></span>
        </button>
        <button
          type="button"
          @click=${onClick}
          class="fortress-control min-h-11 flex-1 text-left text-sm font-medium text-white/80 focus-visible:outline-none"
        >
          ${label}
        </button>
        ${trailing}
      </div>
    `;
  }

  private handleMapSearchInput = (event: Event) => {
    this.mapSearchQuery = (event.target as HTMLInputElement).value;
  };

  private renderMapSearchInput(): TemplateResult {
    return html`
      <label class="relative block w-full sm:w-64">
        <span class="sr-only">${translateText("map_component.search_maps")}</span>
        <svg
          class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
            clip-rule="evenodd"
          />
        </svg>
        <input
          type="search"
          placeholder=${translateText("map_component.search_maps")}
          .value=${this.mapSearchQuery}
          @input=${this.handleMapSearchInput}
          class="fortress-control h-11 w-full rounded-[4px] border border-white/12 bg-[#0d1116] pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus-visible:border-malibu-blue focus-visible:ring-2 focus-visible:ring-malibu-blue/25"
        />
      </label>
    `;
  }

  private renderMapPanel(settings: GameConfigSettingsData): TemplateResult {
    return this.renderPanel(
      translateText("map.map"),
      html`
        <div class="mb-3">${this.renderMapSearchInput()}</div>
        <map-picker
          .selectedMap=${settings.map.selected}
          .useRandomMap=${settings.map.useRandom}
          .randomMapDivider=${settings.map.randomMapDivider ?? false}
          .showMedals=${settings.map.showMedals ?? false}
          .mapWins=${settings.map.mapWins ?? new Map()}
          .onSelectMap=${(map: GameMapType) =>
            this.emit("map-selected", { map })}
          .onSelectRandom=${() => this.emit("random-map-selected", {})}
          .searchQuery=${this.mapSearchQuery}
        ></map-picker>
      `,
      undefined,
      "min-h-0",
    );
  }

  private renderDifficulty(settings: GameConfigSettingsData): TemplateResult {
    return html`
      <div class="grid grid-cols-2 gap-1 sm:grid-cols-4">
        ${DIFFICULTY_OPTIONS.map(([key, value]) =>
          this.renderSegment(
            translateText(`difficulty.${key.toLowerCase()}`),
            settings.difficulty.selected === value,
            () => this.emit("difficulty-selected", { difficulty: value }),
            settings.difficulty.disabled,
          ),
        )}
      </div>
    `;
  }

  private renderMode(settings: GameConfigSettingsData): TemplateResult {
    return html`
      <div class="grid grid-cols-2 gap-1">
        ${this.renderSegment(
          translateText("game_mode.ffa"),
          settings.gameMode.selected === GameMode.FFA,
          () => this.emit("game-mode-selected", { mode: GameMode.FFA }),
        )}
        ${this.renderSegment(
          translateText("game_mode.teams"),
          settings.gameMode.selected === GameMode.Team,
          () => this.emit("game-mode-selected", { mode: GameMode.Team }),
        )}
      </div>
      ${settings.gameMode.selected === GameMode.Team
        ? html`<div class="mt-3 grid grid-cols-3 gap-1 sm:grid-cols-5">
            ${TEAM_COUNT_OPTIONS.map((option) =>
              this.renderSegment(
                typeof option === "string"
                  ? option === HumansVsNations
                    ? translateText("public_lobby.teams_hvn")
                    : translateText(`host_modal.teams_${option}`)
                  : translateText("public_lobby.teams", { num: option }),
                settings.teamCount.selected === option,
                () => this.emit("team-count-selected", { count: option }),
              ),
            )}
          </div>`
        : nothing}
    `;
  }

  private renderMatchPanel(settings: GameConfigSettingsData): TemplateResult {
    return html`
      <div class="space-y-4">
        ${this.renderPanel(
          translateText("difficulty.difficulty"),
          this.renderDifficulty(settings),
        )}
        ${this.renderPanel(
          translateText("host_modal.mode"),
          this.renderMode(settings),
        )}
        ${this.renderPanel(
          settings.options.titleKey
            ? translateText(settings.options.titleKey)
            : translateText("single_modal.options_title"),
          html`
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="rounded-[4px] border border-white/10 bg-[#0d1116] p-3">
                <fluent-slider
                  min="0"
                  max="400"
                  step="1"
                  .value=${settings.options.bots.value}
                  labelKey=${settings.options.bots.labelKey}
                  disabledKey=${settings.options.bots.disabledKey}
                  @value-changed=${(event: Event) =>
                    this.emit(
                      "bots-changed",
                      (event as CustomEvent<{ value: number }>).detail,
                    )}
                ></fluent-slider>
              </div>
              ${settings.options.nations && !settings.options.nations.hidden
                ? html`<div
                    class="rounded-[4px] border border-white/10 bg-[#0d1116] p-3"
                  >
                    <fluent-slider
                      min="0"
                      max="400"
                      step="1"
                      .value=${settings.options.nations.value}
                      .defaultValue=${settings.options.nations.defaultValue}
                      defaultLabelKey="common.map_default"
                      labelKey=${settings.options.nations.labelKey}
                      disabledKey=${settings.options.nations.disabledKey}
                      @value-changed=${(event: Event) =>
                        this.emit(
                          "nations-changed",
                          (event as CustomEvent<{ value: number }>).detail,
                        )}
                    ></fluent-slider>
                  </div>`
                : nothing}
            </div>
          `,
        )}
      </div>
    `;
  }

  private renderDoomsdayTrailing(toggle: ToggleOptionConfig): TemplateResult {
    return html`
      <select
        ?disabled=${!toggle.checked}
        class="fortress-control h-10 rounded-[4px] border border-white/15 bg-[#0d1116] px-2 text-xs text-white outline-none disabled:opacity-35 focus-visible:border-malibu-blue focus-visible:ring-2 focus-visible:ring-malibu-blue/25"
        @click=${(event: Event) => event.stopPropagation()}
        @change=${(event: Event) =>
          this.emit("doomsday-clock-speed-selected", {
            speed: (event.target as HTMLSelectElement)
              .value as DoomsdayClockSpeed,
          })}
      >
        ${DOOMSDAY_CLOCK_SPEEDS.map(
          (speed) => html`<option
            value=${speed}
            ?selected=${toggle.doomsdayClockSpeed === speed}
          >
            ${translateText(`doomsday_clock_speed.${speed}`)}
          </option>`,
        )}
      </select>
    `;
  }

  private renderRulesPanel(settings: GameConfigSettingsData): TemplateResult {
    const visibleToggles = settings.options.toggles.filter(
      (toggle) => !toggle.hidden,
    );
    return html`
      <div class="space-y-4">
        ${this.renderPanel(
          translateText("single_modal.options_title"),
          html`
            <div class="overflow-hidden rounded-[4px] border border-white/8 bg-[#0d1116]">
              ${visibleToggles.map((toggle) =>
                this.renderSwitch(
                  translateText(toggle.labelKey),
                  toggle.checked,
                  () =>
                    this.emit("option-toggle-changed", {
                      labelKey: toggle.labelKey,
                      checked: !toggle.checked,
                    }),
                  toggle.doomsdayClockSpeed !== undefined
                    ? this.renderDoomsdayTrailing(toggle)
                    : null,
                ),
              )}
            </div>
            ${settings.options.inputCards.length > 0
              ? html`<div class="mt-3 grid gap-2 sm:grid-cols-2">
                  ${settings.options.inputCards}
                </div>`
              : nothing}
          `,
          settings.options.changedCount
            ? `변경 ${settings.options.changedCount}`
            : undefined,
        )}
        ${settings.hostCheats?.visible
          ? this.renderPanel(
              translateText(settings.hostCheats.titleKey),
              html`
                <div
                  class="overflow-hidden rounded-[4px] border border-white/8 bg-[#0d1116]"
                >
                  ${settings.hostCheats.toggles.map((toggle) =>
                    this.renderSwitch(
                      translateText(toggle.labelKey),
                      toggle.checked,
                      () =>
                        this.emit("host-cheat-toggle-changed", {
                          labelKey: toggle.labelKey,
                          checked: !toggle.checked,
                        }),
                    ),
                  )}
                </div>
                <div class="mt-3 grid gap-2 sm:grid-cols-2">
                  ${settings.hostCheats.inputCards}
                </div>
              `,
            )
          : nothing}
        ${this.renderPanel(
          translateText(settings.unitTypes.titleKey),
          html`<div class="grid grid-cols-2 gap-1 sm:grid-cols-3">
            ${unitOptions.map(({ type, translationKey }) => {
              const enabled = !settings.unitTypes.disabledUnits.includes(type);
              return html`<button
                type="button"
                aria-pressed=${enabled}
                @click=${() =>
                  this.emit("unit-toggle-changed", {
                    unit: type,
                    checked: enabled,
                  })}
                class="fortress-control min-h-11 border px-3 text-left text-sm transition-[color,background-color,border-color,opacity,transform] duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-malibu-blue/30 ${enabled
                  ? "border-malibu-blue/60 bg-[#173044] text-white"
                  : "border-white/10 bg-[#0d1116] text-white/45"}"
              >
                <span class="mr-2" aria-hidden="true"
                  >${enabled ? "✓" : "—"}</span
                >${translateText(translationKey)}
              </button>`;
            })}
          </div>`,
          `${unitOptions.length - settings.unitTypes.disabledUnits.length}/${unitOptions.length}`,
        )}
      </div>
    `;
  }

  render() {
    if (!this.settings) return nothing;
    const settings = this.settings;
    return html`
      <div
        class="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(22rem,5fr)] lg:items-start"
      >
        <div class="${this.mobileVisibility("map")} min-w-0">
          ${this.renderMapPanel(settings)}
        </div>
        <div class="min-w-0 space-y-4">
          <div class="${this.mobileVisibility("match")}">
            ${this.renderMatchPanel(settings)}
          </div>
          <div class="${this.mobileVisibility("rules")}">
            ${this.renderRulesPanel(settings)}
          </div>
        </div>
      </div>
    `;
  }
}
