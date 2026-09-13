// Phase 16's final evidence: both viewers on desktop and phone, every view the visual contract
// names, plus the measurements the acceptance report cites (GPU draw calls/triangles, frame
// intervals during interaction, idle settling, reduced motion, offline standalone).
//
// Software GL under load can present a stale compositor frame, so every capture waits for the
// canvas to settle (two identical consecutive element shots) and is retried rather than trusted.
//
// Usage: node scripts/capture-eye-final.mjs [--tag final] [--url http://localhost:4173]
// The production server must already be running (npx vite preview --port 4173 --strictPort).

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cpus, totalmem, loadavg } from "node:os";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(app, "..");
const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const tag = flag("--tag", "final");
const baseURL = flag("--url", "http://localhost:4173");
const outDir = resolve(root, "docs/eye-realism/captures", tag);
mkdirSync(outDir, { recursive: true });

const GL = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const report = {
  capturedAt: new Date().toISOString(),
  baseURL,
  host: { cpus: cpus().length, model: cpus()[0]?.model, memGB: Math.round(totalmem() / 2 ** 30), loadAtStart: loadavg() },
  gl: "Chromium + SwiftShader (software). Timings are relative on this machine, not device evidence.",
  shots: [],
  measurements: {},
};

const glStatsInit = () => {
  window.__glStats = { calls: 0, triangles: 0 };
  const wrap = (proto, name) => {
    const original = proto[name];
    proto[name] = function (...rest) {
      window.__glStats.calls += 1;
      window.__glStats.triangles += rest[1] / 3;
      return original.apply(this, rest);
    };
  };
  wrap(WebGL2RenderingContext.prototype, "drawElements");
  wrap(WebGL2RenderingContext.prototype, "drawArrays");
};

const frameStats = (page) =>
  page.evaluate(async () => {
    const s = window.__glStats;
    s.calls = 0;
    s.triangles = 0;
    // demand rendering: force one frame through the scene if the app exposes it
    window.__eyeScene?.renderOnce?.();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const info = window.__eyeScene?.info?.();
    return {
      calls: s.calls,
      triangles: Math.round(s.triangles),
      geometries: info?.memory?.geometries ?? null,
      textures: info?.memory?.textures ?? null,
    };
  });

async function settledShot(page, locator, file, previous) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  let last = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    await page.waitForTimeout(1200);
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    const shot = await locator.screenshot({ timeout: 25_000, animations: "disabled" }).catch(() => null);
    if (!shot || shot.byteLength < 20_000) continue;
    const fresh = !previous || Buffer.compare(shot, previous) !== 0;
    if (last && Buffer.compare(shot, last) === 0 && fresh) {
      writeFileSync(resolve(outDir, file), shot);
      return { shot, attempts: attempt + 1, settled: true };
    }
    last = shot;
  }
  if (last) writeFileSync(resolve(outDir, file), last);
  return { shot: last, attempts: 12, settled: false };
}

async function record(page, locator, file, previous, extra = {}) {
  const result = await settledShot(page, locator, file, previous);
  const stats = await frameStats(page).catch(() => null);
  report.shots.push({ file, settled: result.settled, attempts: result.attempts, bytes: result.shot?.byteLength ?? 0, ...stats, ...extra });
  console.log(file, result.settled ? "settled" : "NOT SETTLED", stats?.triangles ?? "");
  return result.shot;
}

const browser = await chromium.launch({ args: GL });

