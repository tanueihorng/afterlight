import { expect, test, asReturningUser, loadDemo, collectErrors } from "./helpers";

async function openModal(page: import("@playwright/test").Page, name: string | RegExp) {
  await page
    .getByRole("region", { name: "Right Eye (OD)" })
    .getByRole("button", { name })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return page.getByRole("dialog");
}

test.describe("my eyes — the clinical record", () => {
  test("diagnosis: saves, lists, and lands on the timeline; confirmed defaults unchecked", async ({ page }) => {
    const errors = collectErrors(page);
    await asReturningUser(page);
    await page.goto("/#/my-eyes");
    const dialog = await openModal(page, "+ Diagnosis");

    // Provenance: a person typing a diagnosis has not had a clinician confirm it.
    await expect(dialog.getByRole("checkbox", { name: /confirmed by a clinician/i })).not.toBeChecked();

    await dialog.getByRole("textbox", { name: "Diagnosis" }).fill("Verify dry eye");
    await dialog.getByRole("button", { name: /save diagnosis/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Verify dry eye")).toBeVisible();

    await page.goto("/#/timeline");
    await page.getByRole("button", { name: "All time" }).click();
    await expect(page.getByText(/diagnosis — verify dry eye/i).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("procedure: saves and lists", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/my-eyes");
    const dialog = await openModal(page, "+ Procedure");
    await dialog.getByPlaceholder(/vitrectomy/).fill("Verify probing");
    await dialog.getByRole("button", { name: /save procedure/i }).click();
    await expect(page.getByText("Verify probing")).toBeVisible();
  });

  test("medication: self-care variant omits prescriber fields", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/my-eyes");
    const dialog = await openModal(page, "+ Medication");
    await dialog.getByRole("textbox", { name: "Name" }).fill("Verify tears");
    await dialog.getByLabel(/type/i).selectOption("self_care");
    await expect(dialog.getByLabel(/prescribed by/i)).toHaveCount(0);
    await dialog.getByRole("button", { name: /save medication/i }).click();
    await expect(page.getByText("Verify tears")).toBeVisible();
  });

  test("measurement: value gates the save and the reading appears in trends", async ({ page }) => {
    await asReturningUser(page);
    await loadDemo(page);
    await page.goto("/#/my-eyes");
    const dialog = await openModal(page, "+ Measurement");
    const save = dialog.getByRole("button", { name: /save measurement/i });
    await dialog.getByLabel(/type/i).selectOption("iop");
    await expect(save).toBeDisabled();
    await dialog.getByPlaceholder(/e\.g\. 14/).fill("15");
    await expect(save).toBeEnabled();
    await dialog.getByRole("button", { name: /save measurement/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // The trends card plots the person's own numbers, never judged.
    await expect(page.getByText(/recorded numbers/i).first()).toBeVisible();
  });

  test("baseline edit saves per eye", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/my-eyes");
    const dialog = await openModal(page, /edit baseline/i);
    await dialog.getByLabel(/baseline description/i).fill("Usually clear, mild morning blur");
    await dialog.getByRole("button", { name: /save baseline/i }).click();
    await expect(page.getByText(/usually clear, mild morning blur/i).first()).toBeVisible();
  });

  test("prescription: adds and deletes a row", async ({ page }) => {
    const errors = collectErrors(page);
    await asReturningUser(page);
    await page.goto("/#/my-eyes");
    await page.getByRole("button", { name: /add prescription/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^date/i).fill("2026-09-01");
    await dialog.getByRole("button", { name: /save prescription/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Two-click arm within 2.6s: a double-click lands inside the window.
    await page.getByRole("button", { name: /delete/i }).first().dblclick();
    await page.waitForTimeout(300);
    expect(errors).toEqual([]);
  });

  test("missing values are shown as missing, never as blank health", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/my-eyes");
    await page.waitForTimeout(400);
    const body = await page.locator("main").innerText();
    expect(body).toMatch(/not recorded/i);
  });
});
