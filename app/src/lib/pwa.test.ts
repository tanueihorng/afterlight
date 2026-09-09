import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pub = join(process.cwd(), "public");

describe("offline shell", () => {
  it("ships a manifest that describes an installable app", () => {
    const manifest = JSON.parse(readFileSync(join(pub, "manifest.webmanifest"), "utf8"));
    expect(manifest.name).toBe("Afterlight");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
    for (const icon of manifest.icons) {
      expect(existsSync(join(pub, icon.src.replace("./", "")))).toBe(true);
    }

    // Android needs raster icons at these sizes to offer installation at all; an SVG-only
    // manifest looks fine in review and silently never prompts.
    const raster = manifest.icons.filter((i: { type: string }) => i.type === "image/png");
    expect(raster.map((i: { sizes: string }) => i.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"]),
    );
  });

  it("gives iOS a home-screen icon of its own", () => {
    // iOS ignores the manifest's icons and uses apple-touch-icon. Without it, adding Afterlight
    // to a home screen produces a screenshot of whatever page was open.
    const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
    const href = html.match(/rel="apple-touch-icon"\s+href="\.\/([^"]+)"/)?.[1];
    expect(href).toBeTruthy();
    expect(existsSync(join(pub, href!))).toBe(true);
  });

  it("ships a service worker that caches the shell and nothing about the record", () => {
    const sw = readFileSync(join(pub, "sw.js"), "utf8");
    expect(sw).toMatch(/addEventListener\("install"/);
    expect(sw).toMatch(/addEventListener\("fetch"/);
    // Cross-origin requests are ignored, so nothing can be cached from anywhere else.
    expect(sw).toMatch(/url\.origin !== self\.location\.origin/);
    // Only GETs are handled — a cached write would be a data-integrity bug.
    expect(sw).toMatch(/request\.method !== "GET"/);
  });

  it("never reloads the page on its own", () => {
    const sw = readFileSync(join(pub, "sw.js"), "utf8");
    // skipWaiting only in response to a message from the page, never unprompted.
    expect(sw).not.toMatch(/^\s*self\.skipWaiting\(\);/m);
    expect(sw).toMatch(/if \(event\.data === "skip-waiting"\) self\.skipWaiting\(\)/);
  });
});
