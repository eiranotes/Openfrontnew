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
    throw new Error(`Command wordmark anchor missing: ${label}`);
  }
  return content.replace(before, after);
}

const wordmark = `<span class="command-wordmark" aria-label="OpenFront">
              <span>OPEN</span><span class="command-wordmark__accent">FRONT</span>
            </span>`;

for (const file of [
  "src/client/components/DesktopNavBar.ts",
  "src/client/components/MobileNavBar.ts",
  "src/client/components/PlayPage.ts",
]) {
  let content = read(file);
  content = content.replace(
    'import { assetUrl } from "../../core/AssetUrls";\n',
    "",
  );

  if (file.endsWith("DesktopNavBar.ts")) {
    content = replaceOnce(
      content,
      `<img
              src=${assetUrl("images/OpenFrontLogo.svg")}
              alt="OpenFront"
            />`,
      wordmark,
      "desktop logo",
    );
  } else if (file.endsWith("MobileNavBar.ts")) {
    content = replaceOnce(
      content,
      `<img src=${assetUrl("images/OpenFrontLogo.svg")} alt="OpenFront" />`,
      wordmark,
      "mobile drawer logo",
    );
  } else {
    content = replaceOnce(
      content,
      `<img
                src=${assetUrl("images/OpenFrontLogo.svg")}
                alt="OpenFront"
                class="h-7 w-auto max-w-[150px]"
              />`,
      `<span class="command-wordmark command-wordmark--mobile" aria-label="OpenFront">
                <span>OPEN</span><span class="command-wordmark__accent">FRONT</span>
              </span>`,
      "mobile topbar logo",
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
