import { expect, test, asReturningUser, collectErrors } from "./helpers";

/**
 * The Timeline "+ Add event" chooser, every one of its seven kinds, end to end.
 *
 * This is where the recorded inline-add store defect lived (docs/plan/PHASE-16-HANDOFF.md).
 * The defect did not reproduce under verification — the chooser, the inline modals, persistence
 * and the range widening all work — so this file now exists to keep it that way. Each kind is
 * verified for what happens the moment it is chosen, what lands on the timeline, and that the
 * record survives a reload with the range widened to All time.
 */

test.describe("timeline add-event chooser", () => {
  test("daily log or symptom hands over to Today's recording form", async ({ page }) => {
    const errors = collectErrors(page);
    await asReturningUser(page);
    await page.goto("/#/timeline");
    await page.getByRole("button", { name: "+ Add event" }).click();

    await page.getByRole("dialog").getByRole("button", { name: /daily log or symptom/i }).click();

    await expect(page).toHaveURL(/#\/today/);
    // The hand-over must land in the recording form directly, not the decision view.
    await expect(page.getByRole("button", { name: /save today's record/i })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("drawing of what you see opens the drawing page", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/timeline");
    await page.getByRole("button", { name: "+ Add event" }).click();

    await page.getByRole("dialog").getByRole("button", { name: /drawing of what you see/i }).click();

    await expect(page).toHaveURL(/#\/what-i-see/);
    await expect(page.getByRole("button", { name: /pen/i }).first()).toBeVisible();
  });

  for (const kind of [
    { chooser: /diagnosis/i, save: /save diagnosis/i, fill: "Chosen on the timeline dx", marker: "Chosen on the timeline dx" },
    { chooser: /procedure or surgery/i, save: /save procedure/i, fill: "Chosen on the timeline procedure", marker: "Chosen on the timeline procedure" },
    { chooser: /^medication/i, save: /save medication/i, fill: "Chosen on the timeline medication", marker: "Chosen on the timeline medication" },
  ]) {
    test(`${kind.chooser.source.replace(/[^a-z]/g, "")}: the inline modal saves, shows the event, and it survives a reload`, async ({ page }) => {
      const errors = collectErrors(page);
      await asReturningUser(page);
      await page.goto("/#/timeline");
      await page.getByRole("button", { name: "+ Add event" }).click();
      await page.getByRole("dialog").getByRole("button", { name: kind.chooser }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      const dialog = page.getByRole("dialog");
      const firstTextbox = dialog.getByRole("textbox").first();
      await firstTextbox.fill(kind.fill);
      await dialog.getByRole("button", { name: kind.save }).click();

      // The chooser widens the range to All time so the saved event is on screen at once.
      await expect(page.getByText(kind.marker).first()).toBeVisible();
      // The modal closes only after the awaited put() has committed; from that moment a
      // reload must show the record.
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(errors).toEqual([]);

      await page.reload();
      await page.getByRole("button", { name: "All time" }).click();
      await expect(page.getByText(kind.marker).first()).toBeVisible({ timeout: 10_000 });
    });
  }

  test("imaging or scan routes to My Eyes", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/timeline");
    await page.getByRole("button", { name: "+ Add event" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /imaging or scan/i }).click();
    await expect(page).toHaveURL(/#\/my-eyes/);
    await expect(
      page.getByRole("region", { name: "Right Eye (OD)" }).getByRole("button", { name: "+ Diagnosis" }),
    ).toBeVisible();
  });

  test("appointment routes to Appointments", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/timeline");
    await page.getByRole("button", { name: "+ Add event" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^appointment/i }).click();
    await expect(page).toHaveURL(/#\/appointments/);
    await expect(page.getByRole("button", { name: /add appointment/i })).toBeVisible();
  });

  test("every chooser kind actually opens or routes — none silently does nothing", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/timeline");

    const kinds = [
      /daily log or symptom/i,
      /drawing of what you see/i,
      /imaging or scan/i,
      /^appointment/i,
    ];
    for (const kind of kinds) {
      await page.getByRole("button", { name: "+ Add event" }).click();
      await page.getByRole("dialog").getByRole("button", { name: kind }).click();
      await expect(page).not.toHaveURL(/#\/timeline/);
      await page.goto("/#/timeline");
    }

    // The three inline kinds must open a dialog on the page itself.
    for (const kind of [/diagnosis/i, /procedure or surgery/i, /^medication/i]) {
      await page.getByRole("button", { name: "+ Add event" }).click();
      await page.getByRole("dialog").getByRole("button", { name: kind }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("dialog").getByRole("button", { name: /cancel/i }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  });
});
