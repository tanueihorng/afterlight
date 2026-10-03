// Capture comparable browser views of both eye viewers, plus per-frame GPU stats.
//
// Phase 11 established this for the baseline; later phases rerun it with `--tag <name>` so
// captures land in docs/eye-realism/captures/<tag>/ and stay comparable. It never edits
// application code: GPU triangle/draw-call counts are read by wrapping WebGL2 draw calls.
//
// Usage: node scripts/capture-eye-views.mjs [--tag baseline] [--url http://localhost:4173]
// The server must already be running (npx vite preview --port 4173).

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(app, "..");

const args = process.argv.slice(2);
const tagArg = args.indexOf("--tag");
const tag = tagArg >= 0 ? args[tagArg + 1] : "baseline";
const urlArg = args.indexOf("--url");
const baseURL = urlArg >= 0 ? args[urlArg + 1] : "http://localhost:4173";

const outDir = resolve(root, "docs/eye-realism/captures", tag);
mkdirSync(outDir, { recursive: true });

const stats = { calls: 0, triangles: 0 };

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
});

await page.addInitScript(() => {
  window.__glStats = { calls: 0, triangles: 0 };
  const wrap = (proto, name, indexCount) => {
    const original = proto[name];
    proto[name] = function (...rest) {
      window.__glStats.calls += 1;
      window.__glStats.triangles += indexCount(rest) / 3;
      return original.apply(this, rest);
    };
  };
  // count/3 for TRIANGLES draw calls; arraysCount for drawArrays (also triangles here).
  wrap(WebGL2RenderingContext.prototype, "drawElements", (args) => args[1]);
  wrap(WebGL2RenderingContext.prototype, "drawArrays", (args) => args[1]);
});

const sampleFrame = async (label) => {
  const frame = await page.evaluate(
    () =>
      new Promise((done) => {
        window.__glStats.calls = 0;
        window.__glStats.triangles = 0;
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            done({ calls: window.__glStats.calls, triangles: Math.round(window.__glStats.triangles) }),
          ),
        );
      }),
  );
  return { label, ...frame };
};

await page.goto(baseURL + "/");
await page.getByRole("button", { name: /skip setup/i }).click();
await page.goto(baseURL + "/#/visualize");

const canvas = page.locator("canvas").first();
await canvas.waitFor({ state: "visible", timeout: 20_000 });
await page.waitForTimeout(2500);

// --- The eye tab (main renderer): one capture per view mode, default controls otherwise. ---
const appViews = [
  ["Whole eye", "exterior"],
  ["Cross-section", "cross_section"],
  ["Cornea", "cornea"],
  ["Retina", "fundus"],
];
const appStats = [];
for (const [name, id] of appViews) {
  await page.getByRole("button", { name, exact: true }).first().click();
  await page.waitForTimeout(1800);
  await canvas.screenshot({ path: resolve(outDir, `app-eye-${id}.png`) });
  appStats.push(await sampleFrame(`app ${id}`));
}

// Slice sweep responsiveness on the cross-section view: keyboard-driven, timed.
await page.getByRole("button", { name: "Cross-section", exact: true }).first().click();
await page.waitForTimeout(800);
const slice = page.getByRole("slider", { name: "Slice position" });
await slice.focus();
const sweepStart = Date.now();
for (let i = 0; i < 10; i++) {
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(60);
}
const sweepMs = Date.now() - sweepStart;
await canvas.screenshot({ path: resolve(outDir, "app-eye-cross-section-slice-end.png") });

// --- The 3D explorer tab: iframe around the legacy page. ---
const explorer = page.getByRole("button", { name: "3D explorer" });
await explorer.click();
const frame = page.frameLocator('iframe[title*="xplorer" i], iframe').first();
const vpCanvas = frame.locator("#viewport canvas");
await vpCanvas.waitFor({ state: "visible", timeout: 25_000 });
await page.waitForTimeout(2500);
await vpCanvas.screenshot({ path: resolve(outDir, "explorer-default.png") });
const explorerStats = [await sampleFrame("explorer default")];

// Half and full cut, driving the same slider a user would.
for (const [value, name] of [[40, "explorer-cut-40.png"], [100, "explorer-cut-100.png"]]) {
  await frame.locator("#cutSlider").evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  await page.waitForTimeout(1500);
  await vpCanvas.screenshot({ path: resolve(outDir, name) });
  explorerStats.push(await sampleFrame(`explorer cut ${value}`));
}

const report = {
  capturedAt: new Date().toISOString(),
  baseURL,
  viewport: "1280x800 @1x",
  gl: "SwiftShader (software) — timings are relative baselines on this machine, not device evidence",
  appStats,
  explorerStats,
  appSliceSweepMs: sweepMs,
  notes:
    "appSliceSweepMs covers 10 ArrowRight steps with 60ms waits on the Slice position slider; Explorer cut uses #cutSlider input events.",
};

writeFileSync(resolve(outDir, "capture-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
