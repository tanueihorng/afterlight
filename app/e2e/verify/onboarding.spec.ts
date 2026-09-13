import { expect, test, collectErrors } from "./helpers";

test.describe("onboarding", () => {
  test("skip setup writes no records and lands on Today", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();
    await expect(page.getByRole("heading", { name: /how is your vision today/i })).toBeVisible();
    expect(errors).toEqual([]);

    // Reload must not show onboarding again.
    await page.reload();
    await expect(page.getByRole("heading", { name: /how is your vision today/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("the full path records surgery, diagnosis and both baselines", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");
    await page.getByRole("button", { name: /begin/i }).click();

    await page.getByRole("radio", { name: /i've had eye surgery/i }).check();
    await page.getByLabel(/which eye/i).selectOption("left");
    await page.getByLabel(/approximate date/i).fill("2023-06-01");
    await page.getByLabel(/procedure/i).fill("Onboarding vitrectomy");
    await page.getByLabel(/known diagnosis/i).fill("Onboarding floaters");
    await page.getByRole("button", { name: /continue/i }).click();

    await page
      .getByLabel(/right eye/i)
      .fill("Baseline right from onboarding");
    await page.getByLabel(/left eye/i).fill("Baseline left from onboarding");
    await page.getByRole("button", { name: /continue/i }).click();

    await page.getByRole("button", { name: /continue/i }).click();
    await page.getByRole("button", { name: /open afterlight/i }).click();

    await expect(page.getByRole("heading", { name: /how is your vision today/i })).toBeVisible();

    // What onboarding wrote must be visible in the record it belongs to.
    await page.goto("/#/my-eyes");
    await page.waitForTimeout(500);
    const body = await page.locator("main").innerText();
    expect(body).toContain("Baseline right from onboarding");
    expect(body).toContain("Baseline left from onboarding");
    expect(body).toContain("Onboarding floaters");
    await page.goto("/#/timeline");
    await page.getByRole("button", { name: "All time" }).click();
    await expect(page.getByText("Onboarding vitrectomy").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("Back keeps entries", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /begin/i }).click();
    await page.getByLabel(/known diagnosis/i).fill("Back keeps this");
    await page.getByRole("button", { name: /back/i }).click();
    await page.getByRole("button", { name: /begin/i }).click();
    await expect(page.getByLabel(/known diagnosis/i)).toHaveValue(/Back keeps this/);
  });
});
