import { expect, test, asReturningUser, collectErrors } from "./helpers";

test.describe("self-tests — checks you do yourself", () => {
  test("the Amsler check runs end to end and saves a result", async ({ page }) => {
    const errors = collectErrors(page);
    await asReturningUser(page);
    await page.goto("/#/self-tests");
    await page.locator(".card", { hasText: /amsler/i }).getByRole("button", { name: /start this check/i }).click();

    // The conditions form gates the test area.
    await page.getByLabel(/distance/i).fill("40");
    await page.getByLabel(/wearing/i).selectOption("glasses");
    await page.getByLabel(/brightness/i).selectOption("medium");
    await page.getByLabel(/room lighting/i).selectOption("normal");

    const grid = page.locator("canvas").first();
    await grid.click({ position: { x: 160, y: 160 } });
    await expect(page.getByText(/1/i).first()).toBeVisible();

    await page.getByLabel(/note/i).fill("A wobble near the centre");
    await page.getByRole("button", { name: /save this check/i }).click();
    await expect(page.getByText(/recorded/i).first()).toBeVisible();
    await page.getByRole("button", { name: /done/i }).click();

    // It lands in history and on the timeline, framed as self-comparison.
    await expect(page.getByText(/your previous checks/i).first()).toBeVisible();
    await page.goto("/#/timeline");
    await page.getByRole("button", { name: "Everything" }).click();
    await page.getByRole("button", { name: "All time" }).click();
    await expect(page.getByText(/amsler/i).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the home acuity check calibrates, steps, and records honestly", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/self-tests");
    await page.locator(".card", { hasText: /home vision/i }).getByRole("button", { name: /start this check/i }).click();
    await page.getByLabel(/distance/i).fill("40");
    await page.getByLabel(/wearing/i).selectOption("none");
    await page.getByLabel(/brightness/i).selectOption("medium");
    await page.getByLabel(/room lighting/i).selectOption("normal");

    // Calibration: the card width drives the px-per-mm scale.
    const cal = page.locator('input[type="range"]').first();
    await expect(cal).toBeVisible();
    await cal.fill("330"); // must differ from the 320 default or React dedupes the change

    // Step through rows until the honest stop, then record.
    const could = page.getByRole("button", { name: /i could read that row/i });
    for (let i = 0; i < 16 && (await could.isVisible().catch(() => false)) && (await could.isEnabled().catch(() => false)); i++) {
      await could.click();
    }
    // Stop at the row the person cannot read — or at the screen's honest limit.
    const stop = page.getByRole("button", { name: /could not read this row/i });
    if (await stop.isVisible().catch(() => false)) await stop.click();

    await page.getByRole("button", { name: /save this check/i }).click();
    await expect(page.getByText(/recorded/i).first()).toBeVisible();
  });

  test("the contrast check records where the person stops", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/self-tests");
    await page.locator(".card", { hasText: /contrast/i }).getByRole("button", { name: /start this check/i }).click();
    await page.getByLabel(/distance/i).fill("40");
    await page.getByLabel(/wearing/i).selectOption("glasses");
    await page.getByLabel(/brightness/i).selectOption("low");
    await page.getByLabel(/room lighting/i).selectOption("dim");

    const can = page.getByRole("button", { name: /i can see it/i });
    const cannot = page.getByRole("button", { name: /cannot see it/i });
    for (let i = 0; i < 3 && (await can.isVisible().catch(() => false)); i++) await can.click();
    await cannot.click();
    await page.getByRole("button", { name: /save this check/i }).click();
    await expect(page.getByText(/recorded/i).first()).toBeVisible();
  });
});
