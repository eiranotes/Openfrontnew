import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const root = path.resolve(process.argv[2] ?? ".");
const scriptsDir = path.join(root, "scripts");
const parts = fs
  .readdirSync(scriptsDir)
  .filter((name) => /^fortress-interface-v3\.part-\d+$/.test(name))
  .sort();

if (parts.length === 0) {
  throw new Error("Fortress Interface V3 payload parts are missing");
}

const encoded = parts
  .map((name) => fs.readFileSync(path.join(scriptsDir, name), "utf8"))
  .join("")
  .replace(/\s+/g, "");
const payload = JSON.parse(
  gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"),
);

if (payload.version !== 3 || typeof payload.files !== "object") {
  throw new Error("Unsupported Fortress Interface payload");
}

const changed = [];
for (const [relativePath, content] of Object.entries(payload.files)) {
  if (typeof content !== "string") {
    throw new Error(`Invalid payload content for ${relativePath}`);
  }
  const destination = path.resolve(root, relativePath);
  if (!destination.startsWith(root + path.sep)) {
    throw new Error(`Unsafe payload path: ${relativePath}`);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const current = fs.existsSync(destination)
    ? fs.readFileSync(destination, "utf8")
    : null;
  if (current === content) continue;
  fs.writeFileSync(destination, content);
  changed.push(relativePath);
}

console.log(
  changed.length === 0
    ? "Fortress Interface V3 already materialized."
    : `Applied Fortress Interface V3 to ${changed.length} files.`,
);
