import { expect, test, type Page } from "@playwright/test";
import { asReturningUser, loadDemo, collectErrors } from "./helpers";

/**
 * L1 sweep — every interactive element on every route gets exercised.
 *
 * Nothing is assumed about what a control is for: the contract is only that clicking it must
 * never crash the page, log an error, or leave the app unusable. What each control is *for* is
 * verified in the per-page specs. Data-wiping controls are safe here because the visible
 * destructive actions are two-click confirms — the sweep's single click can only arm them, and
 * each iteration reloads the route before touching the next control.
 *
 * Runs on the desktop project; the phone shell (tabbar, More sheet) has its own sweep below.
 */

const ROUTES = [
  "today",
  "what-i-see",
  "timeline",
  "my-eyes",
  "self-tests",
  "imaging",
  "appointments",
  "visualize",
  "settings",
] as const;

const INTERACTIVE = 'button:visible, a[href]:visible, [role="tab"]:visible, summary:visible';

/** Close whatever the click may have opened, so the next iteration starts clean. */
async function closeStrayLayer(page: Page) {
  if (await page.getByRole("dialog").first().isVisible().catch(() => false)) {
    const close = page.getByRole("dialog").getByRole("button", { name: /^(close|cancel|✕)$/i }).first();
    if (await close.isVisible().catch(() => false)) await close.click();
    else await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 3_000 });
  }
}

for (const route of ROUTES) {
  test(`sweep ${route}: every control clicks without breaking anything`, async ({ page }) => {
    test.setTimeout(15 * 60_000); // a full sweep of a page with hundreds of clicks
    const errors = collectErrors(page);
    page.on("download", (d) => d.cancel().catch(() => {}));
    await asReturningUser(page);
    await loadDemo(page);

    await page.goto(`/#/${route}`);
    await page.waitForTimeout(500);
    const total = await page.locator(INTERACTIVE).count();
    expect(total, `${route} exposes no interactive elements`).toBeGreaterThan(3);

    for (let i = 0; i < total; i++) {
      await page.goto(`/#/${route}`);
      await page.waitForTimeout(350);
      const el = page.locator(INTERACTIVE).nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      try {
        await el.click({ timeout: 2_000 });
      } catch {
        continue; // detached or obscured by a transient animation — the per-page specs judge it
      }
      await page.waitForTimeout(200);
      await closeStrayLayer(page);
      // The app must still be alive and navigable after the click.
      await expect(page.getByRole("main")).toBeVisible({ timeout: 3_000 });
    }

    // V-104: WebKit logs repeated texImage3D errors from the 3D-texture path on the mobile
    // project; recorded as a renderer follow-up, not swept as a page defect.
    const webkit3dNoise = (e: string) => test.info().project.name === "mobile" && e.includes("texImage3D");
    expect(errors.filter((e) => !webkit3dNoise(e)), `${route}: interactions logged errors`).toEqual([]);
  });
}

test.describe("sweep of the phone shell", () => {
  test.skip(({ isMobile }) => !isMobile, "layout checks are for the mobile project");

  test("tabbar routes and the More sheet opens every remaining destination", async ({ page }) => {
    const errors = collectErrors(page);
    await asReturningUser(page);

    for (const tab of ["Timeline", "Appointments"]) {
      await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: tab }).click();
      await expect(page.getByRole("main")).toBeVisible();
    }

    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: /more/i }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    for (const name of ["My Eyes", "Checks", "Imaging & Documents", "Visualize", "Settings", "Search my records", "Ask my records"]) {
      await expect(sheet.getByRole("button", { name })).toBeVisible();
    }
    await sheet.getByRole("button", { name: "Visualize" }).click();
    await expect(page).toHaveURL(/#\/visualize/);
    expect(errors).toEqual([]);
  });
});
