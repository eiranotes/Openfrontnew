import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { crazyGamesSDK } from "../CrazyGamesSDK";
import "./CosmeticBackground";
import "./NewsBox";
import "./SteamWishlistButton";
import "./StreamingNow";

@customElement("play-page")
export class PlayPage extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div id="page-play" class="command-play-page">
        <token-login class="absolute"></token-login>
        <rewards-modal class="absolute"></rewards-modal>

        <div
          class="command-mobile-topbar fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)] lg:hidden"
        >
          <div class="command-mobile-topbar__inner">
            <button
              id="hamburger-btn"
              class="command-icon-button"
              data-i18n-aria-label="main.menu"
              aria-expanded="false"
              aria-controls="sidebar-menu"
              aria-haspopup="dialog"
              data-i18n-title="main.menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.6"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 7h16M4 12h16M4 17h16"
                />
              </svg>
            </button>

            <div class="command-mobile-topbar__brand">
              <span
                class="command-wordmark command-wordmark--mobile"
                aria-label="OpenFront"
              >
                <span>OPEN</span
                ><span class="command-wordmark__accent">FRONT</span>
              </span>
            </div>

            ${crazyGamesSDK.isOnCrazyGames()
              ? html`
                  <button
                    id="crazygames-account-btn"
                    data-page="page-account"
                    class="command-icon-button nav-menu-item"
                    data-i18n-aria-label="main.account"
                    data-i18n-title="main.account"
                  >
                    <img
                      id="crazygames-account-avatar"
                      class="hidden"
                      alt=""
                      referrerpolicy="no-referrer"
                    />
                    <svg
                      id="crazygames-account-icon"
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
                  </button>
                `
              : html`<div aria-hidden="true" class="h-11 w-11"></div>`}
          </div>
        </div>

        <div class="command-mobile-topbar-spacer lg:hidden"></div>

        <section class="command-home-utility" aria-label="Player setup">
          <div class="command-home-brief">
            <news-box></news-box>

            <div class="command-identity-bar relative overflow-hidden">
              <cosmetic-background
                class="pointer-events-none absolute inset-0 overflow-hidden"
              ></cosmetic-background>
              <div class="command-identity-bar__controls">
                <flag-input
                  show-select-label
                  class="h-11 w-11 shrink-0"
                ></flag-input>
                <username-input class="h-11 min-w-0 flex-1"></username-input>
                <cosmetics-input
                  id="cosmetics-input-mobile"
                  show-select-label
                  class="no-crazygames h-11 w-11 shrink-0"
                ></cosmetics-input>
              </div>
            </div>
          </div>

          <streaming-now class="command-stream-panel"></streaming-now>
        </section>

        <game-mode-selector></game-mode-selector>

        <steam-wishlist-button
          campaign="home_mobile"
          class="command-home-steam command-steam-promo-slot lg:hidden"
        ></steam-wishlist-button>
      </div>
    `;
  }
}
