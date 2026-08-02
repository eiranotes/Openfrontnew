import { html, LitElement, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { assetUrl } from "../../core/AssetUrls";
import { NavNotificationsController } from "./NavNotificationsController";

@customElement("mobile-nav-bar")
export class MobileNavBar extends LitElement {
  private _notifications = new NavNotificationsController(this);

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("showPage", this._onShowPage);
    const current = window.currentPageId;
    if (current) {
      void this.updateComplete.then(() => this._updateActiveState(current));
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("showPage", this._onShowPage);
  }

  private _onShowPage = (event: Event) => {
    this._updateActiveState((event as CustomEvent).detail);
  };

  private _updateActiveState(pageId: string) {
    this.querySelectorAll(".nav-menu-item").forEach((element) => {
      element.classList.toggle(
        "active",
        (element as HTMLElement).dataset.page === pageId,
      );
    });
  }

  private renderDot(colorClass: string): TemplateResult {
    return html`<span
      class="command-nav-dot ${colorClass}"
      aria-hidden="true"
    ></span>`;
  }

  render() {
    window.currentPageId ??= "page-play";
    const currentPage = window.currentPageId;
    const itemClass = "nav-menu-item command-mobile-nav__item cursor-pointer";

    return html`
      <div class="command-mobile-nav">
        <div class="command-mobile-nav__brand">
          <img src=${assetUrl("images/OpenFrontLogo.svg")} alt="OpenFront" />
          <span
            id="game-version"
            class="game-version-display ml-auto text-[10px] tabular-nums text-white/35"
          ></span>
        </div>

        <div class="command-mobile-nav__list">
          <button
            class="${itemClass} ${currentPage === "page-play"
              ? "active"
              : ""}"
            data-page="page-play"
            data-i18n="main.play"
          ></button>
          <button
            class="${itemClass}"
            data-page="page-stats"
            data-i18n="game_list.stats"
          ></button>
          <button
            class="${itemClass}"
            data-page="page-leaderboard"
            data-i18n="main.leaderboard"
          ></button>
          <button
            class="${itemClass}"
            data-page="page-news"
            @click=${this._notifications.onNewsClick}
          >
            <span data-i18n="main.news"></span>
            ${this._notifications.showNewsDot()
              ? this.renderDot("bg-red-500")
              : ""}
          </button>
          <button
            class="no-crazygames ${itemClass}"
            data-page="page-item-store"
            @click=${this._notifications.onStoreClick}
          >
            <span data-i18n="main.store"></span>
            ${this._notifications.showStoreDot()
              ? this.renderDot("bg-red-500")
              : ""}
          </button>
          <button
            class="no-crazygames ${itemClass}"
            data-page="page-clan"
            data-i18n="main.clans"
          ></button>
          <button
            class="${itemClass}"
            data-page="page-help"
            @click=${this._notifications.onHelpClick}
          >
            <span data-i18n="main.help"></span>
            ${this._notifications.showHelpDot()
              ? this.renderDot("bg-yellow-400")
              : ""}
          </button>
          <button
            class="${itemClass}"
            data-page="page-settings"
            data-i18n="main.settings"
          ></button>
          <button
            id="mobile-nav-account-button"
            class="${itemClass}"
            data-page="page-account"
            data-i18n="main.account"
          ></button>
        </div>
      </div>
    `;
  }
}
