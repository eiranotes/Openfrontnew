import { chromium } from "playwright";

const siteUrl =
  process.env.SMOKE_SITE_URL ?? "http://127.0.0.1:4173/Openfrontnew/";
const screenshotPath =
  process.env.SMOKE_SCREENSHOT ?? "browser-single-player-smoke.png";
const artifactPrefix =
  process.env.SMOKE_ARTIFACT_PREFIX ?? screenshotPath.replace(/\.png$/i, "");
const viewportWidth = Number(process.env.SMOKE_VIEWPORT_WIDTH ?? 1440);
const viewportHeight = Number(process.env.SMOKE_VIEWPORT_HEIGHT ?? 900);
const mobileViewport = viewportWidth <= 430;

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
  viewport: { width: viewportWidth, height: viewportHeight },
  locale: "en-US",
  isMobile: mobileViewport,
  hasTouch: mobileViewport,
  deviceScaleFactor: mobileViewport ? 2 : 1,
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
const sameOriginHttpErrors = [];
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
    const failure = `${response.status()} ${response.url()}`;
    sameOriginHttpErrors.push(failure);
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

  await page.screenshot({
    path: `${artifactPrefix}-home.png`,
    fullPage: true,
  });

  const homeAudit = await page.evaluate(() => {
    const playPage = document.querySelector("play-page");
    const primaryAction = document.querySelector(
      '.command-action-button[data-primary="true"]',
    );
    const news = document.querySelector(".command-news-box");
    const homeShell = document.querySelector(".command-home-shell");
    const utility = document.querySelector(".command-home-utility");
    const stage = document.querySelector(".command-home-stage");
    const navigation = document.querySelector("desktop-nav-bar");
    const primaryStyle = primaryAction ? getComputedStyle(primaryAction) : null;
    const newsRect = news?.getBoundingClientRect();
    const utilityRect = utility?.getBoundingClientRect();
    const stageRect = stage?.getBoundingClientRect();
    return {
      steamIframeCount: playPage?.querySelectorAll("iframe").length ?? 0,
      steamPromoCount:
        playPage?.querySelectorAll("steam-wishlist-button").length ?? 0,
      primaryBackgroundImage: primaryStyle?.backgroundImage ?? null,
      primaryRadius: primaryStyle?.borderRadius ?? null,
      newsHeight: newsRect?.height ?? 0,
      homeShellCount: playPage?.querySelectorAll(".command-home-shell").length ?? 0,
      primaryNavItemCount:
        navigation?.querySelectorAll(
          ".command-desktop-nav__menu .nav-menu-item",
        ).length ?? 0,
      utilityMenuCount:
        navigation?.querySelectorAll(".command-desktop-nav__more").length ?? 0,
      desktopTwoColumn:
        Boolean(utilityRect && stageRect) && stageRect.left > utilityRect.right,
      mobileStacked:
        Boolean(utilityRect && stageRect) && stageRect.top >= utilityRect.bottom,
      viewportWidth: innerWidth,
    };
  });

  if (homeAudit.steamIframeCount !== 0 || homeAudit.steamPromoCount !== 1) {
    throw new Error(`Home Steam promotion is not compact: ${JSON.stringify(homeAudit)}`);
  }
  if (homeAudit.primaryBackgroundImage && homeAudit.primaryBackgroundImage !== "none") {
    throw new Error(`Primary home action uses an ornamental image/gradient: ${JSON.stringify(homeAudit)}`);
  }
  if (homeAudit.viewportWidth <= 430 && homeAudit.newsHeight > 96) {
    throw new Error(`Mobile news surface is too tall: ${JSON.stringify(homeAudit)}`);
  }

  if (homeAudit.homeShellCount !== 1) {
    throw new Error(`Home operations desk missing: ${JSON.stringify(homeAudit)}`);
  }
  if (
    homeAudit.viewportWidth >= 1024 &&
    (homeAudit.primaryNavItemCount !== 4 ||
      homeAudit.utilityMenuCount !== 1 ||
      !homeAudit.desktopTwoColumn)
  ) {
    throw new Error(`Desktop home hierarchy regressed: ${JSON.stringify(homeAudit)}`);
  }
  if (homeAudit.viewportWidth <= 430 && !homeAudit.mobileStacked) {
    throw new Error(`Mobile home hierarchy regressed: ${JSON.stringify(homeAudit)}`);
  }

  const uiLayout = await page.evaluate(async () => {
    const modal = document.querySelector("single-player-modal");
    modal.open();
    await modal.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const startButton = modal.querySelector("o-button button");
    const footer = modal.querySelector(".command-settings-footer");
    const modalShell = modal.querySelector("o-modal")?.shadowRoot?.querySelector("aside > div");
    const interactive = [...modal.querySelectorAll("button, input, select")]
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);

    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      startButtonHeight: startButton?.getBoundingClientRect().height ?? 0,
      footerVisible: footer ? footer.getBoundingClientRect().bottom <= innerHeight + 1 : false,
      modalWidth: modalShell?.getBoundingClientRect().width ?? 0,
      minInteractiveHeight: interactive.length
        ? Math.min(...interactive.map((rect) => rect.height))
        : 0,
    };
  });

  await page.screenshot({
    path: `${artifactPrefix}-single-player.png`,
    fullPage: true,
  });

  if (
    uiLayout.documentScrollWidth > uiLayout.viewport.width + 1 ||
    uiLayout.bodyScrollWidth > uiLayout.viewport.width + 1
  ) {
    throw new Error(`Responsive UI overflow: ${JSON.stringify(uiLayout)}`);
  }
  if (uiLayout.viewport.width <= 430 && uiLayout.startButtonHeight < 44) {
    throw new Error(`Mobile start button is too small: ${JSON.stringify(uiLayout)}`);
  }
  if (uiLayout.viewport.width <= 430 && uiLayout.minInteractiveHeight < 44) {
    throw new Error(`Mobile interactive target is too small: ${JSON.stringify(uiLayout)}`);
  }
  if (!uiLayout.footerVisible) {
    throw new Error(`Single-player footer is not visible: ${JSON.stringify(uiLayout)}`);
  }

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
      randomSpawn: modal.randomSpawn,
      disabledUnits: [...modal.disabledUnits],
    };
  });

  const expectedDefaults = {
    map: "World",
    difficulty: "Easy",
    bots: 400,
    compact: false,
    randomSpawn: false,
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
              randomSpawn: config.randomSpawn,
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
    modal.randomSpawn = true;
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
    randomSpawn: true,
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

  // Use the game's random-spawn path for deterministic CI. A single click at
  // the canvas centre is not guaranteed to hit land at every viewport and map
  // scale, which made the tablet build-menu audit intermittently run before a
  // player spawn existed.
  await page.waitForFunction(
    () => {
      const game = document.querySelector("build-menu")?.game;
      const player = game?.myPlayer?.();
      return player?.state?.spawnTile !== undefined;
    },
    undefined,
    { timeout: 120_000 },
  );

  await page.mouse.click(
    canvasBox.x + canvasBox.width / 2,
    canvasBox.y + canvasBox.height / 2,
  );
  await page.waitForTimeout(2_000);

  const runtime = await page.evaluate(() => {
    const game = document.querySelector("build-menu")?.game;
    return {
      inGame: document.body.classList.contains("in-game"),
      path: window.location.pathname,
      canvasCount: document.querySelectorAll("canvas").length,
      visibleCanvasCount: [...document.querySelectorAll("canvas")].filter(
        (canvas) => {
          const rect = canvas.getBoundingClientRect();
          return rect.width >= 100 && rect.height >= 100;
        },
      ).length,
      spawnReady: game?.myPlayer?.()?.state?.spawnTile !== undefined,
    };
  });

  if (
    !runtime.inGame ||
    !runtime.spawnReady ||
    runtime.visibleCanvasCount < 1 ||
    !/^\/w\d+\/game\/[A-Za-z0-9_-]+$/.test(runtime.path)
  ) {
    throw new Error(
      `Game runtime did not remain active: ${JSON.stringify(runtime)}`,
    );
  }

  const buildMenuAudit = await page.evaluate(async () => {
    const menu = document.querySelector("build-menu");
    const game = menu?.game;
    const myPlayer = game?.myPlayer();
    const tile = myPlayer?.state?.spawnTile;
    if (!menu || !game || !myPlayer || tile === undefined) {
      return { available: false };
    }

    menu.showMenu(tile);
    await menu.updateComplete;
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      await menu.updateComplete;
      if (menu.shadowRoot?.querySelectorAll(".build-command").length) break;
    }

    const shell = menu.shadowRoot?.querySelector(".build-menu");
    const buttons = [...(menu.shadowRoot?.querySelectorAll(".build-command") ?? [])].filter(
      (button) => button.getBoundingClientRect().width > 0,
    );
    const closeButton = menu.shadowRoot?.querySelector(".build-close");
    const rect = shell?.getBoundingClientRect();
    const shellStyle = shell ? getComputedStyle(shell) : null;
    const styleText = [...(menu.shadowRoot?.querySelectorAll("style") ?? [])]
      .map((style) => style.textContent ?? "")
      .join("\n");
    return {
      available: Boolean(shell && rect && buttons.length),
      top: rect?.top ?? 0,
      bottom: rect?.bottom ?? 0,
      width: rect?.width ?? 0,
      height: rect?.height ?? 0,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      buttonCount: buttons.length,
      minButtonHeight: buttons.length
        ? Math.min(...buttons.map((button) => button.getBoundingClientRect().height))
        : 0,
      closeButtonHeight: closeButton?.getBoundingClientRect().height ?? 0,
      position: shellStyle?.position ?? null,
      backgroundImage: shellStyle?.backgroundImage ?? null,
      backdropFilter: shellStyle?.backdropFilter ?? null,
      containsTransitionAll: /transition\s*:\s*all/i.test(styleText),
    };
  });

  if (!buildMenuAudit.available || buildMenuAudit.buttonCount < 1) {
    throw new Error(`Build command dock unavailable: ${JSON.stringify(buildMenuAudit)}`);
  }
  if (buildMenuAudit.bottom > buildMenuAudit.viewportHeight + 1) {
    throw new Error(`Build command dock exceeds the viewport: ${JSON.stringify(buildMenuAudit)}`);
  }
  if (buildMenuAudit.height > buildMenuAudit.viewportHeight * 0.56) {
    throw new Error(`Build command dock hides too much of the map: ${JSON.stringify(buildMenuAudit)}`);
  }
  if (buildMenuAudit.position !== "fixed" || buildMenuAudit.containsTransitionAll) {
    throw new Error(`Build command dock regressed to legacy modal styling: ${JSON.stringify(buildMenuAudit)}`);
  }
  if (buildMenuAudit.backgroundImage && buildMenuAudit.backgroundImage !== "none") {
    throw new Error(`Build command dock uses an ornamental gradient: ${JSON.stringify(buildMenuAudit)}`);
  }
  if (mobileViewport && (buildMenuAudit.minButtonHeight < 44 || buildMenuAudit.closeButtonHeight < 44)) {
    throw new Error(`Mobile build command target is too small: ${JSON.stringify(buildMenuAudit)}`);
  }

  await page.screenshot({
    path: `${artifactPrefix}-build-menu.png`,
    fullPage: true,
  });
  await page.evaluate(() => document.querySelector("build-menu")?.hideMenu());

  const allianceSheet = await page.evaluate(async () => {
    const panel = document.querySelector("player-panel");
    const game = panel?.g;
    const myPlayer = game?.myPlayer();
    if (!panel || !game || !myPlayer) return { available: false };

    const target = game
      .players()
      .find(
        (player) =>
          player !== myPlayer &&
          player.isAlive() &&
          player.state.spawnTile !== undefined,
      );
    if (!target) return { available: false };

    const tile = target.state.spawnTile;
    const actions = await myPlayer.actions(tile);
    panel.show(actions, tile);
    await panel.updateComplete;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );

    const layer = panel.querySelector(".command-player-layer");
    const sheet = panel.querySelector(".command-player-sheet");
    const buttons = [...panel.querySelectorAll(".command-player-actions button")].filter(
      (button) => button.getBoundingClientRect().width > 0,
    );
    const rect = sheet?.getBoundingClientRect();
    return {
      available: true,
      bottom: rect?.bottom ?? 0,
      height: rect?.height ?? 0,
      viewportHeight: innerHeight,
      minActionHeight: buttons.length
        ? Math.min(...buttons.map((button) => button.getBoundingClientRect().height))
        : 0,
      actionCount: buttons.length,
      labels: buttons.map((button) => button.textContent?.trim()).filter(Boolean),
      layerPointerEvents: layer ? getComputedStyle(layer).pointerEvents : null,
      sheetPointerEvents: sheet ? getComputedStyle(sheet).pointerEvents : null,
      detailsCollapsed:
        panel.querySelector(".command-player-details") === null,
    };
  });

  if (!allianceSheet.available || allianceSheet.actionCount < 1) {
    throw new Error(`Alliance command sheet unavailable: ${JSON.stringify(allianceSheet)}`);
  }
  if (mobileViewport) {
    if (allianceSheet.bottom > allianceSheet.viewportHeight + 1) {
      throw new Error(`Mobile alliance sheet exceeds viewport: ${JSON.stringify(allianceSheet)}`);
    }
    if (allianceSheet.height > allianceSheet.viewportHeight * 0.55) {
      throw new Error(`Mobile alliance sheet is too tall: ${JSON.stringify(allianceSheet)}`);
    }
    if (
      allianceSheet.layerPointerEvents !== "none" ||
      allianceSheet.sheetPointerEvents !== "auto" ||
      !allianceSheet.detailsCollapsed
    ) {
      throw new Error(`Mobile country dock blocks the map or expands details: ${JSON.stringify(allianceSheet)}`);
    }
    if (allianceSheet.minActionHeight < 44) {
      throw new Error(`Mobile alliance action is too small: ${JSON.stringify(allianceSheet)}`);
    }
  }

  await page.screenshot({
    path: `${artifactPrefix}-alliance-sheet.png`,
    fullPage: true,
  });
  await page.evaluate(() => document.querySelector("player-panel")?.hide());
  const missingCoreAssets = [...sameOriginFailures, ...sameOriginHttpErrors].filter(
    (entry) => /OpenFront\.ttf|OpenFrontLogo\.svg/i.test(entry),
  );
  if (missingCoreAssets.length > 0) {
    throw new Error(`Core UI asset requests failed:\n${missingCoreAssets.join("\n")}`);
  }
  if (sameOriginHttpErrors.length > 0) {
    throw new Error(
      `Same-origin HTTP errors:\n${sameOriginHttpErrors.join("\n")}`,
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
        homeAudit,
        uiLayout,
        buildMenuAudit,
        allianceSheet,
        sameOriginFailures,
        sameOriginHttpErrors,
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
        { pageErrors, workerErrors, sameOriginFailures, sameOriginHttpErrors },
        null,
        2,
      ),
    );
  }
}
