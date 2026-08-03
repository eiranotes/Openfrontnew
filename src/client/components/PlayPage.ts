import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { crazyGamesSDK } from "../CrazyGamesSDK";
import "../styles/home-operations-desk.css";
import "../styles/fortress-home-v2-layout.css";
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
      <div id="page-play" class="command-play-page fortress-home-v2">
        <token-login class="absolute"></token-login>
        <rewards-modal class="absolute"></rewards-modal>

        <div
          class="command-mobile-topbar fortress-mobile-topbar fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)] lg:hidden"
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

            <div class="fortress-mobile-brand" aria-label="Fortress">
              <span class="fortress-mobile-brand__mark" aria-hidden="true"
                >F</span
              >
              <span class="fortress-mobile-brand__name">FORTRESS</span>
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

        <div class="fortress-home-frame">
          <header class="fortress-home-intro">
            <div class="fortress-home-intro__folio" aria-hidden="true">
              <span>01</span>
              <span>COMMAND</span>
            </div>
            <div class="fortress-home-intro__lockup">
              <h1 id="command-home-title" class="fortress-home-intro__title">
                FORTRESS
              </h1>
              <p class="fortress-home-intro__subtitle" translate="no">
                OPENFRONT ENGINE · TERRITORY / LOGISTICS / ALLIANCE
              </p>
            </div>
            <div class="fortress-home-intro__status" aria-hidden="true">
              <span class="fortress-home-intro__status-dot"></span>
              <span>ONLINE</span>
            </div>
          </header>

          <div class="command-home-shell fortress-home-layout">
            <main
              class="command-home-stage fortress-home-stage"
              aria-labelledby="command-home-title"
            >
              <game-mode-selector></game-mode-selector>
            </main>

            <aside class="command-home-utility fortress-home-utility">
              <section
                class="fortress-rail-section fortress-profile"
                aria-labelledby="fortress-profile-title"
              >
                <div class="fortress-rail-heading">
                  <span aria-hidden="true">A</span>
                  <h2 id="fortress-profile-title" data-i18n="main.account"></h2>
                </div>
                <div class="fortress-profile__controls">
                  <flag-input
                    show-select-label
                    class="fortress-profile__flag"
                  ></flag-input>
                  <username-input
                    class="fortress-profile__name"
                  ></username-input>
                  <cosmetics-input
                    id="cosmetics-input-mobile"
                    show-select-label
                    class="no-crazygames fortress-profile__cosmetics"
                  ></cosmetics-input>
                </div>
              </section>

              <section
                class="fortress-rail-section fortress-briefing"
                aria-labelledby="fortress-briefing-title"
              >
                <div class="fortress-rail-heading">
                  <span aria-hidden="true">B</span>
                  <h2 id="fortress-briefing-title" data-i18n="main.news"></h2>
                </div>
                <news-box></news-box>
              </section>

              <streaming-now
                class="command-stream-panel fortress-stream-panel"
              ></streaming-now>
            </aside>
          </div>
        </div>

        <steam-wishlist-button
          campaign="home_mobile"
          class="command-home-steam command-steam-promo-slot fortress-home-steam lg:hidden"
        ></steam-wishlist-button>
      </div>
    `;
  }
}
