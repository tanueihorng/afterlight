import { expect, test } from "@playwright/test";

/** Skip onboarding the way a returning user's stored record would. */
async function asReturningUser(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /skip setup/i }).click();
  await expect(page.getByRole("heading", { name: /how is your vision today/i })).toBeVisible();
}

test.describe("the daily loop", () => {
  test("records a quiet day in one tap", async ({ page }) => {
    await asReturningUser(page);

    const noChange = page.getByRole("button", { name: /nothing different today/i });
    await expect(noChange).toBeVisible();

    // The target has to be comfortably large, especially on a phone.
    const box = await noChange.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await noChange.click();
    await expect(page.getByText(/today is recorded/i)).toBeVisible();
  });

  test("records a change, and it reaches the timeline", async ({ page }) => {
    await asReturningUser(page);

    await page.getByRole("button", { name: /something changed/i }).click();
    await page.getByRole("button", { name: /add symptom/i }).first().click();

    await page.getByLabel(/symptom type/i).first().selectOption("glare");
    await page
      .getByRole("group", { name: /compared with your usual/i })
      .first()
      .getByRole("radio", { name: /^new symptom$/i })
      .check();
    await page.getByRole("button", { name: /save today's record/i }).click();

    await page.goto("/#/timeline");
    await expect(page.getByText(/glare/i).first()).toBeVisible();
    await expect(page.getByText(/patient reported/i).first()).toBeVisible();
  });

  test("an entry can be dated to when it actually started", async ({ page }) => {
    await asReturningUser(page);

    await page.getByRole("button", { name: /something changed/i }).click();
    await page.getByRole("button", { name: /^yesterday$/i }).click();
    await expect(page.getByText(/will be recorded as/i)).toBeVisible();
  });
});

test.describe("the record survives a reload", () => {
  test("a saved day is still there after reloading", async ({ page }) => {
    await asReturningUser(page);
    await page.getByRole("button", { name: /nothing different today/i }).click();
    await expect(page.getByText(/today is recorded/i)).toBeVisible();

    await page.reload();
    await expect(page.getByText(/today is recorded as no change/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
