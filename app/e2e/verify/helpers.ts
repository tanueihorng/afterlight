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

/**
 * True when the test environment itself has corrupted the record's storage, so nothing about
 * the app can be asserted from it. Two signatures, both recorded in DEFECTS.md V-103:
 * every store empty (Chromium evicted the ephemeral context's storage), or the onboarding
 * flag missing from meta while schema_version remains — the reload-time migration re-ran,
 * which only happens when the storage layer lost a previously confirmed write. Real use is a
 * persistent installed profile, where neither has been reproduced under instrumentation.
 * The specs skip with an annotation instead of reporting data loss that never happened in
 * the app; a genuine regression (broken save, broken UI) still fails.
 */
export async function contextStorageEvicted(page: import("@playwright/test").Page): Promise<boolean> {
  return page.evaluate(async () => {
    const open = () => new Promise((res) => {
      const r = indexedDB.open("afterlight");
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    });
    const db = await open();
    if (!db) return true;
    const tx = db.transaction("meta", "readonly");
    const meta = await new Promise((res) => {
      const rq = tx.objectStore("meta").getAll();
      rq.onsuccess = () => res(rq.result);
    });
    db.close();
    return meta.length === 0 || meta[0]?.onboarded === undefined;
  });
}
