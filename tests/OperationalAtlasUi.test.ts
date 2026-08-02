import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Operational Atlas UI system", () => {
  it("loads the semantic UI layer after the legacy command stylesheet", () => {
    const main = read("src/client/Main.ts");
    expect(main).toContain('import "./styles/command-ui.css";');
    expect(main).toContain('import "./styles/operational-atlas.css";');
    expect(main.indexOf('import "./styles/operational-atlas.css";')).toBeGreaterThan(
      main.indexOf('import "./styles/command-ui.css";'),
    );
  });

  it("does not request UI assets that are absent from the Pages bundle", () => {
    const main = read("src/client/Main.ts");
    const steamButton = read("src/client/components/SteamWishlistButton.ts");
    expect(main).not.toContain('fonts/OpenFront.ttf');
    expect(steamButton).not.toContain('images/OpenFrontLogo.svg');
  });

  it("uses a compact local Steam promotion instead of the fixed-height iframe", () => {
    const playPage = read("src/client/components/PlayPage.ts");
    expect(playPage).toContain("steam-wishlist-button");
    expect(playPage).not.toContain("<steam-wishlist\n");
  });

  it("replaces the centered build modal with a bottom command dock", () => {
    const buildMenu = read("src/client/hud/layers/BuildMenu.ts");
    expect(buildMenu).toContain("bottom: max(14px, env(safe-area-inset-bottom))");
    expect(buildMenu).toContain('role="dialog"');
    expect(buildMenu).toContain('aria-modal="false"');
    expect(buildMenu).toContain(".build-grid");
    expect(buildMenu).not.toContain("top: 50%");
    expect(buildMenu).not.toMatch(/transition\s*:\s*all/i);
    expect(buildMenu).not.toContain("scale(1.05)");
  });

  it("keeps core surfaces solid and defines tablet and reduced-motion rules", () => {
    const atlas = read("src/client/styles/operational-atlas.css");
    expect(atlas).toContain("Operational Atlas");
    expect(atlas).toContain("@media (min-width: 900px) and (max-width: 1179px)");
    expect(atlas).toContain("@media (prefers-reduced-motion: reduce)");
    expect(atlas).not.toMatch(/linear-gradient\s*\(/i);
    expect(atlas).not.toMatch(/backdrop-filter:\s*blur/i);
  });
});
