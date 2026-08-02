import { LitElement, TemplateResult, html } from "lit";
import { customElement } from "lit/decorators.js";
import { assetUrl } from "../../core/AssetUrls";
import { NavNotificationsController } from "./NavNotificationsController";

@customElement("desktop-nav-bar")
export class DesktopNavBar extends LitElement {
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

  private notificationDot(colorClass: string): TemplateResult {
    return html`<span
      class="command-nav-dot ${colorClass} absolute right-1.5 top-1.5"
      aria-hidden="true"
    ></span>`;
  }

  render() {
    window.currentPageId ??= "page-play";
    const currentPage = window.currentPageId;
    const itemClass =
      "nav-menu-item command-desktop-nav__item relative cursor-pointer";

    return html`
      <nav class="command-desktop-nav relative z-50">
        <div class="command-desktop-nav__inner">
          <div class="command-desktop-nav__brand">
            <img
              src=${assetUrl("images/OpenFrontLogo.svg")}
              alt="OpenFront"
            />
            <span
              id="game-version"
              class="game-version-display text-[10px] tabular-nums text-white/35"
            ></span>
          </div>

          <div class="command-desktop-nav__menu">
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
            <div class="relative">
              <button
                class="${itemClass}"
                data-page="page-news"
                data-i18n="main.news"
                @click=${this._notifications.onNewsClick}
              ></button>
              ${this._notifications.showNewsDot()
                ? this.notificationDot("bg-red-500")
                : ""}
            </div>
            <div class="relative no-crazygames">
              <button
                class="${itemClass}"
                data-page="page-item-store"
                data-i18n="main.store"
                @click=${this._notifications.onStoreClick}
              ></button>
              ${this._notifications.showStoreDot()
                ? this.notificationDot("bg-red-500")
                : ""}
            </div>
            <button
              class="no-crazygames ${itemClass}"
              data-page="page-clan"
              data-i18n="main.clans"
            ></button>
            <div class="relative">
              <button
                class="${itemClass}"
                data-page="page-help"
                data-i18n="main.help"
                @click=${this._notifications.onHelpClick}
              ></button>
              ${this._notifications.showHelpDot()
                ? this.notificationDot("bg-yellow-400")
                : ""}
            </div>
            <button
              class="${itemClass}"
              data-page="page-settings"
              data-i18n="main.settings"
            ></button>
          </div>

          <button
            id="nav-account-button"
            class="nav-menu-item relative flex min-h-10 min-w-10 items-center justify-center gap-2 overflow-hidden rounded-md border border-white/10 bg-[#10161c] px-2.5 text-white/75 transition-[background-color,border-color,color] duration-150 hover:border-white/20 hover:bg-[#1b252e] hover:text-white"
            data-page="page-account"
            data-i18n-aria-label="main.account"
            data-i18n-title="main.account"
          >
            <img
              id="nav-account-avatar"
              class="hidden h-7 w-7 rounded object-cover"
              alt=""
              data-i18n-alt="main.discord_avatar_alt"
              referrerpolicy="no-referrer"
            />
            <span
              id="nav-account-loading-spinner"
              class="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/70"
              aria-hidden="true"
            ></span>
            <svg
              id="nav-account-person-icon"
              class="hidden h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M20 21a8 8 0 0 0-16 0" />
              <path d="M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
            </svg>
            <span
              id="nav-account-email-badge"
              class="hidden absolute bottom-0.5 right-0.5 h-3.5 w-3.5 items-center justify-center rounded-full border border-white/20 bg-slate-900"
              aria-hidden="true"
            ></span>
            <span
              id="nav-account-signin-text"
              class="hidden text-xs font-semibold"
              data-i18n="main.sign_in"
            ></span>
          </button>
        </div>
      </nav>
    `;
  }
}
