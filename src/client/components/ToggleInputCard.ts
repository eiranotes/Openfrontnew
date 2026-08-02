import { LitElement, PropertyValues, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { translateText } from "../Utils";
import { INPUT_CLASS } from "./InputCardStyles";

@customElement("toggle-input-card")
export class ToggleInputCard extends LitElement {
  @property({ attribute: false }) labelKey = "";
  @property({ type: Boolean, attribute: false }) checked = false;
  @property({ attribute: false }) inputId?: string;
  @property({ attribute: false }) inputType = "number";
  @property({ attribute: false }) inputMin?: number | string;
  @property({ attribute: false }) inputMax?: number | string;
  @property({ attribute: false }) inputStep?: number | string;
  @property({ attribute: false }) inputValue?: number | string;
  @property({ attribute: false }) inputAriaLabel?: string;
  @property({ attribute: false }) inputPlaceholder?: string;
  @property({ attribute: false }) zeroLabel?: string;
  @property({ attribute: false }) defaultInputValue?: number | string;
  @property({ attribute: false }) minValidOnEnable?: number;
  @property({ attribute: false }) onToggle?: (
    checked: boolean,
    value: number | string | undefined,
  ) => void;
  @property({ attribute: false }) onInput?: (e: Event) => void;
  @property({ attribute: false }) onChange?: (e: Event) => void;
  @property({ attribute: false }) onKeyDown?: (e: KeyboardEvent) => void;

  createRenderRoot() {
    return this;
  }

  protected updated(changedProperties: PropertyValues<this>) {
    if (!changedProperties.has("checked")) return;
    if (changedProperties.get("checked") === false && this.checked) {
      const input = this.querySelector("input");
      input?.focus();
      input?.select();
    }
  }

  private toOptionalNumber(
    value: number | string | undefined,
  ): number | undefined {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) ? numeric : undefined;
    }
    return undefined;
  }

  private resolveValueOnEnable(): number | string | undefined {
    const currentValue = this.inputValue;
    if (currentValue === undefined || currentValue === "") {
      return this.defaultInputValue;
    }
    if (this.minValidOnEnable === undefined) return currentValue;
    const numericValue = this.toOptionalNumber(currentValue);
    return numericValue === undefined || numericValue < this.minValidOnEnable
      ? this.defaultInputValue
      : numericValue;
  }

  private emitToggle() {
    const nextChecked = !this.checked;
    this.onToggle?.(
      nextChecked,
      nextChecked ? this.resolveValueOnEnable() : undefined,
    );
  }

  render() {
    return html`
      <div
        class="rounded-[4px] border border-white/10 bg-[#11171e] px-3 py-2.5 ${this
          .checked
          ? "border-malibu-blue/70 bg-[#17232d]"
          : ""}"
      >
        <div class="flex min-h-11 items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked=${this.checked}
            @click=${this.emitToggle}
            class="fortress-control relative h-7 w-12 shrink-0 rounded-full border transition-[background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-malibu-blue/30 ${this
              .checked
              ? "border-malibu-blue bg-malibu-blue"
              : "border-white/20 bg-[#0d1116]"}"
          >
            <span
              class="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white transition-transform duration-150 ${this
                .checked
                ? "translate-x-[22px]"
                : "translate-x-[3px]"}"
            ></span>
          </button>
          <button
            type="button"
            class="fortress-control min-h-11 flex-1 text-left text-sm font-medium text-white/85 focus-visible:outline-none"
            @click=${this.emitToggle}
          >
            ${translateText(this.labelKey)}
          </button>
          <div class="w-28 shrink-0 ${this.checked ? "" : "invisible"}">
            <input
              type=${this.inputType}
              id=${this.inputId ?? nothing}
              min=${this.inputMin ?? nothing}
              max=${this.inputMax ?? nothing}
              step=${this.inputStep ?? nothing}
              .value=${String(this.inputValue ?? "")}
              class=${INPUT_CLASS}
              aria-label=${this.inputAriaLabel ?? nothing}
              placeholder=${this.inputPlaceholder ?? nothing}
              ?disabled=${!this.checked}
              @input=${this.onInput}
              @change=${this.onChange}
              @keydown=${this.onKeyDown}
            />
          </div>
        </div>
        ${this.checked &&
        this.zeroLabel !== undefined &&
        this.toOptionalNumber(this.inputValue) === 0
          ? html`<div class="mt-1 pl-[60px] text-xs text-white/55">
              ${this.zeroLabel}
            </div>`
          : nothing}
      </div>
    `;
  }
}
