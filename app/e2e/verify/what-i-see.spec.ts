import { expect, test, asReturningUser, loadDemo, collectErrors } from "./helpers";

test.describe("what I see — drawings", () => {
  test("a drawing can be made, saved, found in history, and deleted", async ({ page }) => {
    const errors = collectErrors(page);
    await asReturningUser(page);
    await page.goto("/#/what-i-see");
    await page.waitForTimeout(400);

    // Save is disabled while the canvas is empty — a record of nothing is not a record.
    await expect(page.getByRole("button", { name: /save drawing/i })).toBeDisabled();

    const canvas = page.locator("canvas").first();
    await canvas.click({ position: { x: 120, y: 120 } });
    await expect(page.getByRole("button", { name: /save drawing/i })).toBeEnabled();

    await page.getByLabel(/describe what you drew/i).fill("A dot upper right");
    await page.getByRole("button", { name: /save drawing/i }).click();

    // Saving lands on the visual history gallery; the description lives in the detail modal.
    await expect(page.locator(".gallery-item")).toHaveCount(1);
    await page.locator(".gallery-item").first().click();
    const detail = page.getByRole("dialog");
    await expect(detail.getByText("A dot upper right")).toBeVisible();
    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);

    // The drawing reaches the timeline.
    await page.goto("/#/timeline");
    await page.getByRole("button", { name: "Everything" }).click();
    await expect(page.getByText(/visual field drawing/i).first()).toBeVisible();

    // Delete it again, two-click confirm.
    await page.goto("/#/what-i-see");
    await page.getByRole("tab", { name: /visual history/i }).click();
    await page.waitForTimeout(300);
    await page.locator(".gallery-item").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // The confirm is a two-click arm within 2.6s: a double-click lands inside that window.
    await dialog.getByRole("button", { name: /delete drawing/i }).dblclick();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("undo, redo and clear behave on the canvas", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/what-i-see");
    await page.waitForTimeout(400);
    const canvas = page.locator("canvas").first();

    await canvas.click({ position: { x: 100, y: 100 } });
    await canvas.click({ position: { x: 200, y: 200 } });
    const words = page.getByText(/in words/i);
    await expect(words).toContainText(/2/i);

    await page.getByRole("button", { name: /undo/i }).click();
    await expect(words).toContainText(/1/i);
    await page.getByRole("button", { name: /redo/i }).click();
    await expect(words).toContainText(/2/i);
    await page.getByRole("button", { name: /clear/i }).click();
    await expect(page.getByRole("button", { name: /save drawing/i })).toBeDisabled();
  });

  test("compare two dates blends one drawing over the other", async ({ page }) => {
    await asReturningUser(page);
    await loadDemo(page);
    await page.goto("/#/what-i-see");
    await page.getByRole("tab", { name: /compare two dates/i }).click();
    await page.waitForTimeout(400);

    const items = page.locator(".gallery-item");
    expect(await items.count()).toBeGreaterThanOrEqual(2);
    await items.first().click();
    await items.last().click();
    await page.waitForTimeout(200);

    const slider = page.locator('input[type="range"]');
    await expect(slider.first()).toBeVisible();
    await slider.first().fill("70");
    await expect(slider.first()).toHaveValue("70");
  });
});