async function appViewer(prefix, contextOptions) {
  const context = await browser.newContext(contextOptions);
  await context.addInitScript(glStatsInit);
  const page = await context.newPage();
  await page.goto(baseURL + "/");
  await page.getByRole("button", { name: /skip setup/i }).click();
  await page.goto(baseURL + "/#/visualize");
  const canvas = page.locator("canvas").first();
  // the phone context at deviceScaleFactor 3 mounts slowly under software GL: allow a reload
  try {
    await canvas.waitFor({ state: "visible", timeout: 45_000 });
  } catch {
    await page.reload();
    await canvas.waitFor({ state: "visible", timeout: 45_000 });
  }
  const view = (name) => page.getByRole("button", { name, exact: true }).first().click();

  let prev = await record(page, canvas, `${prefix}-default-cutaway.png`, null);
  for (const [name, id] of [["Whole eye", "exterior"], ["Cornea", "cornea"], ["Retina", "retina"]]) {
    await view(name);
    prev = await record(page, canvas, `${prefix}-${id}.png`, prev);
  }

  // exploded layers: the separation control lives on the cross-section (and cornea) views,
  // so the exploded shot is the cutaway with full illustrative spacing
  await view("Cross-section");
  const separation = page.getByRole("slider", { name: "Separate parts (illustrative spacing)" });
  await separation.evaluate((el) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(el, el.max || "1");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  prev = await record(page, canvas, `${prefix}-exploded.png`, prev);
  await separation.evaluate((el) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(el, "0");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // slice positions on the cross-section
  await page.getByRole("button", { name: "Reset view" }).click();
  const slice = page.getByRole("slider", { name: "Slice position" });
  for (const pos of [0, 0.25, 0.5, 0.75, 1]) {
    await slice.evaluate((el, v) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      const min = Number(el.min || 0);
      const max = Number(el.max || 1);
      set.call(el, String(min + (max - min) * v));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, pos);
    prev = await record(page, canvas, `${prefix}-slice-${Math.round(pos * 100)}.png`, prev, { slice: pos });
  }

  // left eye cross-section
  await page.getByRole("button", { name: "Left (OS)", exact: true }).click();
  prev = await record(page, canvas, `${prefix}-left-eye-cutaway.png`, prev);
  await page.getByRole("button", { name: "Right (OD)", exact: true }).click();

  // reset returns to the documented initial presentation
  await view("Cornea");
  await page.getByRole("button", { name: "Reset view" }).click();
  prev = await record(page, canvas, `${prefix}-after-reset.png`, prev);

  // full page at normal viewing size, so the boundary and controls are in the evidence
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(outDir, `${prefix}-page.png`), fullPage: false });
  const boundaryVisible = await page.getByText(/not your anatomy/i).first().isVisible();
  const canvasName = await canvas.getAttribute("aria-label");
  return { context, page, canvas, boundaryVisible, canvasName };
}

// ---------------------------------------------------------------- desktop app viewer
const desktop = await appViewer("app-desktop", { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
report.measurements.appDesktopBoundary = { visible: desktop.boundaryVisible, canvasName: desktop.canvasName };
{
  const { page, canvas } = desktop;
  // idle: no GPU work once the eye is still
  await page.waitForTimeout(2000);
  const idle = await page.evaluate(async () => {
    window.__glStats.calls = 0;
    await new Promise((r) => setTimeout(r, 2000));
    return window.__glStats.calls;
  });
  // interaction: rAF intervals while the eye turns under keyboard input
  await canvas.focus();
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    const loop = (now) => {
      window.__frames.push(now - last);
      last = now;
      if (window.__frames.length < 100000 && !window.__stopFrames) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  const callsBefore = await page.evaluate(() => (window.__glStats.calls = 0));
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press(i % 10 < 5 ? "ArrowRight" : "ArrowLeft");
    await page.waitForTimeout(100);
  }
  const interaction = await page.evaluate(() => {
    window.__stopFrames = true;
    const f = window.__frames.slice(2).sort((a, b) => a - b);
    const pick = (q) => f[Math.min(f.length - 1, Math.floor(q * f.length))];
    return { frames: f.length, p50: pick(0.5), p95: pick(0.95), max: f[f.length - 1], gpuCalls: window.__glStats.calls };
  });
  // slice sweep, keyboard
  await page.getByRole("button", { name: "Cross-section", exact: true }).first().click();
  const slice = page.getByRole("slider", { name: "Slice position" });
  await slice.focus();
  await page.keyboard.press("Home");
  const t0 = Date.now();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(60);
  }
  const sweepMs = Date.now() - t0;
  const memAfterSweep = await frameStats(page);
  await page.keyboard.press("Home");
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(800);
  const memAfterSecondSweep = await frameStats(page);
  const tier = await page.evaluate(() => window.__eyeScene?.tier ?? null);
  report.measurements.appDesktop = { idleGpuCallsOver2s: idle, interaction, callsBefore, sliceSweep10StepsMs: sweepMs, memAfterSweep, memAfterSecondSweep, tier };
  await desktop.context.close();
}

// reduced motion: a keyboard turn completes in a single rendered step, no easing loop
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  await context.addInitScript(glStatsInit);
  const page = await context.newPage();
  await page.goto(baseURL + "/");
  await page.getByRole("button", { name: /skip setup/i }).click();
  await page.goto(baseURL + "/#/visualize");
  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(3000);
  await canvas.focus();
  const reduced = await page.evaluate(async () => {
    const s = window.__glStats;
    s.calls = 0;
    let frames = 0;
    let counting = true;
    const count = () => {
      if (!counting) return;
      const before = s.calls;
      requestAnimationFrame(() => {
        if (s.calls > before) frames += 1;
        count();
      });
    };
    count();
    document.querySelector("canvas").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await new Promise((r) => setTimeout(r, 1500));
    counting = false;
    return { framesWithDrawCalls: frames, drawCalls: s.calls };
  });
  report.measurements.reducedMotion = reduced;
  await context.close();
}

