import { chromium } from "playwright";

const siteUrl =
  process.env.SMOKE_SITE_URL ?? "http://127.0.0.1:4173/Openfrontnew/";
const screenshotPath =
  process.env.SMOKE_SCREENSHOT ?? "browser-single-player-smoke.png";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-gl=swiftshader",
    "--enable-webgl",
    "--disable-dev-shm-usage",
    "--lang=en-US",
  ],
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: "en-US",
});

await context.addInitScript(() => {
  Object.defineProperty(navigator, "language", {
    configurable: true,
    get: () => "en-US",
  });
  Object.defineProperty(navigator, "languages", {
    configurable: true,
    get: () => ["en-US", "en"],
  });
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
  window.ramp = {
    que: [],
    passiveMode: true,
    spaAddAds() {},
    destroyUnits: async () => {},
    spaNewPage() {},
    spaAds() {},
    onPlayerReady: null,
    addUnits: async () => {},
    displayUnits() {},
  };
});

const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];
const workerDiagnostics = [];

page.on("pageerror", (error) => {
  pageErrors.push(error.stack ?? error.message);
});
page.on("console", (message) => {
  const text = message.text();
  if (message.type() === "error") consoleErrors.push(text);
  if (text.includes("__SMOKE_WORKER_")) workerDiagnostics.push(text);
  console.log(`[browser:${message.type()}] ${text}`);
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
    requestUrl.origin === allowedOrigin &&
    /\/assets\/Worker\.worker-[^/]+\.js$/.test(requestUrl.pathname)
  ) {
    const response = await route.fetch();
    const body = await response.text();
    const diagnostics = `
self.addEventListener("unhandledrejection", (event) => {
  let reason;
  try {
    reason = event.reason?.stack || event.reason?.message || JSON.stringify(event.reason);
  } catch {
    reason = String(event.reason);
  }
  console.error("__SMOKE_WORKER_UNHANDLED__ " + reason);
});
self.addEventListener("error", (event) => {
  console.error(
    "__SMOKE_WORKER_ERROR__ " + event.message +
      " @ " + event.filename + ":" + event.lineno + ":" + event.colno,
  );
});
`;
    await route.fulfill({
      response,
      body: diagnostics + body,
      headers: {
        ...response.headers(),
        "content-type": "application/javascript; charset=utf-8",
      },
    });
    return;
  }

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

let passed = false;
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
  try {
    await canvas.waitFor({ state: "visible", timeout: 45_000 });
  } catch (error) {
    throw new Error(
      `${error.message}\nWorker diagnostics:\n${workerDiagnostics.join("\n") || "none"}`,
    );
  }

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

  if (pageErrors.length > 0) {
    throw new Error(`Browser page errors:\n${pageErrors.join("\n\n")}`);
  }

  passed = true;
  console.log(
    JSON.stringify(
      {
        status: "passed",
        defaults,
        emitted,
        runtime,
        consoleErrorCount: consoleErrors.length,
        workerDiagnostics,
      },
      null,
      2,
    ),
  );
} finally {
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch (error) {
    console.error(`Failed to capture smoke screenshot: ${error}`);
  }
  await browser.close();
  if (!passed && workerDiagnostics.length > 0) {
    console.error(workerDiagnostics.join("\n"));
  }
}
