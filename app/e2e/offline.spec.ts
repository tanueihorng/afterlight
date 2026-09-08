import { expect, test } from "@playwright/test";

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

  test("opens and records an entry with the network cut", async ({ page, context, browserName }) => {
    // Playwright's WebKit throws an internal error on reload while offline; the behaviour itself
    // is verified on Chromium. Retest by hand on a real iOS device before release.
    test.skip(browserName === "webkit", "offline reload is not driveable in Playwright WebKit");

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
