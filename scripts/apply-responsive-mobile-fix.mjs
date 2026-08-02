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
const mobileViewportRule = `/* Keep the single-player action bar inside the mobile viewport. */
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
if (!css.includes(mobileViewportRule)) {
  const anchor = "@media (pointer: coarse) {";
  if (!css.includes(anchor)) {
    throw new Error("Responsive mobile CSS anchor missing");
  }
  css = css.replace(anchor, mobileViewportRule + anchor);
  write(cssPath, css);
}

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

console.log("Applied responsive mobile viewport and touch fixes.");
