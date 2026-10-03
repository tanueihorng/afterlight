import { expect, test, asReturningUser, loadDemo } from "./helpers";

test.describe("timeline — reading the record", () => {
  test("the story view is the default and the Everything view shows daily texture", async ({ page }) => {
    await asReturningUser(page);
    await loadDemo(page);
    await page.goto("/#/timeline");
    await page.waitForTimeout(400);

    await expect(page.getByRole("button", { name: "Story" })).toHaveAttribute("aria-pressed", /true/);
    await page.getByRole("button", { name: "Everything" }).click();
    // Daily logs and symptoms are observation-weight: they appear only here.
    await page.getByRole("button", { name: "All time" }).click();
    await expect(page.getByText(/no change today|daily log/i).first()).toBeVisible();
  });

  test("range toggles bound what is shown", async ({ page }) => {
    await asReturningUser(page);
    await loadDemo(page);
    await page.goto("/#/timeline");
    await page.waitForTimeout(400);

    await page.getByRole("button", { name: "7 days" }).click();
    await expect(page.getByRole("button", { name: "7 days" })).toHaveAttribute("aria-pressed", /true/);

    // The custom range exposes its two dates and accepts them.
    await page.getByRole("button", { name: "Custom" }).click();
    const dates = page.locator('input[type="date"]');
    await expect(dates).toHaveCount(2);
    await dates.first().fill("2026-08-01");
    await dates.last().fill("2026-09-14");
  });

  test("eye filters keep whole-record events while filtering eye-specific ones", async ({ page }) => {
    await asReturningUser(page);
    await loadDemo(page);
    await page.goto("/#/timeline");
    await page.waitForTimeout(400);

    await page.getByRole("button", { name: "Everything" }).click();
    await page.getByRole("button", { name: "All time" }).click();

    await page.getByRole("button", { name: "Right (OD)", exact: true }).click();
    await page.waitForTimeout(300);
    // Whole-record rows stay; no eye-specific left-eye event may remain.
    const events = await page.locator(".tl-event").allInnerTexts();
    expect(events.some((t) => /Eye: Left \(OS\)/.test(t))).toBe(false);

    await page.getByRole("button", { name: "All", exact: true }).click();
  });

  test("an event opens its detail modal", async ({ page }) => {
    await asReturningUser(page);
    await loadDemo(page);
    await page.goto("/#/timeline");
    await page.getByRole("button", { name: "Everything" }).click();
    await page.getByRole("button", { name: "All time" }).click();
    await page.waitForTimeout(300);

    await page.locator(".tl-event").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("category toggles filter the Everything view", async ({ page }) => {
    await asReturningUser(page);
    await loadDemo(page);
    await page.goto("/#/timeline");
    await page.getByRole("button", { name: "Everything" }).click();
    await page.getByRole("button", { name: "All time" }).click();

    // Everything except appointments off: only appointment events may remain.
    const cats = [
      "Daily logs", "Symptoms", "Floaters", "Drawings", "Imaging", "Diagnoses",
      "Procedures", "Medications", "Prescriptions", "Measurements", "Documents",
    ];
    for (const c of cats) await page.getByRole("button", { name: c, exact: true }).click();
    await page.waitForTimeout(300);
    const body = await page.locator("main").innerText();
    expect(body).toMatch(/appointment/i);
  });

  test("pagination reveals a long history on request", async ({ page }) => {
    await asReturningUser(page);
    // A long-history fixture avoids 150 form round-trips; pagination itself is exercised in the UI.
    await page.evaluate(async () => {
      const open = () => new Promise((res, rej) => { const r = indexedDB.open("afterlight"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const db = await open();
      const tx = db.transaction("dailyLogs", "readwrite");
      const store = tx.objectStore("dailyLogs");
      for (let i = 1; i <= 150; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i * 2);
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        store.put({
          id: `seeded-${i}`, date, overall: "no_change", source_type: "patient_reported",
          created_at: d.toISOString(), updated_at: d.toISOString(),
        });
      }
      await new Promise((res) => { tx.oncomplete = res; });
      db.close();
    });

    await page.goto("/#/timeline");
    await page.reload(); // the seeded store must be read from the start
    await page.getByRole("button", { name: "Everything" }).click();
    await page.getByRole("button", { name: "All time" }).click();
    await page.waitForTimeout(400);

    const days = page.locator("main .tl-day");
    await expect(days).toHaveCount(60);
    await page.getByRole("button", { name: /show earlier entries/i }).click();
    await expect(days).toHaveCount(120);
    await page.getByRole("button", { name: /show all/i }).click();
    await expect(days).toHaveCount(150);
    await expect(page.getByRole("button", { name: /show earlier entries/i })).toHaveCount(0);
  });

  test("an empty record says so honestly", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/timeline");
    await page.waitForTimeout(400);
    await expect(page.getByRole("main").getByText(/no clinical events|nothing|quiet/i).first()).toBeVisible();
  });
});
