import { chromium } from "playwright";

const siteUrl = process.env.SMOKE_SITE_URL ?? "http://127.0.0.1:4173/Openfrontnew/";
const screenshotPath =
  process.env.SMOKE_SCREENSHOT ?? "browser-single-player-smoke.png";
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
  locale: "en-US",
});

await context.addInitScript(() => {
  window.turnstile = {
    render(_target, options) {
      queueMicrotask(() => options?.callback?.("browser-smoke-token"));
      return "browser-smoke-widget";
    },
    execute() {},
    remove() {},
    reset() {},
  };
  window.PageOS = { session: { newPageView() {} } };
  window.adsEnabled = false;
  window.ramp = {
    que: [],
    passiveMode: true,
    async destroyUnits() {},
    spaAddAds() {},
    spaNewPage() {},
    spaAds() {},
    async addUnits() {},
    displayUnits() {},
    onPlayerReady: null,
  };
  window.googletag = { cmd: [], pubads: () => ({ set() {} }) };
  window.Bolt = {
    on() {},
    BOLT_AD_REQUEST_START: "",
    BOLT_AD_IMPRESSION: "",
    BOLT_AD_STARTED: "",
    BOLT_FIRST_QUARTILE: "",
    BOLT_MIDPOINT: "",
    BOLT_THIRD_QUARTILE: "",
    BOLT_AD_COMPLETE: "",
    BOLT_AD_ERROR: "",
    BOLT_AD_PAUSED: "",
    BOLT_AD_CLICKED: "",
    SHOW_HIDDEN_CONTAINER: "",
  };
});

const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];
const criticalErrors = [];

page.on("pageerror", (error) => {
  const text = error.stack ?? error.message;
  pageErrors.push(text);
  console.log(`[pageerror] ${text}`);
});
page.on("console", (message) => {
  const text = message.text();
  if (message.type() === "error") {
    consoleErrors.push(text);
    if (
      /error creating client game|GLUnavailable|WebGL2.*unavailable|Worker initialization timeout/i.test(
        text,
      )
    ) {
      criticalErrors.push(text);
    }
  }
  console.log(`[browser:${message.type()}] ${text}`);
});
page.on("requestfailed", (request) => {
  const url = request.url();
  if (url.startsWith(new URL(siteUrl).origin)) {
    console.log(`[requestfailed] ${url}: ${request.failure()?.errorText}`);
  }
});
page.on("worker", (worker) => {
  console.log(`[worker] created ${worker.url()}`);
  worker.on("close", () => console.log(`[worker] closed ${worker.url()}`));
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

  const canvas = page.locator("#webgl-debug-canvas");
  await canvas.waitFor({ state: "visible", timeout: 90_000 });
  const box = await canvas.boundingBox();
  if (!box || box.width < 100 || box.height < 100) {
    throw new Error(`Invalid game canvas bounds: ${JSON.stringify(box)}`);
  }

  await page.waitForTimeout(10_000);

  const runtime = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll("canvas")].map((canvas) => ({
      id: canvas.id,
      width: canvas.width,
      height: canvas.height,
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      connected: canvas.isConnected,
    }));
    const glCanvas = document.querySelector("#webgl-debug-canvas");
    return {
      inGame: document.body.classList.contains("in-game"),
      path: window.location.pathname,
      canvasCount: canvases.length,
      canvases,
      webglCanvasConnected: glCanvas?.isConnected ?? false,
      startingModalHidden:
        document.querySelector("game-starting-modal")?.classList.contains("hidden") ??
        false,
      connectionErrorVisible:
        document.body.innerText.includes("Connection error!") ||
        document.body.innerText.includes("Worker initialization timeout"),
    };
  });

  if (
    !runtime.inGame ||
    !runtime.webglCanvasConnected ||
    runtime.canvasCount < 1 ||
    runtime.connectionErrorVisible
  ) {
    throw new Error(`Game runtime did not remain active: ${JSON.stringify(runtime)}`);
  }
  if (criticalErrors.length > 0) {
    throw new Error(`Critical browser errors:\n${criticalErrors.join("\n")}`);
  }

  passed = true;
  console.log(
    JSON.stringify(
      {
        status: "passed",
        defaults,
        emitted,
        runtime,
        pageErrorCount: pageErrors.length,
        consoleErrorCount: consoleErrors.length,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const diagnostics = await page
    .evaluate(() => ({
      bodyClass: document.body.className,
      path: window.location.pathname,
      canvasSummary: [...document.querySelectorAll("canvas")].map((canvas) => ({
        id: canvas.id,
        width: canvas.width,
        height: canvas.height,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
      })),
      appChildren: document.querySelector("#app")?.childElementCount ?? 0,
      visibleText: document.body.innerText.slice(0, 2000),
    }))
    .catch(() => null);
  console.error("Smoke diagnostics:", JSON.stringify(diagnostics, null, 2));
  throw error;
} finally {
  await page
    .screenshot({ path: screenshotPath, fullPage: true })
    .catch((error) => console.error("Screenshot failed", error));
  await browser.close();
  if (!passed) console.error("Browser single-player smoke did not pass.");
}
