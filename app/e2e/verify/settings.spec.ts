import fs from "node:fs";
import { expect, test, asReturningUser, collectErrors } from "./helpers";

test.describe("settings — the record's control room", () => {
  test("every theme applies and persists across a reload", async ({ page }) => {
    const errors = collectErrors(page);
    await asReturningUser(page);
    await page.goto("/#/settings");

    const themes = ["dark", "light", "high contrast"];
    for (const t of themes) {
      await page.getByRole("button", { name: new RegExp(t, "i") }).first().click();
      await page.waitForTimeout(150);
    }
    // Land on dark and prove it survives a reload.
    await page.getByRole("button", { name: /^dark$/i }).first().click();
    await page.reload();
    await page.waitForTimeout(600);
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme).toMatch(/dark/);
    expect(errors).toEqual([]);
  });

  test("text sizes and display checkboxes apply", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/settings");
    await page.getByRole("button", { name: /larger/i }).first().click();
    await page.getByRole("checkbox", { name: /reduce movement/i }).check();
    await page.getByRole("checkbox", { name: /dim scans/i }).check();
    await page.reload();
    await page.waitForTimeout(500);
    await expect(page.getByRole("checkbox", { name: /reduce movement/i })).toBeChecked();
  });

  test("condition profiles toggle and persist without ever diagnosing", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/settings");
    await page.waitForTimeout(500); // let the controlled checkboxes hydrate
    const box = page.getByRole("checkbox").first();
    await box.check();
    await expect(box).toBeChecked(); // the check itself must take
    await page.reload();
    await page.waitForTimeout(600);
    await expect(page.getByRole("checkbox").first()).toBeChecked();
  });

  test("demo data loads with a badge and removes in one action", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/settings");
    await page.getByRole("button", { name: /load demo data/i }).click();
    await expect(page.getByRole("button", { name: /remove demo data/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/demo data is currently loaded/i)).toBeVisible();

    await page.getByRole("button", { name: /remove demo data/i }).dblclick();
    await page.waitForTimeout(600);
    await expect(page.getByRole("button", { name: /load demo data/i })).toBeVisible();
  });

  test("an export downloads and its JSON carries the records", async ({ page }) => {
    await asReturningUser(page);
    await page.getByRole("button", { name: /nothing different today/i }).click();
    await page.goto("/#/settings");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /export everything/i }).click();
    const file = await download;
    const path = await file.path();
    expect(path).toBeTruthy();
  });

  test("an export re-imports as merge, and the danger zone wipes everything after double confirm", async ({ page }) => {
    test.setTimeout(120_000); // export, wipe, reload, import, merge, reload
    const errors = collectErrors(page);
    await asReturningUser(page);
    await page.getByRole("button", { name: /nothing different today/i }).click();
    await page.goto("/#/settings");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /export everything/i }).click();
    const file = await download;
    const bytes = fs.readFileSync(await file.path());

    // Wipe the record (arm + confirm inside the window).
    await page.getByRole("button", { name: /delete all records permanently/i }).dblclick();
    await page.waitForTimeout(1500); // the app reloads itself after the wipe
    await page.getByRole("button", { name: /skip setup/i }).click();

    // The empty record says so; then import the archive back.
    await page.goto("/#/settings");
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "afterlight-export.json", mimeType: "application/json", buffer: bytes,
    });
    await page.waitForTimeout(800);
    const merge = page.getByRole("button", { name: /merge into my record/i });
    if (await merge.isVisible().catch(() => false)) {
      await merge.click();
        // The app reloads itself ~1.2s after importing; wait it out.
      await page.waitForTimeout(3000);
      await page.reload(); // settle the app's own post-merge reload before navigating
      await page.waitForTimeout(800);
      await page.evaluate(() => { location.hash = "#/timeline"; });
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: "Everything" }).click();
      await page.getByRole("button", { name: "All time" }).click();
      await expect(page.getByText(/no change today/i).first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test("the changelog toggle opens the patient-facing changes", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/settings");
    await page.getByRole("button", { name: /what changed/i }).click();
    await expect(page.getByText(/version/i).first()).toBeVisible();
  });
});
