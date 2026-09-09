import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const VERSION = readFileSync("src/lib/changelog.ts", "utf8").match(
  /export const VERSION = "([^"]+)"/,
)![1];

test.describe("what a first-time visitor gets", () => {
  test("reaches a recorded day without reading anything", async ({ page }) => {
    // The acceptance criterion is sixty seconds for someone who has never seen it. A wall-clock
    // assertion would be flaky on CI, so this measures the thing that actually costs the time:
    // how many decisions stand between opening the app and having recorded a day.
    const started = Date.now();
    await page.goto("/");

    await page.getByRole("button", { name: /skip setup/i }).click();
    await expect(page.getByRole("heading", { name: /how is your vision today/i })).toBeVisible();
    await page.getByRole("button", { name: /nothing different today/i }).click();
    await expect(page.getByText(/today is recorded/i)).toBeVisible();

    // Two taps from a cold open. Anything more and the daily habit does not survive a bad week.
    expect(Date.now() - started).toBeLessThan(30_000);
  });

  test("says plainly that the clinical wording is unreviewed", async ({ page }) => {
    await page.goto("/#/settings");
    await page.getByRole("button", { name: /skip setup/i }).click();
    await page.goto("/#/settings");

    const about = page.getByText(/about afterlight/i).first();
    await expect(about).toBeVisible();
    await expect(
      page.getByText(/has not yet been reviewed by an ophthalmologist or optometrist/i),
    ).toBeVisible();
  });

  test("shows the version and what changed", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();
    await page.goto("/#/settings");

    await expect(page.getByText(VERSION, { exact: false }).first()).toBeVisible();

    await page.getByRole("button", { name: /^what changed$/i }).click();
    // Written for a patient, not a commit log.
    await expect(page.getByText(/Save the brief as a real PDF/i)).toBeVisible();
    await expect(
      page.getByText(/no streaks, no reminders that make you feel guilty/i),
    ).toBeVisible();
  });

  test("offers a route to the guide, the backup page and the boundaries", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();
    await page.goto("/#/settings");

    for (const name of [/user guide/i, /keeping it safe/i, /what it will not do/i]) {
      const link = page.getByRole("link", { name }).last();
      await expect(link).toBeVisible();
      // Links out, never a request the app makes on its own.
      expect(await link.getAttribute("href")).toMatch(/^https:\/\/github\.com\//);
      expect(await link.getAttribute("rel")).toContain("noreferrer");
    }
  });
});

test.describe("the backup story is told before it is needed", () => {
  test("first run explains what deletes a record and what saves it", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^begin$/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();

    await expect(page.getByRole("heading", { name: /one thing to know now/i })).toBeVisible();
    await expect(page.getByText(/clearing your browser data deletes it/i)).toBeVisible();
    await expect(page.getByText(/Settings → Export everything/i)).toBeVisible();
  });

  test("settings points at the page that explains how", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();
    await page.goto("/#/settings");

    await expect(page.getByText(/most common way people lose years of entries/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /keeping it safe/i }).first()).toBeVisible();
  });
});
