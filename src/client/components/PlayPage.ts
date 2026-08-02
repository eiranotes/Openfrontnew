import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { crazyGamesSDK } from "../CrazyGamesSDK";
import "./CosmeticBackground";
import "./NewsBox";
import "./SteamWishlist";
import "./StreamingNow";

@customElement("play-page")
export class PlayPage extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div
        id="page-play"
        class="command-play-page flex min-h-0 w-full flex-col gap-3"
      >
        <token-login class="absolute"></token-login>
        <rewards-modal class="absolute"></rewards-modal>

        <div
          class="command-mobile-topbar fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)] lg:hidden"
        >
          <div
            class="grid h-14 grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 px-2"
          >
            <button
              id="hamburger-btn"
              class="flex h-11 w-11 items-center justify-center rounded-md border border-transparent text-white/80 transition-[background-color,border-color,color] duration-150 hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
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
                class="h-6 w-6"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 7h16M4 12h16M4 17h16"
                />
              </svg>
            </button>

            <div class="flex min-w-0 items-center justify-center">
              <span class="command-wordmark command-wordmark--mobile" aria-label="OpenFront">
                <span>OPEN</span><span class="command-wordmark__accent">FRONT</span>
              </span>
            </div>

            ${crazyGamesSDK.isOnCrazyGames()
              ? html`
                  <button
                    id="crazygames-account-btn"
                    data-page="page-account"
                    class="nav-menu-item flex h-11 w-11 items-center justify-center overflow-hidden rounded-md border border-transparent text-white/80 transition-[background-color,border-color,color] duration-150 hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
                    data-i18n-aria-label="main.account"
                    data-i18n-title="main.account"
                  >
                    <img
                      id="crazygames-account-avatar"
                      class="hidden h-8 w-8 rounded object-cover"
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
                      class="h-6 w-6"
                    >
                      <path d="M20 21a8 8 0 0 0-16 0" />
                      <path d="M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
                    </svg>
                  </button>
                `
              : html`<div aria-hidden="true" class="h-11 w-11"></div>`}
          </div>
        </div>

        <div class="h-[calc(56px+env(safe-area-inset-top))] lg:hidden"></div>

        <div
          class="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.34fr)]"
        >
          <div class="flex min-w-0 flex-col gap-2">
            <news-box></news-box>

            <div class="command-identity-bar relative min-h-[56px] overflow-hidden">
              <cosmetic-background
                class="pointer-events-none absolute inset-0 overflow-hidden rounded-md"
              ></cosmetic-background>
              <div
                class="relative z-10 flex min-h-[56px] min-w-0 items-center gap-2 bg-[#10161c]/90 p-1.5"
              >
                <flag-input
                  show-select-label
                  class="h-11 w-11 shrink-0"
                ></flag-input>
                <username-input class="h-11 min-w-0 flex-1"></username-input>
                <cosmetics-input
                  id="cosmetics-input-mobile"
                  show-select-label
                  class="no-crazygames h-11 w-11 shrink-0 rounded-md"
                ></cosmetics-input>
              </div>
            </div>
          </div>

          <streaming-now
            class="hidden min-w-0 flex-col lg:flex lg:h-full"
          ></streaming-now>
        </div>

        <game-mode-selector></game-mode-selector>

        <steam-wishlist
          campaign="home_mobile"
          class="block px-4 pb-[calc(12px+env(safe-area-inset-bottom))] lg:hidden"
        ></steam-wishlist>
      </div>
    `;
  }
}
