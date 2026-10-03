import { expect, test, devices, type Browser } from "@playwright/test";
import type { AddressInfo } from "node:net";
import { preview } from "vite";

async function recordOfflineInWebKit(browser: Browser) {
  const server = await preview({ preview: { host: "127.0.0.1", port: 0 } });
  const address = server.httpServer.address();
  if (!address || typeof address === "string") {
    await server.close();
    throw new Error("The isolated preview server did not start on a TCP port");
  }
  const origin = `http://127.0.0.1:${(address as AddressInfo).port}`;
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  let serverOpen = true;

  try {
    const page = await context.newPage();
    await page.goto(origin);
    await page.getByRole("button", { name: /skip setup/i }).click();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
      timeout: 20_000,
    });

    const shell = await page.evaluate(async () => {
      const response = await fetch("./sw.js");
      if (!response.ok) throw new Error("The service worker script could not be read");
      const worker = await response.text();
      const match = worker.match(/const SHELL = (\[[^;]+\]);/);
      if (!match) throw new Error("The generated service worker has no shell manifest");
      const files = JSON.parse(match[1]) as string[];
      const missing: string[] = [];
      for (const file of files) {
        if (!(await caches.match(file, { ignoreVary: true }))) missing.push(file);
      }
      return { count: files.length, missing };
    });
    expect(shell.count).toBeGreaterThan(4);
    expect(shell.missing, "Every precached shell file must exist before going offline").toEqual(
      [],
    );

    await server.close();
    serverOpen = false;
    expect(await fetch(origin).then(() => true, () => false)).toBe(false);

    // Stop the actual origin instead of toggling Playwright's offline emulation. WebKit can
    // return an internal navigation error for that emulation even with a valid service worker.
    await page.reload({ waitUntil: "domcontentloaded", timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /how is your vision today/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: /nothing different today/i }).click();
    await expect(
      page.getByRole("status").filter({
        has: page.getByRole("button", { name: "View timeline →", exact: true }),
      }),
    ).toContainText(/Today is recorded/);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 20_000 });
    await expect(page.getByText(/recorded as no change/i)).toBeVisible({ timeout: 10_000 });
  } finally {
    await context.close();
    if (serverOpen) await server.close();
  }
}

/**
 * The gap Phase 02 could not verify: this app has to work on a train, in a waiting room, and in
 * a hospital basement. Nothing about the record is on the network, so "offline" must be normal.
 */
test.describe("offline", () => {
  test("installs a service worker that caches only the shell", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
      timeout: 20_000,
    });

    const cached = await page.evaluate(async () => {
      const keys = await caches.keys();
      const cache = await caches.open(keys[0]);
      return (await cache.keys()).map((r) => new URL(r.url).pathname);
    });

    expect(cached.length).toBeGreaterThan(0);
    // Nothing about the record is cacheable, because none of it is on the network.
    expect(cached.every((p) => !p.includes("indexeddb"))).toBe(true);
  });

  test("opens and records an entry with the network cut", async ({ page, context, browser, browserName }) => {
    if (browserName === "webkit") {
      await recordOfflineInWebKit(browser);
      return;
    }

    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
      timeout: 20_000,
    });

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole("heading", { name: /how is your vision today/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /nothing different today/i }).click();
    await expect(page.getByText(/today is recorded/i)).toBeVisible();

    await context.setOffline(false);
  });

  test("makes no third-party requests at all", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.hostname !== "localhost" && url.protocol !== "data:" && url.protocol !== "blob:") {
        external.push(request.url());
      }
    });

    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();
    for (const route of ["today", "timeline", "my-eyes", "imaging", "appointments", "settings"]) {
      await page.goto(`/#/${route}`);
      await page.waitForTimeout(300);
    }

    expect(external, `unexpected third-party requests: ${external.join(", ")}`).toEqual([]);
  });
});
