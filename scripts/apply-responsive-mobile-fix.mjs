import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function write(relativePath, content) {
  fs.writeFileSync(path.join(root, relativePath), content);
}

function replaceOnce(content, before, after, label) {
  if (content.includes(after)) return content;
  if (!content.includes(before)) {
    throw new Error(`Responsive mobile patch anchor missing: ${label}`);
  }
  return content.replace(before, after);
}

const cssPath = "src/client/styles/command-ui.css";
let css = read(cssPath);
const oldMobileViewportRule = `/* Keep the single-player action bar inside the mobile viewport. */
@media (max-width: 639px) {
  single-player-modal .command-single-player {
    height: calc(100dvh - 56px);
    max-height: calc(100dvh - 56px);
  }

  single-player-modal .command-settings-scroll {
    padding-bottom: 12px;
  }
}

`;
const previousMobileViewportRule = `/* Keep the single-player action bar inside the mobile viewport. */
@media (max-width: 639px) {
  single-player-modal .command-single-player {
    height: calc(100dvh - 60px);
    max-height: calc(100dvh - 60px);
  }

  single-player-modal .command-settings-scroll {
    padding-bottom: 12px;
  }

  single-player-modal button,
  single-player-modal input:not([type="range"]),
  single-player-modal select,
  single-player-modal [role="button"],
  single-player-modal [role="tab"] {
    min-height: 44px !important;
  }

  single-player-modal input[type="range"] {
    min-height: 44px;
  }
}

`;
const mobileViewportRule = `/* Keep the single-player action bar inside the mobile viewport. */
@media (max-width: 639px) {
  single-player-modal .command-single-player {
    height: calc(100dvh - 60px);
    max-height: calc(100dvh - 60px);
  }

  single-player-modal .command-settings-scroll {
    padding-bottom: 12px;
  }

  single-player-modal button,
  single-player-modal input:not([type="range"]),
  single-player-modal select,
  single-player-modal [role="button"],
  single-player-modal [role="tab"] {
    min-height: 44px !important;
  }

  single-player-modal input[type="range"] {
    min-height: 44px;
  }

  .command-secondary-actions .command-action-button {
    padding-inline: 8px;
    font-size: 12px;
    letter-spacing: 0.01em;
  }
}

`;
if (css.includes(previousMobileViewportRule)) {
  css = css.replace(previousMobileViewportRule, mobileViewportRule);
  write(cssPath, css);
} else if (css.includes(oldMobileViewportRule)) {
  css = css.replace(oldMobileViewportRule, mobileViewportRule);
  write(cssPath, css);
} else if (!css.includes(mobileViewportRule)) {
  const anchor = "@media (pointer: coarse) {";
  if (!css.includes(anchor)) {
    throw new Error("Responsive mobile CSS anchor missing");
  }
  css = css.replace(anchor, mobileViewportRule + anchor);
  write(cssPath, css);
}

