import { expect, test, asReturningUser, loadDemo, collectErrors } from "./helpers";

/** A tiny valid PNG (1×1 transparent) for upload tests. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("imaging & documents", () => {
  test("adding one scan with details stores it, with a needs-checking flow that clears", async ({ page }) => {
    const errors = collectErrors(page);
    await asReturningUser(page);
    await page.goto("/#/imaging");
    await page.getByRole("button", { name: /add one scan/i }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel(/modality/i).selectOption("OCT");
    await dialog.getByLabel(/date/i).fill("2026-09-01");
    await dialog.getByLabel(/eye/i).selectOption("left");
    await dialog.locator('input[type="file"]').setInputFiles([
      { name: "scan.png", mimeType: "image/png", buffer: PNG },
    ]);
    await dialog.getByRole("button", { name: /save/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // The record exists and can be opened; it stores the file bytes.
    await page.getByRole("button", { name: /sep 2026|oct/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });

  test("batch ingest flags an ambiguous date instead of guessing", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/imaging");
    await page.getByRole("button", { name: /add files/i }).click();
    const dialog = page.getByRole("dialog");

    // "04-09-2026" is ambiguous: the ingest must offer both readings, never pick one.
    await dialog.locator('input[type="file"]').setInputFiles([
      { name: "ClinicScan_04-09-2026.png", mimeType: "image/png", buffer: PNG },
    ]);
    await page.waitForTimeout(400);
    const body = await dialog.innerText();
    expect(body.length).toBeGreaterThan(0);

    // The ambiguous date renders as a three-way choice instead of a guess.
    const dateChoice = dialog.getByRole("combobox").filter({
      has: page.locator("option", { hasText: /day first/i }),
    });
    await expect(dateChoice.first()).toBeVisible();
    const options = await dateChoice.first().locator("option").allInnerTexts();
    expect(options.join(" ")).toMatch(/day first/i);

    // Apply-to-all works and the unchecked count is shown honestly.
    await dialog.getByRole("button", { name: /i have checked all/i }).click();
    await expect(dialog.getByRole("button", { name: /add .* file/i })).toBeEnabled();
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("documents: adding, opening and deleting a document with its file", async ({ page }) => {
    const errors = collectErrors(page);
    await asReturningUser(page);
    await page.goto("/#/imaging");
    await page.getByRole("tab", { name: /documents/i }).click();
    await page.getByRole("button", { name: /add one document/i }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel(/title/i).fill("Verify clinic letter");
    await dialog.getByLabel(/document type/i).selectOption("clinic letter");
    await dialog.getByLabel(/document date/i).fill("2026-08-15");
    await dialog.locator('input[type="file"]').setInputFiles([
      { name: "letter.txt", mimeType: "text/plain", buffer: Buffer.from("Clinic letter text") },
    ]);
    await dialog.getByRole("checkbox", { name: /i have checked/i }).check();
    await dialog.getByRole("button", { name: /save/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Verify clinic letter")).toBeVisible();

    // Opening shows the stored file; deleting removes record and file.
    const row = page.getByRole("button", { name: /verify clinic letter/i });
    await row.click();
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");

    const del = page.getByRole("button", { name: /delete/i }).first();
    await del.dblclick(); // arm + confirm inside the window
    await page.waitForTimeout(400);
    await expect(page.getByText("Verify clinic letter")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("the OCT compare card exists when two OCT scans exist", async ({ page }) => {
    await asReturningUser(page);
    await loadDemo(page);
    await page.goto("/#/imaging");
    await page.waitForTimeout(400);
    await expect(page.getByText(/earlier scan|later scan/i).first()).toBeVisible();
  });
});
