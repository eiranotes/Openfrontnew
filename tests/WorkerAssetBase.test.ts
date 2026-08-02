import { describe, expect, it } from "vitest";
import { resolveWorkerAssetBase } from "../src/core/worker/WorkerAssetBase";

describe("resolveWorkerAssetBase", () => {
  it("turns a GitHub Pages project base into an absolute URL", () => {
    expect(
      resolveWorkerAssetBase(
        "/Openfrontnew",
        "https://eiranotes.github.io",
      ),
    ).toBe("https://eiranotes.github.io/Openfrontnew");
  });

  it("uses the page origin when no CDN base is configured", () => {
    expect(resolveWorkerAssetBase("", "https://openfront.test")).toBe(
      "https://openfront.test",
    );
  });

  it("preserves an absolute CDN and removes trailing slashes", () => {
    expect(
      resolveWorkerAssetBase(
        "https://cdn.example.test/openfront///",
        "https://openfront.test",
      ),
    ).toBe("https://cdn.example.test/openfront");
  });

  it("resolves relative project paths from the page origin", () => {
    expect(resolveWorkerAssetBase("preview", "http://127.0.0.1:4173")).toBe(
      "http://127.0.0.1:4173/preview",
    );
  });
});
