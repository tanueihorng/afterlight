import { expect, test } from "@playwright/test";

/**
 * The engine is only testable where there is a real GPU context, so its lifecycle lives here
 * rather than in the unit suite. A leaked geometry or texture is invisible until a tab runs out
 * of memory, which is exactly the kind of failure a patient would experience as "it got slow".
 */
test.describe("the eye engine", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "needs Chromium's WebGL and metrics");

  test("renders a real eye rather than falling back", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();
    await page.goto("/#/visualize");

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2500);

    // The WebGL drawing buffer is cleared once presented, so readPixels sees nothing; the honest
    // check is the rendered image itself. A blank canvas compresses to a couple of kilobytes,
    // a rendered eye does not.
    const shot = await canvas.screenshot();
    expect(shot.byteLength).toBeGreaterThan(20_000);

    // And the engine did not quietly fall back to the "3D unavailable" message.
    await expect(page.getByText(/does not support WebGL2/i)).toHaveCount(0);
  });

  test("carries the generic-model boundary in the accessible name and on the page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();
    await page.goto("/#/visualize");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText(/not your anatomy/i).first()).toBeVisible();
    const label = await page.locator("canvas").first().getAttribute("aria-label");
    expect(label).toMatch(/generic model/i);
    expect(label).toMatch(/not your anatomy/i);
  });

  test("does not leak GPU resources across repeated mounts", async ({ page }) => {
    // Software GL is slow; this deliberately does real work many times over.
    test.setTimeout(120_000);
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.goto("/#/visualize");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1200);

    const heapAfter = async () => {
      const client = await page.context().newCDPSession(page);
      const { metrics } = await client.send("Performance.getMetrics");
      await client.detach();
      return metrics.find((m) => m.name === "JSHeapUsedSize")?.value ?? 0;
    };

    const baseline = await heapAfter();

    // Navigate within the app rather than reloading, so this is a genuine mount/unmount cycle
    // of the WebGL scene rather than a fresh page each time.
    const today = page.getByRole("button", { name: "Today", exact: true });
    const visualize = page.getByRole("button", { name: "Visualize", exact: true });
    for (let i = 0; i < 12; i++) {
      await today.click();
      await page.waitForTimeout(80);
      await visualize.click();
      await page.waitForTimeout(220);
    }
    await page.waitForTimeout(1500);

    const after = await heapAfter();
    const growthMb = (after - baseline) / (1024 * 1024);

    // A dozen mounts of a WebGL scene that disposed nothing would grow the heap far more.
    expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
    expect(growthMb, `heap grew ${growthMb.toFixed(1)} MB across 12 mounts`).toBeLessThan(40);
  });

  test("turns with the keyboard, not only the mouse", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();
    await page.goto("/#/visualize");
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1500);
    await canvas.focus();
    const before = await canvas.screenshot();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(400);
    const after = await canvas.screenshot();

    expect(Buffer.compare(before, after)).not.toBe(0);
  });
});
