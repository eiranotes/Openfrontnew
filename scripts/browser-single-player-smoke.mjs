import { chromium } from "playwright";

const siteUrl =
  process.env.SMOKE_SITE_URL ?? "http://127.0.0.1:4173/Openfrontnew/";
const screenshotPath =
  process.env.SMOKE_SCREENSHOT ?? "browser-single-player-smoke.png";

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
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

  // GitHub-hosted runners do not provide a physical GPU. Chromium still
  // executes real WebGL2 through SwiftShader, but OpenFront intentionally
  // rejects renderer strings containing software/SwiftShader. Keep the actual
  // WebGL implementation and spoof only the CI renderer identity so the rest
  // of the renderer and gameplay startup path can be exercised.
  const installHardwareRendererIdentity = (prototype) => {
    if (!prototype?.getParameter) return;
    const originalGetParameter = prototype.getParameter;
    prototype.getParameter = function (parameter) {
      switch (parameter) {
        case 0x1f00: // VENDOR
        case 0x9245: // UNMASKED_VENDOR_WEBGL
          return "NVIDIA Corporation";
        case 0x1f01: // RENDERER
        case 0x9246: // UNMASKED_RENDERER_WEBGL
          return "ANGLE (NVIDIA, NVIDIA GeForce RTX 4090, OpenGL 4.6)";
        default:
          return originalGetParameter.call(this, parameter);
      }
    };

    if (prototype.getExtension) {
      const originalGetExtension = prototype.getExtension;
      prototype.getExtension = function (name) {
        const extension = originalGetExtension.call(this, name);
        if (name === "WEBGL_debug_renderer_info") {
          return (
            extension ?? {
              UNMASKED_VENDOR_WEBGL: 0x9245,
              UNMASKED_RENDERER_WEBGL: 0x9246,
            }
          );
        }
        return extension;
      };
    }
  };
  installHardwareRendererIdentity(window.WebGLRenderingContext?.prototype);
  installHardwareRendererIdentity(window.WebGL2RenderingContext?.prototype);

  let turnstileCallback;
  const completeTurnstile = (callback) => {
    const selected = callback ?? turnstileCallback;
    queueMicrotask(() => selected?.("browser-smoke-token"));
  };
  window.turnstile = {
    render(_target, options) {
      turnstileCallback = options?.callback;
      completeTurnstile(options?.callback);
      return "browser-smoke-widget";
    },
    execute(_target, options) {
      completeTurnstile(options?.callback);
      return "browser-smoke-token";
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

  const NativeWorker = window.Worker;
  window.Worker = new Proxy(NativeWorker, {
    construct(Target, args) {
      const worker = Reflect.construct(Target, args);
      worker.addEventListener("error", (event) => {
        console.error(
          `__SMOKE_WORKER_ERROR__ ${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`,
        );
      });
      worker.addEventListener("messageerror", (event) => {
        console.error(`__SMOKE_WORKER_MESSAGE_ERROR__ ${String(event.data)}`);
      });
      return worker;
    },
  });
});

const page = await context.newPage();
const pageErrors = [];
const workerErrors = [];
const sameOriginFailures = [];
const allowedOrigin = new URL(siteUrl).origin;

page.on("pageerror", (error) => {
  const text = error.stack ?? error.message;
  pageErrors.push(text);
  console.error(`[pageerror] ${text}`);
});
page.on("console", (message) => {
  const text = message.text();
  if (text.includes("__SMOKE_WORKER_")) workerErrors.push(text);
  console.log(`[browser:${message.type()}] ${text}`);
});
page.on("requestfailed", (request) => {
  const url = request.url();
  if (url.startsWith(allowedOrigin)) {
    const failure = `${url}: ${request.failure()?.errorText ?? "unknown"}`;
    sameOriginFailures.push(failure);
    console.error(`[requestfailed] ${failure}`);
  }
});
page.on("response", (response) => {
  if (response.url().startsWith(allowedOrigin) && response.status() >= 400) {
    console.error(`[response:${response.status()}] ${response.url()}`);
  }
});

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

  const graphics = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return { webgl2Available: false };
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      webgl2Available: true,
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      unmaskedVendor: debug
        ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL)
        : null,
      unmaskedRenderer: debug
        ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : null,
    };
  });
  if (!graphics.webgl2Available) {
    throw new Error("Headless Chromium did not expose a WebGL2 context");
  }
  if (
    [graphics.renderer, graphics.unmaskedRenderer]
      .filter(Boolean)
      .some((value) => /swiftshader|software/i.test(value))
  ) {
    throw new Error(`CI renderer identity spoof failed: ${JSON.stringify(graphics)}`);
  }

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

  const expectedDefaults = {
    map: "World",
    difficulty: "Easy",
    bots: 400,
    compact: false,
  };
  for (const [key, value] of Object.entries(expectedDefaults)) {
    if (defaults[key] !== value) {
      throw new Error(
        `Default mismatch for ${key}: expected ${value}, got ${defaults[key]}`,
      );
    }
  }
  if (defaults.disabledUnits.length !== 0) {
    throw new Error(
      `Original defaults must enable every unit: ${JSON.stringify(defaults.disabledUnits)}`,
    );
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
  const expectedConfig = {
    gameMap: "Europe",
    gameMapSize: "Compact",
    difficulty: "Hard",
    bots: 8,
    gameMode: "Team",
    playerTeams: 4,
    gameType: "Singleplayer",
  };
  for (const [key, value] of Object.entries(expectedConfig)) {
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
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("canvas")].some((canvas) => {
        const rect = canvas.getBoundingClientRect();
        const style = getComputedStyle(canvas);
        return (
          rect.width >= 100 &&
          rect.height >= 100 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      }),
    undefined,
    { timeout: 90_000 },
  );

  const canvasBox = await page.evaluate(() => {
    const canvas = [...document.querySelectorAll("canvas")].find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      const style = getComputedStyle(candidate);
      return (
        rect.width >= 100 &&
        rect.height >= 100 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    });
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });

  if (!canvasBox) {
    throw new Error("No visible game canvas found after entering the game");
  }

  await page.mouse.click(
    canvasBox.x + canvasBox.width / 2,
    canvasBox.y + canvasBox.height / 2,
  );
  await page.waitForTimeout(8_000);

  const runtime = await page.evaluate(() => ({
    inGame: document.body.classList.contains("in-game"),
    path: window.location.pathname,
    canvasCount: document.querySelectorAll("canvas").length,
    visibleCanvasCount: [...document.querySelectorAll("canvas")].filter((canvas) => {
      const rect = canvas.getBoundingClientRect();
      return rect.width >= 100 && rect.height >= 100;
    }).length,
    appChildren: document.querySelector("#app")?.childElementCount ?? 0,
  }));

  if (
    !runtime.inGame ||
    runtime.visibleCanvasCount < 1 ||
    runtime.appChildren < 1
  ) {
    throw new Error(
      `Game runtime did not remain active: ${JSON.stringify(runtime)}`,
    );
  }
  if (workerErrors.length > 0) {
    throw new Error(`Worker errors:\n${workerErrors.join("\n")}`);
  }
  if (pageErrors.length > 0) {
    throw new Error(`Browser page errors:\n${pageErrors.join("\n\n")}`);
  }

  passed = true;
  console.log(
    JSON.stringify(
      {
        status: "passed",
        graphics,
        defaults,
        emitted,
        runtime,
        sameOriginFailures,
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
  if (!passed) {
    console.error(
      JSON.stringify(
        { pageErrors, workerErrors, sameOriginFailures },
        null,
        2,
      ),
    );
  }
}
