import fs from "node:fs";
import {
  expect,
  test,
  asReturningUser,
  collectErrors,
  todaySaved,
  settingsSaved,
} from "./helpers";

test.describe("settings — the record's control room", () => {
  test("every theme applies and persists across a reload", async ({ page }) => {
    const errors = collectErrors(page);
    await asReturningUser(page);
    await page.goto("/#/settings");

    const themes = [
      ["Dark", "dark"],
      ["Light", "light"],
      ["High contrast dark", "hc-dark"],
      ["High contrast light", "hc-light"],
    ];
    for (const [label, theme] of themes) {
      const button = page.getByRole("button", { name: label, exact: true });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await settingsSaved(page, { theme });
      await page.reload();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    }
    expect(errors).toEqual([]);
  });

  test("text sizes and display checkboxes apply", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/settings");
    await page.getByRole("button", { name: /larger/i }).first().click();
    await page.getByRole("checkbox", { name: /reduce movement/i }).check();
    await page.getByRole("checkbox", { name: /dim scans/i }).check();
    await settingsSaved(page, { type_scale: 1.5, reduced_motion: true, dim_imagery: true });
    await page.reload();
    await expect(page.getByRole("button", { name: "Larger", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("checkbox", { name: /reduce movement/i })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /dim scans/i })).toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
    await expect(page.locator("html")).toHaveAttribute("data-imagery", "dimmed");
  });

  test("condition profiles toggle and persist without ever diagnosing", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/settings");
    await page.waitForTimeout(500); // let the controlled checkboxes hydrate
    // The profiles section, not the page's first checkbox — that one is "Reduce movement" (V-010).
    const profiles = page.locator("section", {
      has: page.getByRole("heading", { name: /what are you tracking/i }),
    });
    const box = profiles.getByRole("checkbox").first();
    await box.check();
    await expect(box).toBeChecked(); // the check itself must take
    await expect(profiles.getByText(/1 selected/i)).toBeVisible();
    await settingsSaved(page, { condition_profiles: [expect.any(String)] });
    await page.reload();
    await page.waitForTimeout(600);
    await expect(profiles.getByRole("checkbox").first()).toBeChecked();
    await expect(profiles.getByText(/not recorded as a diagnosis/i)).toBeVisible();
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
    await todaySaved(page);
    await page.goto("/#/settings");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /export everything/i }).click();
    const file = await download;
    const path = await file.path();
    expect(path).toBeTruthy();
    // The export must carry the day just recorded, not merely exist.
    const archive = JSON.parse(fs.readFileSync(path!, "utf8"));
    expect(archive.format).toBe("afterlight-archive");
    const dailyLogs: Array<Record<string, unknown>> = archive.data.dailyLogs;
    expect(Array.isArray(dailyLogs)).toBe(true);
    expect(dailyLogs).toHaveLength(1);
    expect(dailyLogs[0]).toMatchObject({ overall: "no_change", source_type: "patient_reported" });
  });

  test("an export re-imports as merge, and the danger zone wipes everything after double confirm", async ({ page }) => {
    test.setTimeout(120_000); // export, wipe, reload, import, merge, reload
    const errors = collectErrors(page);
    await asReturningUser(page);
    await page.getByRole("button", { name: /nothing different today/i }).click();
    await todaySaved(page);
    await page.goto("/#/settings");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /export everything/i }).click();
    const file = await download;
    const path = await file.path();
    expect(path).toBeTruthy();
    const bytes = fs.readFileSync(path!);
    expect(JSON.parse(bytes.toString("utf8")).data.dailyLogs).toHaveLength(1);
    await expect(page.getByRole("status")).toContainText("Export downloaded");

    // Arming deletion must not wipe anything before the second confirmation.
    await page.getByRole("button", { name: /delete all records permanently/i }).click();
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Delete absolutely everything on this device?", exact: true }).click();
    await expect(page.getByRole("button", { name: /skip setup/i })).toBeVisible();
    await page.getByRole("button", { name: /skip setup/i }).click();
    await settingsSaved(page, { onboarded: true });

    await page.goto("/#/timeline");
    await page.getByRole("button", { name: "Everything" }).click();
    await page.getByRole("button", { name: "All time" }).click();
    await expect(page.getByText("Nothing on the timeline for this view.", { exact: true })).toBeVisible();

    // The empty record says so; then import the archive back.
    await page.goto("/#/settings");
    await expect(page.getByText("This record has never been exported. It holds 0 records.", { exact: true })).toBeVisible();
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "afterlight-export.json", mimeType: "application/json", buffer: bytes,
    });
    // The import preview modal must appear and offer the merge — a silent read is a defect.
    const merge = page.getByRole("button", { name: /merge into my record/i });
    await expect(merge).toBeVisible();
    const reloaded = page.waitForEvent("load");
    await merge.click();
    await expect(page.getByRole("status")).toContainText("Import complete — 1 added");
    await reloaded;
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await page.goto("/#/timeline");
    await page.getByRole("button", { name: "Everything" }).click();
    await page.getByRole("button", { name: "All time" }).click();
    await expect(page.getByText(/no change today/i).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the changelog toggle opens the patient-facing changes", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/settings");
    await page.getByRole("button", { name: /what changed/i }).click();
    await expect(page.getByText(/version/i).first()).toBeVisible();
  });
});
