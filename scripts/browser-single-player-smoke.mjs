import { chromium } from "playwright";

const siteUrl = process.env.SMOKE_SITE_URL ?? "http://127.0.0.1:4173/Openfrontnew/";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-gl=swiftshader",
    "--enable-webgl",
    "--disable-dev-shm-usage",
  ],
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});

await context.addInitScript(() => {
  window.turnstile = {
    render(_target, options) {
      queueMicrotask(() => options?.callback?.("browser-smoke-token"));
      return "browser-smoke-widget";
    },
    remove() {},
    reset() {},
  };
  window.PageOS = { session: { newPageView() {} } };
  window.adsEnabled = false;
});

const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];

page.on("pageerror", (error) => {
  pageErrors.push(error.stack ?? error.message);
});
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
  console.log(`[browser:${message.type()}] ${message.text()}`);
});
page.on("requestfailed", (request) => {
  const url = request.url();
  if (url.startsWith(new URL(siteUrl).origin)) {
    console.log(`[requestfailed] ${url}: ${request.failure()?.errorText}`);
  }
});

const allowedOrigin = new URL(siteUrl).origin;
await page.route("**/*", async (route) => {
  const requestUrl = new URL(route.request().url());
  if (
    requestUrl.origin === allowedOrigin ||
    requestUrl.protocol === "blob:" ||
    requestUrl.protocol === "data:"
  ) {
    await route.continue();
  } else {
    await route.abort("blockedbyclient");
  }
});

try {
  await page.goto(siteUrl, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });

  await page.waitForFunction(
    () =>
      customElements.get("single-player-modal") !== undefined &&
      document.querySelector("single-player-modal") !== null &&
      document.querySelector("username-input") !== null,
    undefined,
    { timeout: 60_000 },
  );

  const defaults = await page.evaluate(async () => {
    const modal = document.querySelector("single-player-modal");
    await modal.updateComplete;
    return {
      map: modal.selectedMap,
      difficulty: modal.selectedDifficulty,
      bots: modal.bots,
      compact: modal.compactMap,
      disabledUnits: [...modal.disabledUnits],
    };
  });

  if (
    defaults.map !== "World" ||
    defaults.difficulty !== "Easy" ||
    defaults.bots !== 400 ||
    defaults.compact !== false ||
    defaults.disabledUnits.length !== 0
  ) {
    throw new Error(`Unexpected original defaults: ${JSON.stringify(defaults)}`);
  }

  await page.evaluate(async () => {
    window.__singlePlayerSmokeConfig = null;
    document.addEventListener(
      "join-lobby",
      (event) => {
        const config = event.detail?.gameStartInfo?.config;
        window.__singlePlayerSmokeConfig = config
          ? {
              gameMap: config.gameMap,
              gameMapSize: config.gameMapSize,
              difficulty: config.difficulty,
              bots: config.bots,
              gameMode: config.gameMode,
              playerTeams: config.playerTeams,
              gameType: config.gameType,
            }
          : null;
      },
      { once: true },
    );

    const modal = document.querySelector("single-player-modal");
    modal.selectedMap = "Europe";
    modal.selectedDifficulty = "Hard";
    modal.bots = 8;
    modal.compactMap = true;
    modal.gameMode = "Team";
    modal.teamCount = 4;
    modal.nations = 0;
    modal.defaultNationCount = 0;
    modal.disabledUnits = [];
    modal.requestUpdate();
    await modal.updateComplete;
    await modal.startGame();
  });

  await page.waitForFunction(
    () => window.__singlePlayerSmokeConfig !== null,
    undefined,
    { timeout: 60_000 },
  );

  const emitted = await page.evaluate(() => window.__singlePlayerSmokeConfig);
  const expected = {
    gameMap: "Europe",
    gameMapSize: "Compact",
    difficulty: "Hard",
    bots: 8,
    gameMode: "Team",
    playerTeams: 4,
    gameType: "Singleplayer",
  };
  for (const [key, value] of Object.entries(expected)) {
    if (emitted[key] !== value) {
      throw new Error(
        `Config mismatch for ${key}: expected ${value}, got ${emitted[key]}`,
      );
    }
  }

  await page.waitForFunction(
    () => document.body.classList.contains("in-game"),
    undefined,
    { timeout: 120_000 },
  );
  const canvas = page.locator("#app canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 60_000 });

  const box = await canvas.boundingBox();
  if (!box || box.width < 100 || box.height < 100) {
    throw new Error(`Invalid game canvas bounds: ${JSON.stringify(box)}`);
  }

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(8_000);

  const runtime = await page.evaluate(() => ({
    inGame: document.body.classList.contains("in-game"),
    path: window.location.pathname,
    canvasCount: document.querySelectorAll("#app canvas").length,
    appChildren: document.querySelector("#app")?.childElementCount ?? 0,
  }));

  if (!runtime.inGame || runtime.canvasCount < 1 || runtime.appChildren < 1) {
    throw new Error(`Game runtime did not remain active: ${JSON.stringify(runtime)}`);
  }

  await page.screenshot({
    path: process.env.SMOKE_SCREENSHOT ?? "browser-single-player-smoke.png",
    fullPage: true,
  });

  if (pageErrors.length > 0) {
    throw new Error(`Browser page errors:\n${pageErrors.join("\n\n")}`);
  }

  console.log(
    JSON.stringify(
      {
        status: "passed",
        defaults,
        emitted,
        runtime,
        consoleErrorCount: consoleErrors.length,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
