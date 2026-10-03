import { expect, test, type Page } from "@playwright/test";

/**
 * Shared helpers for the independent verification suite.
 *
 * This suite is written from the user's side of the glass: it drives what a person can see and
 * reach. Its one deliberate reach past the screen is `settingsSaved`, which polls IndexedDB as
 * a save oracle where the settings screen updates optimistically.
 */

/** Skip onboarding the way a returning user's stored record would. */
export async function asReturningUser(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /skip setup/i }).click();
  await expect(page.getByRole("heading", { name: /how is your vision today/i })).toBeVisible();
  await settingsSaved(page, { onboarded: true });
}

// Settings have no committed-save banner, so reload checks wait for a separate stored read.
export async function settingsSaved(page: Page, expected: Record<string, unknown>) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<Record<string, unknown>>((resolve, reject) => {
            const request = indexedDB.open("afterlight");
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error("Settings database open blocked"));
            request.onsuccess = () => {
              const db = request.result;
              try {
                const transaction = db.transaction("meta");
                const read = transaction.objectStore("meta").get("meta");
                transaction.oncomplete = () => {
                  db.close();
                  resolve(read.result ?? {});
                };
                transaction.onabort = () => {
                  db.close();
                  reject(transaction.error ?? new Error("Settings read aborted"));
                };
                transaction.onerror = () => {
                  db.close();
                  reject(transaction.error ?? new Error("Settings read failed"));
                };
              } catch (error) {
                db.close();
                reject(error);
              }
            };
          }),
      ),
    )
    .toMatchObject(expected);
}

// Only the post-commit confirmation includes the timeline action; the stored-day note does not.
export async function todaySaved(page: Page) {
  const confirmation = page.getByRole("status").filter({
    has: page.getByRole("button", { name: "View timeline →", exact: true }),
  });
  await expect(confirmation).toHaveText(/^✓\s*Today is recorded\.\s*View timeline →$/);
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

/** Open the search palette on either shell — desktop keeps it in the sidebar, phone in More. */
export async function openSearch(page: Page) {
  const sidebar = page.getByRole("button", { name: /search my records/i });
  if (await sidebar.isVisible().catch(() => false)) {
    await sidebar.click();
    return;
  }
  await page.getByRole("button", { name: /^more/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: /search my records/i }).click();
}

/** Open the ask palette on either shell. */
export async function openAsk(page: Page) {
  const sidebar = page.getByRole("button", { name: /ask my records/i });
  if (await sidebar.isVisible().catch(() => false)) {
    await sidebar.click();
    return;
  }
  await page.getByRole("button", { name: /^more/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: /ask my records/i }).click();
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
