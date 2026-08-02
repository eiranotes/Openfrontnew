import { LitElement, html } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { documentStylesSheet } from "./SharedStyles";

export type OModalTab = { key: string; label: string };

@customElement("o-modal")
export class OModal extends LitElement {
  static styles = [documentStylesSheet()];

  @state() public isModalOpen = false;

  @query("[data-modal-scroll]") private scrollContainer?: HTMLElement;

  static openCount = 0;

  @property({ type: Boolean }) public inline = false;
  @property({ type: Boolean }) public alwaysMaximized = false;
  @property({ type: Boolean }) public hideCloseButton = false;
  @property({ type: String }) public title = "";
  @property({ type: Boolean }) public hideHeader = false;
  @property({ type: String }) public maxWidth = "";
  @property({ type: Array }) public tabs: OModalTab[] = [];
  @property({ type: String }) public activeTab = "";
  @property({ attribute: false }) public onTabChange?: (key: string) => void;

  public onClose?: () => void;

  public open() {
    if (this.isModalOpen) return;
    if (!this.inline) {
      OModal.openCount += 1;
      if (OModal.openCount === 1) document.body.style.overflow = "hidden";
    }
    this.isModalOpen = true;
  }

  public close() {
    if (!this.isModalOpen) return;
    this.isModalOpen = false;
    this.onClose?.();
    if (!this.inline) {
      OModal.openCount = Math.max(0, OModal.openCount - 1);
      if (OModal.openCount === 0) document.body.style.overflow = "";
    }
  }

  public getScrollTop(): number {
    return this.scrollContainer?.scrollTop ?? 0;
  }

  public setScrollTop(scrollTop: number): void {
    if (this.scrollContainer) this.scrollContainer.scrollTop = scrollTop;
  }

  disconnectedCallback() {
    if (this.isModalOpen && !this.inline) {
      OModal.openCount = Math.max(0, OModal.openCount - 1);
      if (OModal.openCount === 0) document.body.style.overflow = "";
    }
    super.disconnectedCallback();
  }

  private handleTabClick(key: string) {
    this.onTabChange?.(key);
  }

  private renderTabs() {
    return html`
      <div
        role="tablist"
        class="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/10 bg-[#0d1318] px-3"
      >
        ${this.tabs.map((tab) => {
          const active = this.activeTab === tab.key;
          return html`
            <button
              type="button"
              role="tab"
              data-key=${tab.key}
              aria-selected=${active}
              class="relative min-h-11 shrink-0 border-b-2 px-3 text-sm font-semibold transition-[background-color,border-color,color] duration-150 ${active
                ? "border-malibu-blue bg-white/[0.035] text-white"
                : "border-transparent text-white/50 hover:bg-white/[0.035] hover:text-white/80"}"
              @click=${() => this.handleTabClick(tab.key)}
            >
              ${tab.label}
            </button>
          `;
        })}
      </div>
    `;
  }

  render() {
    const shouldRender = this.isModalOpen || this.inline;
    if (!shouldRender) return html``;

    const backdropClass = this.inline
      ? "relative z-10 flex h-full w-full items-stretch bg-transparent"
      : "fixed inset-0 z-[9999] flex items-end justify-center overflow-hidden bg-black/75 sm:items-center sm:p-4";

    const wrapperClass = this.inline
      ? "relative m-0 flex h-full max-h-none w-full max-w-full flex-col shadow-none"
      : `relative flex h-[100dvh] w-full flex-col overflow-hidden border-white/10 bg-[#10161c] shadow-[0_18px_48px_rgba(0,0,0,0.48)] sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:min-h-[280px] sm:w-[min(94vw,900px)] sm:rounded-lg sm:border ${
          this.alwaysMaximized ? "sm:h-[calc(100dvh-2rem)]" : ""
        }`;
    const wrapperStyle =
      !this.inline && this.maxWidth ? `max-width: ${this.maxWidth};` : "";

    const hasTabs = this.tabs.length > 0;
    const sectionClass =
      "relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#10161c] text-white";

    return html`
      <aside
        class=${backdropClass}
        role=${this.inline ? "region" : "dialog"}
        aria-modal=${this.inline ? "false" : "true"}
        @click=${this.inline ? null : () => this.close()}
      >
        <div
          class=${wrapperClass}
          style=${wrapperStyle}
          @click=${(event: Event) => event.stopPropagation()}
        >
          ${this.inline || this.hideCloseButton
            ? html``
            : html`
                <button
                  type="button"
                  aria-label="Close"
                  class="absolute right-2 top-[calc(8px+env(safe-area-inset-top))] z-20 flex h-10 w-10 items-center justify-center rounded-md border border-transparent text-xl text-white/60 transition-[background-color,border-color,color] duration-150 hover:border-white/10 hover:bg-white/[0.06] hover:text-white sm:right-3 sm:top-3"
                  @click=${() => this.close()}
                >
                  ×
                </button>
              `}
          ${!this.hideHeader && this.title
            ? html`
                <header
                  class="flex min-h-14 shrink-0 items-center border-b border-white/10 bg-[#0d1318] px-4 pr-14 text-lg font-semibold sm:px-5"
                >
                  ${this.title}
                </header>
              `
            : html``}
          <section class=${sectionClass}>
            <slot name="header"></slot>
            ${hasTabs ? this.renderTabs() : html``}
            <div
              data-modal-scroll
              class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
              <slot></slot>
            </div>
          </section>
        </div>
      </aside>
    `;
  }
}
