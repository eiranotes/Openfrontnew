import "./apply-compact-state-combat.mjs";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function write(relativePath, content) {
  fs.writeFileSync(path.join(root, relativePath), content);
}

const desktopWordmark = `<span class="command-wordmark" aria-label="OpenFront">
              <span>OPEN</span><span class="command-wordmark__accent">FRONT</span>
            </span>`;
const mobileTopbarWordmark = `<span class="command-wordmark command-wordmark--mobile" aria-label="OpenFront">
                <span>OPEN</span><span class="command-wordmark__accent">FRONT</span>
              </span>`;
const logoPattern = /<img\s+[^>]*src=\$\{assetUrl\("images\/OpenFrontLogo\.svg"\)\}[^>]*alt="OpenFront"[^>]*\/>/m;

for (const file of [
  "src/client/components/DesktopNavBar.ts",
  "src/client/components/MobileNavBar.ts",
  "src/client/components/PlayPage.ts",
]) {
  let content = read(file);
  if (!content.includes("command-wordmark")) {
    if (!logoPattern.test(content)) {
      throw new Error(`Command wordmark logo anchor missing: ${file}`);
    }
    content = content.replace(
      logoPattern,
      file.endsWith("PlayPage.ts") ? mobileTopbarWordmark : desktopWordmark,
    );
  }
  if (!content.includes('assetUrl("')) {
    content = content.replace(
      'import { assetUrl } from "../../core/AssetUrls";\n',
      "",
    );
  }
  write(file, content);
}

const cssPath = "src/client/styles/command-ui.css";
let css = read(cssPath);
const wordmarkCss = `
.command-wordmark {
  display: inline-flex;
  align-items: baseline;
  color: #f7fafc;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 17px;
  font-weight: 850;
  letter-spacing: -0.055em;
  line-height: 1;
  white-space: nowrap;
}

.command-wordmark__accent {
  color: var(--command-accent);
}

.command-wordmark--mobile {
  font-size: 18px;
}
`;
if (!css.includes(".command-wordmark {")) {
  const anchor = ".command-desktop-nav {";
  if (!css.includes(anchor)) {
    throw new Error("Command wordmark CSS anchor missing");
  }
  css = css.replace(anchor, wordmarkCss + "\n" + anchor);
  write(cssPath, css);
}

console.log("Applied asset-independent OpenFront wordmark.");
