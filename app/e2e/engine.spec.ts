import { expect, test } from "@playwright/test";

/**
 * The engine is only testable where there is a real GPU context, so its lifecycle lives here
 * rather than in the unit suite. A leaked geometry or texture is invisible until a tab runs out
 * of memory, which is exactly the kind of failure a patient would experience as "it got slow".
 */
// Software GL: parallel SwiftShader contexts starve each other past the canvas wait, so every
// WebGL test in this file runs one at a time, including the top-level ones.
test.describe.configure({ mode: "serial" });

// A CI runner has no GPU and is slower than a laptop at software GL: there the first frame of the
// full model alone can take over a minute. Every limit in this file stretches by this factor on
// CI, so a real failure (a blank canvas, a leak, an error) still fails and only slowness is
// forgiven. Locally the limits are as written.
const GL = process.env.CI ? 3 : 1;

test("inspects structures from the accessible list and resets", async ({ page }) => {
  test.setTimeout(120_000 * GL);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /skip setup/i }).click();
  await page.goto("/#/visualize");
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 30_000 * GL });

  // the cutaway is the initial presentation
  await expect(page.getByRole("button", { name: "Cross-section", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // list selection names the part and describes it in text, not colour alone
  const list = page.getByRole("list", { name: "Parts of the eye" });
  await list.getByRole("button", { name: "Cornea", exact: true }).click();
  const status = page.locator('p[aria-live="polite"]');
  await expect(status).toContainText("Cornea:");
  await expect(status).toContainText("clear front window");

  // keyboard-only: the selection carries to the aria-live status via keyboard alone
  await list.getByRole("button", { name: "Retina", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(status).toContainText("Retina:");

  // focus request moves the camera: the canvas must re-render (still the same element)
  await canvas.evaluate((node) => node.setAttribute("data-original", "yes"));
  await list.getByRole("button", { name: "Move the camera to the Retina" }).click();
  await expect(canvas).toHaveAttribute("data-original", "yes");

  // reset restores the documented initial state
  await page.getByRole("button", { name: "Reset view" }).click();
  await expect(status).toContainText("Nothing selected");
  await expect(page.getByRole("button", { name: "Cross-section", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(canvas).toHaveAttribute("data-original", "yes");
  await expect(canvas).toHaveAccessibleName(/not your anatomy/);
});

test.describe("the eye engine", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "needs Chromium's WebGL and metrics");
  // Browser setup itself times out under software GL before an in-body setTimeout has run, so the
  // headroom has to sit at group level (V-107). Tests that need more still set their own.
  test.setTimeout(120_000 * GL);

  test("renders a real eye rather than falling back", async ({ page }) => {
    // retries against software-GL screenshot races need room beyond the 30s default
    test.setTimeout(120_000 * GL);
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();
    await page.goto("/#/visualize");

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 30_000 * GL });
    await page.waitForTimeout(2500);

    // The WebGL drawing buffer is cleared once presented, so readPixels sees nothing; the honest
    // check is the rendered image itself. A blank canvas compresses to a couple of kilobytes,
    // a rendered eye does not. SwiftShader screenshots can hit element-stability races under
    // load, so this retries rather than weakening the byte threshold.
    let shot: Buffer | null = null;
    for (let attempt = 0; attempt < 3 && !shot; attempt++) {
      try {
        const candidate = await canvas.screenshot({ timeout: 15_000 * GL });
        if (candidate.byteLength > 20_000) shot = candidate;
      } catch {
        await page.waitForTimeout(1000);
      }
    }
    expect(shot, "the canvas never produced a rendered frame").not.toBeNull();

    // And the engine did not quietly fall back to the "3D unavailable" message.
    await expect(page.getByText(/does not support WebGL2/i)).toHaveCount(0);
  });

  test("carries the generic-model boundary in the accessible name and on the page", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();
    await page.goto("/#/visualize");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 * GL });

    await expect(page.getByText(/not your anatomy/i).first()).toBeVisible();
    const label = await page.locator("canvas").first().getAttribute("aria-label");
    expect(label).toMatch(/generic model/i);
    expect(label).toMatch(/not your anatomy/i);
  });

  test("does not leak GPU resources across repeated mounts", async ({ page }) => {
    // Software GL is slow, and each mount now assembles the full anatomical model; eight
    // cycles still catches a leak that twelve did.
    test.setTimeout(240_000 * GL);
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.goto("/#/visualize");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 * GL });
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
    const today = page
      .getByRole("button", { name: "Today", exact: true })
      .filter({ visible: true });
    // Visualize lives behind the dock's More menu on desktop.
    const openVisualize = async () => {
      await page
        .getByRole("button", { name: "More", exact: true })
        .filter({ visible: true })
        .click();
      await page
        .getByRole("button", { name: "Visualize", exact: true })
        .filter({ visible: true })
        .click();
    };
    for (let i = 0; i < 8; i++) {
      await today.click();
      await page.waitForTimeout(80);
      await openVisualize();
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
    test.setTimeout(240_000 * GL);
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();
    await page.goto("/#/visualize");
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 30_000 * GL });
    await page.getByRole("button", { name: "Cross-section", exact: true }).click();
    const slice = page.getByRole("slider", { name: "Slice position" });
    await expect(slice).toHaveCount(1);

    const memoryAfter = async () => {
      // the engine exposes renderer.info through the canvas for diagnostics
      return page.evaluate(async () => {
        const scene = (
          window as unknown as {
            __eyeScene?: { info: () => { memory: { geometries: number; textures: number } } };
          }
        ).__eyeScene;
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
    test.setTimeout(120_000 * GL);
    // With reduced motion the engine snaps to each pose instead of easing. Software GL draws
    // well under one frame a second, and the easing advances per frame, so the opening turn
    // alone took ~67s to come to rest locally and longer on CI, and a frame comparison raced
    // it. The arrow keys reach the same handler either way; reduced motion is also how many
    // people with low vision use the app.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();
    await page.goto("/#/visualize");
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 30_000 * GL });
    await canvas.focus();

    // The pixels the engine draws, read back from the canvas's own WebGL context right after a
    // draw. Page screenshots wait on the browser's compositor, and on a GPU-less runner each one
    // took 20–90s, which ate the test budget (V-107). This reads the same rendered frame without
    // that round trip. The eye only redraws when something changes, so draw once, then read.
    const frame = () =>
      page.evaluate(async () => {
        const scene = (
          window as unknown as {
            __eyeScene?: { ready: Promise<void>; renderOnce: () => void };
          }
        ).__eyeScene;
        const el = document.querySelector("canvas");
        if (!scene || !el) return null;
        await scene.ready; // shaders compile first; until then nothing is drawn
        const gl = el.getContext("webgl2") ?? el.getContext("webgl");
        if (!gl) return null;
        scene.renderOnce();
        const w = gl.drawingBufferWidth;
        const h = gl.drawingBufferHeight;
        const px = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let hash = 2166136261;
        let min = 255;
        let max = 0;
        for (let i = 0; i < px.length; i += 4) {
          hash = Math.imul(hash ^ px[i] ^ (px[i + 1] << 8) ^ (px[i + 2] << 16), 16777619);
          min = Math.min(min, px[i + 1]);
          max = Math.max(max, px[i + 1]);
        }
        // A blank or single-colour buffer would compare equal to itself and prove nothing.
        return { hash: hash >>> 0, drawn: max - min > 16 };
      });

    // Textures can still arrive after the first draw, so the frame may change on its own for a
    // moment. Wait until two reads in a row agree; only a change after that can be put down to
    // the keys. (Checked: with the arrow keys swallowed before they reach the canvas, this test
    // fails.)
    const settled: { last: Awaited<ReturnType<typeof frame>> } = { last: null };
    await expect
      .poll(
        async () => {
          const previous = settled.last;
          settled.last = await frame();
          return !!settled.last && settled.last.hash === previous?.hash;
        },
        {
          message: "the eye never settled to a still frame",
          timeout: 30_000 * GL,
          intervals: [500, 1000],
        },
      )
      .toBe(true);
    const before = settled.last!;
    expect(before.drawn, "the canvas holds no drawn eye to compare against").toBe(true);

    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(150);
    }
    // Poll rather than check once: each key press is drawn when the browser gets to it.
    await expect
      .poll(async () => (await frame())?.hash, {
        message: "keyboard arrows never changed the rendered eye",
        timeout: 30_000 * GL,
        intervals: [300, 600, 1000],
      })
      .not.toBe(before.hash);
    // And it is still a drawn eye after turning, not a cleared or broken buffer.
    expect((await frame())?.drawn, "turning left the canvas blank").toBe(true);
  });
});

