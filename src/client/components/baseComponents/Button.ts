import { LitElement, TemplateResult, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { translateText } from "../../Utils";

type ButtonVariant = "primary" | "secondary" | "danger" | "warning" | "ghost";
type ButtonSize = "xs" | "sm" | "md" | "lg";
type ButtonWidth = "auto" | "block" | "blockDesktop" | "fill";
type IconPosition = "left" | "right" | "only";

@customElement("o-button")
export class OButton extends LitElement {
  @property() title = "";
  @property() translationKey = "";
  @property() variant: ButtonVariant = "primary";
  @property() size: ButtonSize = "md";
  @property() width: ButtonWidth = "auto";
  @property() iconPosition: IconPosition = "left";
  @property({ attribute: false }) icon?: TemplateResult;
  @property({ type: Boolean }) disable = false;
  @property({ type: Boolean }) submit = false;

  createRenderRoot() {
    return this;
  }

  private readonly BASE =
    "relative overflow-hidden rounded-md border font-semibold leading-tight " +
    "outline-none text-center whitespace-normal break-words " +
    "transition-[background-color,border-color,color,opacity,transform] duration-150 " +
    "focus-visible:ring-2 focus-visible:ring-aquarius/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080c10] " +
    "active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0";

  private variantClasses(): string {
    switch (this.variant) {
      case "primary":
        return "border-malibu-blue bg-malibu-blue text-white hover:border-aquarius hover:bg-aquarius disabled:border-gray-600 disabled:bg-gray-600 disabled:text-gray-300";
      case "secondary":
        return "border-white/10 bg-[#161d24] text-white hover:border-white/20 hover:bg-[#1b252e] disabled:bg-[#10161c] disabled:text-white/35";
      case "danger":
        return "border-red-500/80 bg-red-600 text-white hover:border-red-400 hover:bg-red-500 disabled:border-red-900 disabled:bg-red-950 disabled:text-white/35";
      case "warning":
        return "border-yellow-400/70 bg-yellow-400 text-gray-950 hover:border-yellow-300 hover:bg-yellow-300 disabled:border-yellow-900 disabled:bg-yellow-950 disabled:text-white/35";
      case "ghost":
        return "border-transparent bg-transparent text-white/70 hover:border-white/10 hover:bg-white/[0.06] hover:text-white disabled:text-white/30";
    }
  }

  private sizeClasses(): string {
    if (this.iconPosition === "only") {
      switch (this.size) {
        case "xs":
          return "h-7 w-7 text-xs";
        case "sm":
          return "h-9 w-9 text-sm";
        case "md":
          return "h-10 w-10 text-base max-[639px]:h-11 max-[639px]:w-11";
        case "lg":
          return "h-12 w-12 text-lg";
      }
    }
    switch (this.size) {
      case "xs":
        return "min-h-7 px-2 py-1 text-xs";
      case "sm":
        return "min-h-9 px-3 py-1.5 text-sm max-[639px]:min-h-11";
      case "md":
        return "min-h-10 px-4 py-2 text-sm max-[639px]:min-h-11";
      case "lg":
        return "min-h-12 px-5 py-2.5 text-base";
    }
  }

  private widthClasses(): string {
    switch (this.width) {
      case "auto":
        return "inline-flex items-center justify-center gap-2";
      case "block":
        return "flex w-full items-center justify-center gap-2";
      case "blockDesktop":
        return "flex w-full items-center justify-center gap-2 lg:mx-auto lg:w-1/2";
      case "fill":
        return "flex h-full w-full items-center justify-center gap-2";
    }
  }

  render() {
    const label =
      this.translationKey === ""
        ? this.title
        : translateText(this.translationKey);
    const iconOnly = this.iconPosition === "only";
    const classes = `${this.BASE} ${this.variantClasses()} ${this.sizeClasses()} ${this.widthClasses()}`;

    return html`
      <button
        class=${classes}
        ?disabled=${this.disable}
        type=${this.submit ? "submit" : "button"}
        aria-label=${iconOnly ? label : nothing}
      >
        ${this.icon && this.iconPosition !== "right" ? this.icon : nothing}
        ${iconOnly ? nothing : html`<span class="min-w-0">${label}</span>`}
        ${this.icon && this.iconPosition === "right" ? this.icon : nothing}
      </button>
    `;
  }
}
