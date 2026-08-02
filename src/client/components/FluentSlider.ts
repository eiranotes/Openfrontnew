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

  private handleSliderInput(e: Event) {
    const target = e.target as HTMLInputElement;
    this.value = target.valueAsNumber;
  }

  private handleSliderChange(e: Event) {
    const target = e.target as HTMLInputElement;
    this.value = target.valueAsNumber;
    this.dispatchValueChange();
  }

  private handleNumberInput(e: Event) {
    const target = e.target as HTMLInputElement;
    let val = target.valueAsNumber;
    if (isNaN(val)) {
      val = this.min;
    }
    if (val < this.min) val = this.min;
    if (val > this.max) val = this.max;
    this.value = val;
    // Don't dispatch value change on every input - only on blur/enter
  }

  private handleNumberComplete() {
    // Dispatch the value change when editing is complete
    this.dispatchValueChange();
  }

  private handleNumberKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      this.isEditing = false;
      this.handleNumberComplete();
    }
  }

  private enableEditing() {
    this.isEditing = true;
    this.updateComplete.then(() => this.numberInput?.focus());
  }

  render() {
    const percentage =
      this.max === this.min
        ? 0
        : ((this.value - this.min) / (this.max - this.min)) * 100;
    return html`
      <div
        class="flex flex-col items-center justify-center gap-1 w-full text-center"
      >
        <input
          type="range"
          .min=${this.min}
          .max=${this.max}
          .step=${this.step}
          .valueAsNumber=${this.value}
          style="background: linear-gradient(to right, var(--color-malibu-blue) 0%, var(--color-malibu-blue) ${percentage}%, rgba(255, 255, 255, 0.14) ${percentage}%, rgba(255, 255, 255, 0.14) 100%); background-size: 100% 4px; background-repeat: no-repeat; background-position: center;"
          class="fortress-range w-full h-10 p-0 m-0 bg-transparent appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-malibu-blue/30
                 [&::-webkit-slider-runnable-track]:w-full [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:cursor-pointer [&::-webkit-slider-runnable-track]:bg-transparent
                 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#0d1116] [&::-webkit-slider-thumb]:bg-malibu-blue [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:-mt-2
                 [&::-moz-range-track]:w-full [&::-moz-range-track]:h-1 [&::-moz-range-track]:cursor-pointer [&::-moz-range-track]:bg-transparent
                 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#0d1116] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-malibu-blue [&::-moz-range-thumb]:cursor-pointer"
          @input=${this.handleSliderInput}
          @change=${this.handleSliderChange}
        />
        <div
          class="text-sm font-medium text-center w-full leading-tight mb-1 flex flex-col items-center ${this
            .value > 0
            ? "text-white"
            : "text-white/60"}"
        >
          <span>${this.labelKey ? translateText(this.labelKey) : ""}</span>
          ${this.isEditing
            ? html`<input
                type="number"
                .min=${this.min}
                .max=${this.max}
                .valueAsNumber=${this.value}
                class="fortress-control w-20 min-h-10 bg-[#0d1116] text-white border border-white/15 text-center rounded-[4px] text-sm px-2 leading-none font-semibold font-inherit mt-1 focus-visible:outline-none focus-visible:border-malibu-blue focus-visible:ring-2 focus-visible:ring-malibu-blue/25"
                @input=${this.handleNumberInput}
                @blur=${() => {
                  this.isEditing = false;
                  this.handleNumberComplete();
                }}
                @keydown=${this.handleNumberKeyDown}
              />`
            : html`<span
                class="fortress-control min-w-[72px] min-h-10 inline-flex items-center justify-center text-center text-sm font-semibold select-none hover:text-white transition-colors mt-1 rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-malibu-blue/30 ${this
                  .value > 0
                  ? "text-white"
                  : "text-white/60"}"
                role="button"
                tabindex="0"
                @click=${this.enableEditing}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    this.enableEditing();
                    e.preventDefault();
                  }
                }}
              >
                ${this.value === 0 && this.disabledKey
                  ? translateText(this.disabledKey)
                  : this.defaultValue !== undefined &&
                      this.value === this.defaultValue &&
                      this.defaultLabelKey
                    ? html`${this.value}
                        <span class="text-white/40 uppercase"
                          >(${translateText(this.defaultLabelKey)})</span
                        >`
                    : this.value}
              </span>`}
        </div>
      </div>
    `;
  }
}
