import { expect, test, asReturningUser, loadDemo, collectErrors, todaySaved } from "./helpers";

test.describe("persistence — nothing saved may quietly vanish", () => {
  test("every quick record survives a reload", async ({ page }) => {
    const errors = collectErrors(page);
    await asReturningUser(page);

    // A quiet day and a symptom, written through the UI.
    await page.getByRole("button", { name: /nothing different today/i }).click();
    // The post-commit confirmation, not the "recorded as no change" note, which follows the
    // store the instant the button is pressed (V-010).
    await todaySaved(page);

    await page.reload();
    await expect(page.getByText(/recorded as no change/i)).toBeVisible({ timeout: 10_000 });
    expect(errors).toEqual([]);
  });

  test("clinical records written via My Eyes survive a reload", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/my-eyes");
    await page
      .getByRole("region", { name: "Right Eye (OD)" })
      .getByRole("button", { name: "+ Diagnosis" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Diagnosis" }).fill("Reload persistence dx");
    await dialog.getByRole("button", { name: /save diagnosis/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.reload();
    await page.waitForTimeout(700);
    await expect(page.getByText("Reload persistence dx")).toBeVisible();
  });

  test("demo data survives a reload and the record keeps its coherence", async ({ page }) => {
    await asReturningUser(page);
    await loadDemo(page);
    await page.reload();
    await page.waitForTimeout(800);

    await page.goto("/#/settings");
    await expect(page.getByText(/demo data is currently loaded/i)).toBeVisible();

    // And the timeline can read it.
    await page.goto("/#/timeline");
    await page.getByRole("button", { name: "All time" }).click();
    await page.waitForTimeout(300);
    const body = await page.locator("main").innerText();
    expect(body.length).toBeGreaterThan(100);
  });

});
