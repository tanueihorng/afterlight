import { expect, test } from "@playwright/test";

test.describe("on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "layout checks are for the mobile project");

  test("puts the primary destinations in the thumb zone", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();

    const tabbar = page.getByRole("navigation", { name: "Main" });
    await expect(tabbar).toBeVisible();

    const viewport = page.viewportSize()!;
    const box = await tabbar.boundingBox();
    // Anchored to the bottom of the screen, not floating in the middle of it.
    expect(box!.y + box!.height).toBeGreaterThan(viewport.height - 60);

    for (const label of ["Today", "What I See", "Timeline", "Appointments"]) {
      await expect(tabbar.getByRole("button", { name: label })).toBeVisible();
    }
  });

  test("reaches the rest of the app through More", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();

    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: /more/i }).click();
    const sheet = page.getByRole("dialog", { name: /go to/i });
    await expect(sheet).toBeVisible();

    await sheet.getByRole("button", { name: /settings/i }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  test("never scrolls sideways, on any page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();

    for (const route of ["today", "what-i-see", "timeline", "my-eyes", "imaging", "appointments", "settings"]) {
      await page.goto(`/#/${route}`);
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${route} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });

  test("keeps the daily entry to a handful of taps", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();

    await page.getByRole("button", { name: /something changed/i }).click();
    await page.getByRole("button", { name: /add symptom/i }).first().click();
    await page.getByLabel(/symptom type/i).first().selectOption("floaters");
    await page
      .getByRole("group", { name: /compared with your usual/i })
      .first()
      .getByRole("radio", { name: /much more/i })
      .check();
    await page.getByRole("button", { name: /save today's record/i }).click();

    await expect(page.getByText(/today is recorded/i)).toBeVisible();
  });
});
