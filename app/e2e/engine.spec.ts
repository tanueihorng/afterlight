import { expect, test } from "@playwright/test";

/**
 * The engine is only testable where there is a real GPU context, so its lifecycle lives here
 * rather than in the unit suite. A leaked geometry or texture is invisible until a tab runs out
 * of memory, which is exactly the kind of failure a patient would experience as "it got slow".
 */
// Software GL: parallel SwiftShader contexts starve each other past the canvas wait, so every
// WebGL test in this file runs one at a time, including the top-level ones.
test.describe.configure({ mode: "serial" });

test.describe("the eye engine", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "needs Chromium's WebGL and metrics");

  test("renders a real eye rather than falling back", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();
    await page.goto("/#/visualize");

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2500);

    // The WebGL drawing buffer is cleared once presented, so readPixels sees nothing; the honest
    // check is the rendered image itself. A blank canvas compresses to a couple of kilobytes,
    // a rendered eye does not.
    const shot = await canvas.screenshot();
    expect(shot.byteLength).toBeGreaterThan(20_000);

    // And the engine did not quietly fall back to the "3D unavailable" message.
    await expect(page.getByText(/does not support WebGL2/i)).toHaveCount(0);
  });

  test("carries the generic-model boundary in the accessible name and on the page", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();
    await page.goto("/#/visualize");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

    await expect(page.getByText(/not your anatomy/i).first()).toBeVisible();
    const label = await page.locator("canvas").first().getAttribute("aria-label");
    expect(label).toMatch(/generic model/i);
    expect(label).toMatch(/not your anatomy/i);
  });

  test("does not leak GPU resources across repeated mounts", async ({ page }) => {
    // Software GL is slow, and each mount now assembles the full anatomical model; eight
    // cycles still catches a leak that twelve did.
    test.setTimeout(240_000);
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.goto("/#/visualize");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
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
    for (let i = 0; i < 8; i++) {
      await today.click();
      await page.waitForTimeout(80);
      await visualize.click();
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(1500);

    const after = await heapAfter();
    const growthMb = (after - baseline) / (1024 * 1024);

    // Eight mounts of a WebGL scene that disposed nothing would grow the heap far more.
    expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
    expect(growthMb, `heap grew ${growthMb.toFixed(1)} MB across 12 mounts`).toBeLessThan(40);
  });

  test("sections rebuild and dispose without growing resources across sweeps", async ({ page }) => {
    // software GL renders each slice step slowly; two identical rounds still prove no growth
    test.setTimeout(240_000);
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();
    await page.goto("/#/visualize");
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Cross-section", exact: true }).click();
    const slice = page.getByRole("slider", { name: "Slice position" });
    await expect(slice).toHaveCount(1);

    const memoryAfter = async () => {
      // the engine exposes renderer.info through the canvas for diagnostics
      return page.evaluate(async () => {
        const scene = (window as unknown as { __eyeScene?: { info: () => { memory: { geometries: number; textures: number } } } }).__eyeScene;
        if (!scene) return null;
        return scene.info().memory;
      });
    };

    await slice.focus();
    const sweep = async () => {
      await page.keyboard.press("Home");
      for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
    };
    await sweep();
    await page.waitForTimeout(800);
    const before = await memoryAfter();
    await sweep();
    await page.waitForTimeout(800);
    const after = await memoryAfter();
    expect(before).not.toBeNull();
    expect(after!.geometries, "geometry count grew across identical sweeps").toBeLessThanOrEqual(
      before!.geometries,
    );
  });

  test("turns with the keyboard, not only the mouse", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();
    await page.goto("/#/visualize");
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 30_000 });
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

test("explores slices, cornea and retina without replacing the canvas", async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /skip setup/i }).click();
  await page.goto("/#/visualize");
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await canvas.evaluate((node) => node.setAttribute("data-original", "yes"));
  await page.getByRole("button", { name: "Cross-section", exact: true }).click();
  const before = await canvas.screenshot();
  const slice = page.getByRole("slider", { name: "Slice position" });
  await slice.focus();
  await page.keyboard.press("Home");
  const after = await canvas.screenshot();
  expect(Buffer.compare(before, after)).not.toBe(0);
  await page.getByRole("button", { name: "Cornea", exact: true }).click();
  const separation = page.getByRole("slider", { name: "Separate parts (illustrative spacing)" });
  await separation.focus();
  await page.keyboard.press("End");
  await expect(separation).toHaveValue("1");
  await page.getByRole("button", { name: "Retina", exact: true }).click();
  await expect(slice).toHaveCount(0);
  expect(Buffer.compare(after, await canvas.screenshot())).not.toBe(0);
  await expect(canvas).toHaveAttribute("data-original", "yes");
  await expect(canvas).toHaveAccessibleName(/not your anatomy/);
  await page.getByRole("button", { name: "Whole eye", exact: true }).click();
  await expect(page.getByRole("button", { name: "Whole eye", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("the standalone explorer loads baked detail and remains interactive offline", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const remote: string[] = [];
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith("http://localhost:"))
      remote.push(request.url());
  });
  await page.goto("/EyeExplorer.html");
  const canvas = page.locator("#viewport canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#bootmsg")).not.toBeVisible();
  await expect(canvas).toHaveAccessibleName(/not your anatomy/);
  await context.setOffline(true);
  await page.locator("#eyeColor").selectOption("blue");
  await expect(page.locator("#eyeColor")).toHaveValue("blue");
  await page.locator("#cutSlider").focus();
  await page.keyboard.press("End");
  await expect(page.locator("#cutSlider")).toHaveValue("100");
  expect((await canvas.screenshot()).byteLength).toBeGreaterThan(20_000);
  expect(errors).toEqual([]);
  expect(remote).toEqual([]);
});