// ---------------------------------------------------------------- phone app viewer
const phone = await appViewer("app-phone", {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
report.measurements.appPhoneBoundary = { visible: phone.boundaryVisible, canvasName: phone.canvasName };
report.measurements.appPhoneTier = await phone.page.evaluate(() => window.__eyeScene?.tier ?? null);
await phone.context.close();

// ---------------------------------------------------------------- legacy explorer
async function explorer(prefix, contextOptions, url) {
  const context = await browser.newContext(contextOptions);
  await context.addInitScript(glStatsInit);
  const page = await context.newPage();
  const remote = [];
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith("http://localhost:")) remote.push(r.url());
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  const canvas = page.locator("#viewport canvas");
  await canvas.waitFor({ state: "visible", timeout: 40_000 });
  await page.locator("#bootmsg").waitFor({ state: "hidden", timeout: 40_000 }).catch(() => {});
  let prev = await record(page, canvas, `${prefix}-default.png`, null);
  for (const [value, name] of [[40, "cut-40"], [100, "cut-100"]]) {
    await page.locator("#cutSlider").evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
    prev = await record(page, canvas, `${prefix}-${name}.png`, prev, { cut: value });
  }
  await page.locator("#btnReset").click();
  prev = await record(page, canvas, `${prefix}-after-reset.png`, prev);
  await page.screenshot({ path: resolve(outDir, `${prefix}-page.png`) });
  const boundary = await page.getByText(/not your anatomy/i).first().isVisible().catch(() => false);
  const rotateOn = await page.locator("#btnRotate").evaluate((el) => el.classList.contains("on"));
  await context.close();
  return { remote, errors, boundary, autoRotateOnByDefault: rotateOn };
}

report.measurements.explorerDesktop = await explorer(
  "explorer-desktop",
  { viewport: { width: 1280, height: 800 } },
  baseURL + "/EyeExplorer.html",
);
report.measurements.explorerPhone = await explorer(
  "explorer-phone",
  { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  baseURL + "/EyeExplorer.html",
);

// ---------------------------------------------------------------- standalone files, no network
async function standaloneOffline(file) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, offline: true });
  const page = await context.newPage();
  const requests = [];
  page.on("request", (r) => {
    if (!/^(file|data|blob):/.test(r.url())) requests.push(r.url());
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(pathToFileURL(resolve(root, file)).href);
  const canvas = page.locator("canvas").first();
  let rendered = false;
  try {
    await canvas.waitFor({ state: "visible", timeout: 40_000 });
    const r = await settledShot(page, canvas, `standalone-${file.replace(/\.html$/, "")}-offline.png`, null);
    rendered = (r.shot?.byteLength ?? 0) > 20_000;
  } catch (e) {
    errors.push(String(e));
  }
  const boundary = await page.getByText(/not your anatomy/i).first().isVisible().catch(() => false);
  await context.close();
  return { rendered, nonFileRequests: requests, errors, boundary };
}
report.measurements.standaloneEngineOffline = await standaloneOffline("EyeExplorer-engine.html");
report.measurements.standaloneExplorerOffline = await standaloneOffline("EyeExplorer.html");

// ---------------------------------------------------------------- installed app, offline reload of Visualize
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(baseURL + "/");
  await page.getByRole("button", { name: /skip setup/i }).click();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  await page.goto(baseURL + "/#/visualize");
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 30_000 });
  await context.setOffline(true);
  await page.reload();
  let canvasOffline = false;
  try {
    await page.locator("canvas").first().waitFor({ state: "visible", timeout: 30_000 });
    canvasOffline = true;
  } catch {}
  const text = canvasOffline ? "" : (await page.locator("body").innerText()).slice(0, 300);
  report.measurements.installedVisualizeOfflineReload = { canvasOffline, bodyTextIfNot: text };
  await context.close();
}

report.host.loadAtEnd = loadavg();
writeFileSync(resolve(outDir, "capture-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.measurements, null, 2));
await browser.close();
