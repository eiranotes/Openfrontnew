import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Difficulty, GameMapType } from "../../../core/game/Game";
import { terrainMapFileLoader } from "../../TerrainMapFileLoader";
import { translateText } from "../../Utils";
import { starIcon } from "./MapFavorites";
import { MEDAL_ORDER, medalIcon } from "./Medals";

@customElement("map-display")
export class MapDisplay extends LitElement {
  @property({ type: String }) mapKey = "";
  @property({ type: Boolean }) selected = false;
  @property({ type: String }) translation = "";
  @property({ type: Boolean }) showMedals = false;
  @property({ type: Boolean }) favorite = false;
  @property({ attribute: false }) wins: Set<Difficulty> = new Set();
  @property({ attribute: false }) onToggleFavorite?: () => void;
  @state() private mapWebpPath: string | null = null;
  @state() private mapName: string | null = null;
  @state() private isLoading = true;
  @state() private hasNations = true;
  private observer: IntersectionObserver | null = null;
  private dataLoaded = false;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !this.dataLoaded) {
          this.dataLoaded = true;
          void this.loadMapData();
          this.observer?.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    this.observer.observe(this);
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    this.observer = null;
    super.disconnectedCallback();
  }

  updated(changedProperties: Map<string, unknown>) {
    const previousMapKey = changedProperties.get("mapKey");
    if (
      changedProperties.has("mapKey") &&
      previousMapKey !== undefined &&
      previousMapKey !== this.mapKey &&
      this.dataLoaded
    ) {
      void this.loadMapData();
    }
  }

  private async loadMapData() {
    if (!this.mapKey) return;
    try {
      this.isLoading = true;
      const mapValue = GameMapType[this.mapKey as keyof typeof GameMapType];
      const data = terrainMapFileLoader.getMapData(mapValue);
      this.mapWebpPath = data.webpPath;
      const manifest = await data.manifest();
      this.mapName = manifest.name;
      this.hasNations =
        Array.isArray(manifest.nations) && manifest.nations.length > 0;
    } catch (error) {
      console.error("Failed to load map data:", error);
      this.mapWebpPath = null;
    } finally {
      this.isLoading = false;
    }
  }

  private handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      (event.currentTarget as HTMLElement).click();
    }
  }

  private handleToggleFavorite(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.onToggleFavorite?.();
  }

  render() {
    const title = this.translation || this.mapName || this.mapKey;
    return html`
      <div
        role="button"
        tabindex="0"
        aria-selected=${this.selected}
        aria-label=${title}
        @keydown=${this.handleKeydown}
        class="fortress-control group relative flex min-h-[78px] w-full items-center gap-3 rounded-[4px] border p-2 text-left transition-[color,background-color,border-color,transform] duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-malibu-blue/30 ${this
          .selected
          ? "border-malibu-blue bg-[#173044]"
          : "border-white/10 bg-[#0d1116] hover:border-white/25 hover:bg-[#151c24]"}"
      >
        <span
          class="absolute inset-y-2 left-0 w-0.5 ${this.selected
            ? "bg-malibu-blue"
            : "bg-transparent"}"
          aria-hidden="true"
        ></span>
        <div
          class="relative h-14 w-24 shrink-0 overflow-hidden rounded-[3px] border border-white/8 bg-black/25 sm:w-28"
        >
          ${this.isLoading
            ? html`<div
                class="flex h-full w-full items-center justify-center text-[11px] text-white/35"
              >
                ${translateText("map_component.loading")}
              </div>`
            : this.mapWebpPath
              ? html`<img
                  src=${this.mapWebpPath}
                  alt=${title}
                  draggable="false"
                  @dragstart=${(event: DragEvent) => event.preventDefault()}
                  class="h-full w-full object-cover opacity-90 transition-opacity duration-150 group-hover:opacity-100"
                />`
              : html`<div
                  class="flex h-full w-full items-center justify-center text-[11px] text-red-300"
                >
                  ${translateText("map_component.error")}
                </div>`}
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold text-white">${title}</div>
          <div class="mt-1 text-xs text-white/40">${this.mapKey}</div>
          ${this.showMedals && this.hasNations
            ? html`<div class="mt-1 flex gap-0.5">
                ${MEDAL_ORDER.map((medal) =>
                  medalIcon(medal, "w-4 h-4", this.wins?.has(medal)),
                )}
              </div>`
            : null}
        </div>
        ${this.onToggleFavorite
          ? html`<button
              type="button"
              @click=${this.handleToggleFavorite}
              @keydown=${(event: KeyboardEvent) => event.stopPropagation()}
              aria-pressed=${this.favorite}
              aria-label=${translateText(
                this.favorite
                  ? "map_component.unfavorite"
                  : "map_component.favorite",
              )}
              class="fortress-control flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] text-white/45 hover:bg-white/5 hover:text-cyber-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-malibu-blue/30 ${this
                .favorite
                ? "text-cyber-yellow"
                : ""}"
            >
              ${starIcon(this.favorite, "w-4 h-4")}
            </button>`
          : null}
      </div>
    `;
  }
}
