function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Blob workers cannot resolve root-relative fetch URLs because their own
 * location uses the blob: scheme. Resolve the asset base on the main thread,
 * where the page origin is known, before sending it to the worker.
 */
export function resolveWorkerAssetBase(
  cdnBase: string,
  pageOrigin: string,
): string {
  const origin = new URL(pageOrigin).origin;
  if (!/^https?:\/\//i.test(origin)) {
    throw new Error(`Unsupported page origin for Worker assets: ${pageOrigin}`);
  }

  const resolved = new URL(cdnBase.trim() || "/", `${origin}/`);
  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
    throw new Error(`Unsupported Worker asset protocol: ${resolved.protocol}`);
  }

  return trimTrailingSlashes(resolved.href);
}
