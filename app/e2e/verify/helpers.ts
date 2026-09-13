import { expect, test, type Page } from "@playwright/test";

/**
 * Shared helpers for the independent verification suite.
 *
 * This suite is written from the user's side of the glass: it uses what a person can see and
 * reach, never the store or the data model, so that it stays an independent check on what the
 * app actually does rather than a restatement of how the code intends to behave.
 */

/** Skip onboarding the way a returning user's stored record would. */
export async function asReturningUser(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /skip setup/i }).click();
  await expect(page.getByRole("heading", { name: /how is your vision today/i })).toBeVisible();
}

/** Seed the clinically coherent demo dataset from Settings, and wait for it to be live. */
export async function loadDemo(page: Page) {
  await page.goto("/#/settings");
  await page.getByRole("button", { name: /load demo data/i }).click();
  await expect(page.getByRole("button", { name: /remove demo data/i })).toBeVisible({
    timeout: 20_000,
  });
}

export async function openRoute(page: Page, route: string) {
  await page.goto(`/#/${route}`);
  await page.waitForTimeout(400);
}

/**
 * Collect every page error and console error. A page that logs errors is broken even when it
 * looks fine; the sweep and the flow specs both assert this stays empty.
 */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 300)}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  return errors;
}

export { expect, test };
