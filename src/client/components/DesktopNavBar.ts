import { LitElement, TemplateResult, html } from "lit";
import { customElement } from "lit/decorators.js";
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
    this._closeUtilityMenu();
  };

  private _updateActiveState(pageId: string) {
    let utilityActive = false;
    this.querySelectorAll(".nav-menu-item").forEach((element) => {
      const active = (element as HTMLElement).dataset.page === pageId;
      element.classList.toggle("active", active);
      if (active && (element as HTMLElement).dataset.navGroup === "utility") {
        utilityActive = true;
      }
    });
    this.querySelector(".command-desktop-nav__more")?.classList.toggle(
      "has-active",
      utilityActive,
    );
  }

  private _closeUtilityMenu = () => {
    this.querySelector(".command-desktop-nav__more")?.removeAttribute("open");
  };

  private _onStoreClick = () => {
    this._notifications.onStoreClick();
    this._closeUtilityMenu();
  };

  private _onHelpClick = () => {
    this._notifications.onHelpClick();
    this._closeUtilityMenu();
  };

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
    const utilityHasNotification =
      this._notifications.showStoreDot() || this._notifications.showHelpDot();

    return html`
      <nav class="command-desktop-nav relative z-50">
        <div class="command-desktop-nav__inner">
          <div class="command-desktop-nav__brand">
            <span class="command-wordmark" aria-label="OpenFront">
              <span>OPEN</span><span class="command-wordmark__accent">FRONT</span>
            </span>
            <span
              id="game-version"
              class="game-version-display text-[10px] tabular-nums text-white/35"
            ></span>
          </div>

          <div class="command-desktop-nav__menu" aria-label="Primary">
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
          </div>

          <div class="command-desktop-nav__utility">
            <details class="command-desktop-nav__more">
              <summary
                class="command-desktop-nav__more-trigger"
                data-i18n-aria-label="main.menu"
                data-i18n-title="main.menu"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  aria-hidden="true"
                >
                  <path d="M5 8h14M5 12h14M5 16h14" />
                </svg>
                <span data-i18n="main.menu"></span>
                ${utilityHasNotification
                  ? this.notificationDot("bg-yellow-400")
                  : ""}
              </summary>

              <div class="command-desktop-nav__more-menu">
                <div class="relative no-crazygames">
                  <button
                    class="${itemClass} command-desktop-nav__more-item"
                    data-nav-group="utility"
                    data-page="page-item-store"
                    data-i18n="main.store"
                    @click=${this._onStoreClick}
                  ></button>
                  ${this._notifications.showStoreDot()
                    ? this.notificationDot("bg-red-500")
                    : ""}
                </div>
                <button
                  class="no-crazygames ${itemClass} command-desktop-nav__more-item"
                  data-nav-group="utility"
                  data-page="page-clan"
                  data-i18n="main.clans"
                  @click=${this._closeUtilityMenu}
                ></button>
                <div class="relative">
                  <button
                    class="${itemClass} command-desktop-nav__more-item"
                    data-nav-group="utility"
                    data-page="page-help"
                    data-i18n="main.help"
                    @click=${this._onHelpClick}
                  ></button>
                  ${this._notifications.showHelpDot()
                    ? this.notificationDot("bg-yellow-400")
                    : ""}
                </div>
                <button
                  class="${itemClass} command-desktop-nav__more-item"
                  data-nav-group="utility"
                  data-page="page-settings"
                  data-i18n="main.settings"
                  @click=${this._closeUtilityMenu}
                ></button>
              </div>
            </details>

            <button
              id="nav-account-button"
              class="nav-menu-item command-desktop-nav__account relative flex min-h-10 min-w-10 items-center justify-center gap-2 overflow-hidden px-2.5"
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
        </div>
      </nav>
    `;
  }
}
