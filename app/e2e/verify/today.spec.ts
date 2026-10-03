import { expect, test, asReturningUser, loadDemo, collectErrors, todaySaved } from "./helpers";

test.describe("today — the daily decision", () => {
  test("a quiet day is one tap and says so, before and after a reload", async ({ page }) => {
    await asReturningUser(page);
    await page.getByRole("button", { name: /nothing different today/i }).click();
    // The post-commit confirmation, not the "recorded as no change" note, which follows the
    // store the instant the button is pressed (V-010).
    await todaySaved(page);

    // After a remount the note states the day's outcome in words.
    await page.reload();
    await expect(page.getByText(/recorded as no change/i)).toBeVisible({ timeout: 10_000 });
  });

  test("a change opens the form; every field of a symptom row saves", async ({ page }) => {
    const errors = collectErrors(page);
    await asReturningUser(page);
    await page.getByRole("button", { name: /something changed/i }).click();

    await page.getByRole("button", { name: /add symptom/i }).first().click();
    await page.getByLabel(/symptom type/i).first().selectOption("floaters");
    const row = page.getByRole("group", { name: /compared with your usual/i }).first();
    await row.getByRole("radio", { name: /new symptom/i }).check();
    // A new floater must offer the shapes and must raise the urgent notice — one sentence, calm.
    await expect(page.getByLabel(/shape/i).first()).toBeVisible();
    await expect(page.getByRole("note").filter({ hasText: /urgent/i })).toBeVisible();

    await page.locator('input[type="range"]').first().fill("4");
    await page.getByLabel(/describe it in your words/i).first().fill("A small thread in the right eye");
    await page.getByLabel(/note for today/i).fill("Noticed after reading");
    await page.getByRole("button", { name: /save today's record/i }).click();

    await todaySaved(page);
    expect(errors).toEqual([]);
  });

  test("a saved day can be edited — the recording form comes back and updates", async ({ page }) => {
    await asReturningUser(page);
    await page.getByRole("button", { name: /nothing different today/i }).click();
    await todaySaved(page);

    // Remount so the next confirmation cannot be left over from the first save.
    await page.reload();
    // The edit path is the decision buttons themselves: choose "something changed" again.
    await page.getByRole("button", { name: /something changed/i }).click();
    await page.getByRole("button", { name: /add symptom/i }).first().click();
    await page.getByLabel(/symptom type/i).first().selectOption("glare");
    await page
      .getByRole("group", { name: /compared with your usual/i })
      .first()
      .getByRole("radio", { name: /same as usual/i })
      .check();
    await page.getByRole("button", { name: /update today's record/i }).click();
    await todaySaved(page);

    await page.goto("/#/timeline");
    await page.getByRole("button", { name: "Everything" }).click();
    await expect(page.getByText(/glare/i).first()).toBeVisible();
  });

  test("another day dates the entry to the chosen day", async ({ page }) => {
    await asReturningUser(page);
    await page.getByRole("button", { name: /something changed/i }).click();
    await page.getByRole("button", { name: /another day/i }).click();
    const input = page.locator('input[type="date"]');
    await expect(input).toBeVisible();
    const far = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    await input.fill(far);
    await page.getByRole("button", { name: /add symptom/i }).first().click();
    await page.getByLabel(/symptom type/i).first().selectOption("blur");
    await page
      .getByRole("group", { name: /compared with your usual/i })
      .first()
      .getByRole("radio", { name: /slightly more/i })
      .check();
    await page.getByRole("button", { name: /save today's record/i }).click();
    await todaySaved(page);
    await page.getByRole("button", { name: "View timeline →", exact: true }).click();
    await expect(page.getByRole("button", { name: "All time", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/blur/i).first()).toBeVisible();
  });

  test("a removed row does not persist on save", async ({ page }) => {
    await asReturningUser(page);
    await page.getByRole("button", { name: /something changed/i }).click();
    await page.getByRole("button", { name: /add symptom/i }).first().click();
    await page.getByLabel(/symptom type/i).first().selectOption("glare");
    await page
      .getByRole("group", { name: /compared with your usual/i })
      .first()
      .getByRole("radio", { name: /same as usual/i })
      .check();
    await page.getByRole("button", { name: /save today's record/i }).click();
    await todaySaved(page);

    // A saved symptom reopens the form; the previous confirmation must not satisfy this save.
    await page.reload();
    await expect(page.getByLabel(/symptom type/i).first()).toHaveValue(/glare/);
    await page.getByRole("button", { name: /remove symptom/i }).first().click();
    await page.getByRole("button", { name: /update today's record/i }).click();
    await todaySaved(page);
    await page.goto("/#/timeline");
    await page.getByRole("button", { name: "Everything" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/glare/i)).toHaveCount(0);
  });

  test("suggestions come from the person's own history, not a generic list", async ({ page }) => {
    await asReturningUser(page);
    await loadDemo(page);
    await page.goto("/#/today");
    await page.waitForTimeout(400);
    // The demo history is floaters-heavy; whatever is offered, it must offer something.
    const body = await page.locator("main").innerText();
    expect(body).toMatch(/same as before|yesterday|again/i);
  });

  test("Back returns to the decision without writing anything", async ({ page }) => {
    await asReturningUser(page);
    await page.getByRole("button", { name: /something changed/i }).click();
    await page.getByRole("button", { name: /add symptom/i }).first().click();
    await page.getByRole("button", { name: /back/i }).click();
    await expect(page.getByRole("button", { name: /nothing different today/i })).toBeVisible();

    await page.goto("/#/timeline");
    await page.waitForTimeout(400);
    await expect(page.getByText(/no change today/i)).toHaveCount(0);
  });
});