const controlPanelPath = "src/client/hud/layers/ControlPanel.ts";
let controlPanel = read(controlPanelPath);
controlPanel = replaceOnce(
  controlPanel,
  `      <div class="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2">
        <div
          class="command-resource relative flex min-h-10 items-center justify-center gap-1 rounded-md border px-2 text-xs font-semibold text-yellow-300"`,
  `      <div class="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2">
        <div
          class="command-resource relative flex min-h-11 items-center justify-center gap-1 rounded-md border px-2 text-xs font-semibold text-yellow-300"`,
  "mobile gold target height",
);
controlPanel = replaceOnce(
  controlPanel,
  `      <div class="mt-2 grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2">
        <div
          class="command-resource flex min-h-10 items-center justify-center gap-1 rounded-md border px-2 text-xs font-semibold text-white"
          translate="no"
        >
          <img
            src=${swordIcon}
            alt=""
            aria-hidden="true"
            width="13"
            height="13"
            style="filter: brightness(0) invert(1);"
          />
          <span class="tabular-nums"
            >${(this.attackRatio * 100).toFixed(0)}%</span
          >
          <span class="truncate text-[10px] text-white/50">
            ${renderTroops(
              (this.game?.myPlayer()?.troops() ?? 0) * this.attackRatio,
            )}
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="100"
          aria-label="Attack ratio"
          .value=${String(Math.round(this.attackRatio * 100))}
          @input=${(e: Event) => this.handleRatioSliderInput(e)}
          @pointerup=${(e: Event) => this.handleRatioSliderPointerUp(e)}
          class="h-10 w-full accent-aquarius"
        />
      </div>`,
  `      <div class="mt-2 grid grid-cols-[76px_minmax(0,1fr)] items-center gap-2">
        <div
          class="command-resource flex min-h-11 items-center justify-center gap-1 rounded-md border px-2 text-sm font-semibold text-white"
          translate="no"
          title="${renderTroops(
            (this.game?.myPlayer()?.troops() ?? 0) * this.attackRatio,
          )} troops"
        >
          <img
            src=${swordIcon}
            alt=""
            aria-hidden="true"
            width="13"
            height="13"
            style="filter: brightness(0) invert(1);"
          />
          <span class="tabular-nums"
            >${(this.attackRatio * 100).toFixed(0)}%</span
          >
        </div>
        <input
          type="range"
          min="1"
          max="100"
          aria-label="Attack ratio"
          .value=${String(Math.round(this.attackRatio * 100))}
          @input=${(e: Event) => this.handleRatioSliderInput(e)}
          @pointerup=${(e: Event) => this.handleRatioSliderPointerUp(e)}
          class="h-11 w-full accent-aquarius"
        />
      </div>`,
  "compact mobile attack ratio",
);
write(controlPanelPath, controlPanel);

const smokePath = "scripts/browser-single-player-smoke.mjs";
let smoke = read(smokePath);
smoke = replaceOnce(
  smoke,
  "const viewportHeight = Number(process.env.SMOKE_VIEWPORT_HEIGHT ?? 900);\n",
  "const viewportHeight = Number(process.env.SMOKE_VIEWPORT_HEIGHT ?? 900);\nconst mobileViewport = viewportWidth <= 430;\n",
  "mobile viewport flag",
);
smoke = replaceOnce(
  smoke,
  `const context = await browser.newContext({
  viewport: { width: viewportWidth, height: viewportHeight },
  locale: "en-US",
});`,
  `const context = await browser.newContext({
  viewport: { width: viewportWidth, height: viewportHeight },
  locale: "en-US",
  isMobile: mobileViewport,
  hasTouch: mobileViewport,
  deviceScaleFactor: mobileViewport ? 2 : 1,
});`,
  "mobile browser context",
);
smoke = replaceOnce(
  smoke,
  `const modalShell = modal.querySelector("o-modal")?.shadowRoot?.querySelector("[role='dialog'] > div");`,
  `const modalShell = modal.querySelector("o-modal")?.shadowRoot?.querySelector("aside > div");`,
  "modal shell selector",
);
smoke = replaceOnce(
  smoke,
  `  if (uiLayout.viewport.width <= 430 && uiLayout.startButtonHeight < 44) {
    throw new Error(\`Mobile start button is too small: \${JSON.stringify(uiLayout)}\`);
  }
  if (!uiLayout.footerVisible) {`,
  `  if (uiLayout.viewport.width <= 430 && uiLayout.startButtonHeight < 44) {
    throw new Error(\`Mobile start button is too small: \${JSON.stringify(uiLayout)}\`);
  }
  if (uiLayout.viewport.width <= 430 && uiLayout.minInteractiveHeight < 44) {
    throw new Error(\`Mobile interactive target is too small: \${JSON.stringify(uiLayout)}\`);
  }
  if (!uiLayout.footerVisible) {`,
  "mobile touch target assertion",
);
write(smokePath, smoke);

console.log("Applied responsive mobile viewport, density, and touch fixes.");
