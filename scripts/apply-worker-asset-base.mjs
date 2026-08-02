import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const target = path.join(root, "src/core/worker/WorkerClient.ts");
let source = await readFile(target, "utf8");
let changed = false;

const importLine =
  'import { resolveWorkerAssetBase } from "./WorkerAssetBase";';
if (!source.includes(importLine)) {
  const anchor = 'import { WorkerMessage } from "./WorkerMessages";';
  if (!source.includes(anchor)) {
    throw new Error("WorkerClient import anchor not found");
  }
  source = source.replace(anchor, `${importLine}\n${anchor}`);
  changed = true;
}

const oldValue = "cdnBase: getCdnBase(),";
const newValue =
  "cdnBase: resolveWorkerAssetBase(getCdnBase(), window.location.origin),";
if (!source.includes(newValue)) {
  if (!source.includes(oldValue)) {
    throw new Error("WorkerClient CDN-base anchor not found");
  }
  source = source.replace(oldValue, newValue);
  changed = true;
}

if (!source.includes(importLine)) {
  throw new Error("Worker asset-base resolver import is missing");
}
if ((source.match(/resolveWorkerAssetBase\(/g) ?? []).length !== 1) {
  throw new Error("Worker asset-base resolver must be called exactly once");
}
if (source.includes(oldValue)) {
  throw new Error("Root-relative Worker CDN base is still present");
}

if (changed) {
  await writeFile(target, source);
  console.log("Worker asset base now resolves against the page origin.");
} else {
  console.log("Worker asset-base patch already applied.");
}
