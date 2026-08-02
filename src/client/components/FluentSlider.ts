import { LitElement, html } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { translateText } from "../Utils";

@customElement("fluent-slider")
export class FluentSlider extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property({ type: Number }) value = 0;
  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 400;
  @property({ type: Number }) step = 1;
  @property({ type: String }) labelKey = "";
  @property({ type: String }) disabledKey = "";
  @property({ type: Number }) defaultValue: number | undefined = undefined;
  @property({ type: String }) defaultLabelKey = "";

  @state() private isEditing = false;
  @query("input[type='number']") private numberInput!: HTMLInputElement;

  private dispatchValueChange() {
    this.dispatchEvent(
      new CustomEvent("value-changed", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private setValue(value: number, dispatch = true) {
    const next = Math.min(this.max, Math.max(this.min, value));
    this.value = Number.isFinite(next) ? next : this.min;
    if (dispatch) this.dispatchValueChange();
  }

  private handleSliderInput(event: Event) {
    this.value = (event.target as HTMLInputElement).valueAsNumber;
  }

  private handleSliderChange(event: Event) {
    this.setValue((event.target as HTMLInputElement).valueAsNumber);
  }

  private handleNumberInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = Number.isFinite(target.valueAsNumber)
      ? target.valueAsNumber
      : this.min;
    this.value = Math.min(this.max, Math.max(this.min, value));
  }

  private handleNumberComplete() {
    this.dispatchValueChange();
  }

  private handleNumberKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      this.isEditing = false;
      this.handleNumberComplete();
    }
  }

  private enableEditing() {
    this.isEditing = true;
    void this.updateComplete.then(() => {
      this.numberInput?.focus();
      this.numberInput?.select();
    });
  }

  private adjust(direction: -1 | 1) {
    this.setValue(this.value + this.step * direction);
  }

  private renderValue() {
    if (this.value === 0 && this.disabledKey) {
      return translateText(this.disabledKey);
    }
    if (
      this.defaultValue !== undefined &&
      this.value === this.defaultValue &&
      this.defaultLabelKey
    ) {
      return html`${this.value}
        <span class="ml-1 text-[10px] font-medium text-white/35"
          >${translateText(this.defaultLabelKey)}</span
        >`;
    }
    return this.value;
  }

  render() {
    const percentage =
      this.max === this.min
        ? 0
        : ((this.value - this.min) / (this.max - this.min)) * 100;

    return html`
      <div class="flex w-full flex-col gap-2">
        <div class="flex min-h-8 items-center justify-between gap-3">
          <span class="min-w-0 text-xs font-semibold text-white/70">
            ${this.labelKey ? translateText(this.labelKey) : ""}
          </span>
          ${this.isEditing
            ? html`<input
                type="number"
                .min=${this.min}
                .max=${this.max}
                .valueAsNumber=${this.value}
                class="h-8 w-20 rounded-md border border-white/15 bg-[#0b1015] px-2 text-right text-sm font-semibold tabular-nums text-white focus:border-malibu-blue focus:outline-none"
                @input=${this.handleNumberInput}
                @blur=${() => {
                  this.isEditing = false;
                  this.handleNumberComplete();
                }}
                @keydown=${this.handleNumberKeyDown}
              />`
            : html`<button
                type="button"
                class="min-h-8 rounded-md border border-transparent px-2 text-sm font-semibold tabular-nums text-white transition-[background-color,border-color] duration-150 hover:border-white/10 hover:bg-white/[0.05]"
                @click=${this.enableEditing}
              >
                ${this.renderValue()}
              </button>`}
        </div>

        <div class="grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2">
          <button
            type="button"
            class="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-[#10161c] text-lg text-white/70 transition-[background-color,border-color,color,transform] duration-150 hover:border-white/20 hover:bg-[#1b252e] hover:text-white active:translate-y-px disabled:opacity-35"
            ?disabled=${this.value <= this.min}
            aria-label="Decrease"
            @click=${() => this.adjust(-1)}
          >
            −
          </button>
          <input
            type="range"
            .min=${this.min}
            .max=${this.max}
            .step=${this.step}
            .valueAsNumber=${this.value}
            style="background: linear-gradient(to right, var(--color-malibu-blue) 0%, var(--color-malibu-blue) ${percentage}%, rgba(255, 255, 255, 0.14) ${percentage}%, rgba(255, 255, 255, 0.14) 100%); background-size: 100% 5px; background-repeat: no-repeat; background-position: center;"
            class="h-10 w-full cursor-pointer appearance-none rounded bg-transparent p-0 focus:outline-none
              [&::-webkit-slider-runnable-track]:h-[5px] [&::-webkit-slider-runnable-track]:rounded [&::-webkit-slider-runnable-track]:bg-transparent
              [&::-webkit-slider-thumb]:-mt-[7px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#10161c] [&::-webkit-slider-thumb]:bg-malibu-blue
              [&::-moz-range-track]:h-[5px] [&::-moz-range-track]:rounded [&::-moz-range-track]:bg-transparent
              [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#10161c] [&::-moz-range-thumb]:bg-malibu-blue"
            @input=${this.handleSliderInput}
            @change=${this.handleSliderChange}
          />
          <button
            type="button"
            class="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-[#10161c] text-lg text-white/70 transition-[background-color,border-color,color,transform] duration-150 hover:border-white/20 hover:bg-[#1b252e] hover:text-white active:translate-y-px disabled:opacity-35"
            ?disabled=${this.value >= this.max}
            aria-label="Increase"
            @click=${() => this.adjust(1)}
          >
            +
          </button>
        </div>
      </div>
    `;
  }
}