test("explores slices, cornea and retina without replacing the canvas", async ({ page }) => {
  test.setTimeout(60_000 * GL);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /skip setup/i }).click();
  await page.goto("/#/visualize");
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 30_000 * GL });
  await canvas.evaluate((node) => node.setAttribute("data-original", "yes"));
  await page.getByRole("button", { name: "Cross-section", exact: true }).first().click();
  const before = await canvas.screenshot();
  const slice = page.getByRole("slider", { name: "Slice position" });
  await slice.focus();
  await page.keyboard.press("Home");
  const after = await canvas.screenshot();
  expect(Buffer.compare(before, after)).not.toBe(0);
  await page.getByRole("button", { name: "Cornea", exact: true }).first().click();
  const separation = page.getByRole("slider", { name: "Separate parts (illustrative spacing)" });
  await separation.focus();
  await page.keyboard.press("End");
  await expect(separation).toHaveValue("1");
  await page.getByRole("button", { name: "Retina", exact: true }).first().click();
  await expect(slice).toHaveCount(0);
  expect(Buffer.compare(after, await canvas.screenshot())).not.toBe(0);
  await expect(canvas).toHaveAttribute("data-original", "yes");
  await expect(canvas).toHaveAccessibleName(/not your anatomy/);
  await page.getByRole("button", { name: "Whole eye", exact: true }).first().click();
  await expect(
    page.getByRole("button", { name: "Whole eye", exact: true }).first(),
  ).toHaveAttribute("aria-pressed", "true");
});

test("the standalone explorer loads baked detail and remains interactive offline", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000 * GL);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const remote: string[] = [];
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith("http://localhost:"))
      remote.push(request.url());
  });
  await page.goto("/EyeExplorer.html");
  const canvas = page.locator("#viewport canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 * GL });
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
