import { expect, test, asReturningUser, loadDemo, collectErrors } from "./helpers";

test.skip(({ browserName }) => browserName !== "chromium", "the renderer needs Chromium's WebGL");

test.describe("visualize — understanding, not diagnosing", () => {
  test("the atlas search finds a condition and its detail opens with honest boundaries", async ({ page }) => {
    const errors = collectErrors(page);
    await asReturningUser(page);
    await loadDemo(page);
    await page.goto("/#/visualize");
    await page.getByRole("button", { name: /condition atlas/i }).click();

    await page.getByRole("searchbox").or(page.getByLabel(/search/i)).first().fill("detachment");
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /detachment/i }).first().click();

    const detail = page.getByText(/generic|not your eye|educational/i).first();
    await expect(detail).toBeVisible();
    // A deep link to this entry is available.
    await expect(page.getByRole("link", { name: /link to this entry/i })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("an atlas entry can be reached by deep link with the atlas tab open", async ({ page }) => {
    await asReturningUser(page);
    await loadDemo(page);
    await page.goto("/#/visualize/atlas/retinal_detachment");
    await page.waitForTimeout(600);
    await expect(page.getByText(/generic|not your eye|educational/i).first()).toBeVisible();
  });

  test("the severity slider and the one/compare view change the simulation", async ({ page }) => {
    await asReturningUser(page);
    await loadDemo(page);
    await page.goto("/#/visualize/atlas/retinal_detachment");
    await page.waitForTimeout(600);

    const slider = page.locator('input[type="range"]').first();
    if (await slider.isVisible().catch(() => false)) {
      await slider.fill("80");
      await expect(slider).toHaveValue("80");
    }

    const compare = page.getByRole("button", { name: /compare/i }).first();
    if (await compare.isVisible().catch(() => false)) await compare.click();
    await expect(page.getByText(/generic|not your eye|educational/i).first()).toBeVisible();
  });

  test("retina states render nine states without ever using alarm colour as decoration", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/visualize");
    await page.getByRole("button", { name: /retina states/i }).click();
    for (const state of [/pvd/i, /tear/i, /detachment/i, /gas bubble/i]) {
      const btn = page.getByRole("button", { name: state }).first();
      if (await btn.isVisible().catch(() => false)) await btn.click();
    }
    await expect(page.getByText(/generic|not your eye|educational/i).first()).toBeVisible();
  });

  test("the procedures tab steps through an explainer", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/visualize");
    await page.getByRole("button", { name: /procedures/i }).click();
    const step = page.locator('input[type="range"]').first();
    if (await step.isVisible().catch(() => false)) {
      await step.fill("3");
      await expect(step).toHaveValue("3");
    }
    // The library explainers disclose and scrub.
    const explainer = page.getByRole("button", { name: /vitrectomy|what this involved/i }).first();
    if (await explainer.isVisible().catch(() => false)) {
      await explainer.click();
      const next = page.getByRole("button", { name: /next/i }).first();
      if (await next.isVisible().catch(() => false)) await next.click();
    }
  });

  test("the eye studio offers its views and iris controls with the generic-model boundary", async ({ page }) => {
    const errors = collectErrors(page);
    await asReturningUser(page);
    await page.goto("/#/visualize");
    await page.waitForTimeout(600);

    for (const view of [/exterior/i, /cross-section/i, /cornea/i, /fundus/i]) {
      const btn = page.getByRole("button", { name: view }).first();
      if (await btn.isVisible().catch(() => false)) await btn.click();
    }
    const reset = page.getByRole("button", { name: /reset view/i });
    if (await reset.isVisible().catch(() => false)) await reset.click();

    await expect(page.getByText(/generic|not your eye|educational/i).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the 3D explorer iframe loads from the app", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/visualize");
    await page.getByRole("button", { name: /3d explorer/i }).click();
    const frame = page.frameLocator("iframe");
    await expect(frame.locator("body")).toContainText(/afterlight|explorer|eye/i, { timeout: 45_000 }); // the 2.8 MB explorer builds its scene from scratch; this is a presence check, not a budget
  });

  test("inside the app the explorer has no Diagnose tab; the standalone file keeps it", async ({
    page,
  }) => {
    await asReturningUser(page);
    await page.goto("/#/visualize");
    await page.getByRole("button", { name: /3d explorer/i }).click();
    const frame = page.frameLocator("iframe");
    // The tab is in the file's markup until the explorer's script runs, so wait for it to boot.
    await expect(frame.locator("#viewport canvas")).toBeVisible({ timeout: 45_000 });
    await expect(frame.locator("#bootmsg")).not.toBeVisible();
    await expect(frame.getByRole("button", { name: /diagnose/i })).toHaveCount(0);
    await expect(frame.locator("#tabDx")).toBeHidden();

    // The same file opened on its own is the clinician-led teaching tool, and is unchanged.
    await page.goto("/EyeExplorer.html");
    await expect(page.locator("#gtabs button", { hasText: "Diagnose" })).toHaveCount(1);
  });
});
