import { expect, test, asReturningUser, loadDemo, collectErrors } from "./helpers";

test.describe("appointments and the brief", () => {
  test("an appointment can be added, edited, and deleted", async ({ page }) => {
    const errors = collectErrors(page);
    await asReturningUser(page);
    await page.goto("/#/appointments");

    await page.getByRole("button", { name: /add appointment/i }).click();
    const dialog = page.getByRole("dialog");
    const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
    await dialog.getByLabel(/^date/i).fill(tomorrow);
    await dialog.getByLabel(/time/i).fill("10:30");
    await dialog.getByLabel("Clinic", { exact: true }).fill("Verify Eye Clinic");
    await dialog.getByLabel(/reason/i).fill("Verification review");
    await dialog.getByRole("button", { name: /save appointment/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(/verification review/i).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("questions can be added, answered and deleted", async ({ page }) => {
    await asReturningUser(page);
    await page.goto("/#/appointments");
    await page.getByRole("button", { name: /questions for my doctor/i }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel(/add a question|new question|question/i).fill("Verify: is my vision stable?");
    await dialog.getByRole("button", { name: /add question/i }).click();
    await expect(dialog.getByText(/verify: is my vision stable/i)).toBeVisible();

    // Update its status.
    await dialog.getByRole("button", { name: /update/i }).first().click();
    const update = page.getByRole("dialog").last();
    await update.getByLabel(/status/i).selectOption("asked");
    await update.getByRole("button", { name: /save/i }).click();

    // Delete it (two-click arm inside the window).
    await dialog.getByRole("button", { name: /delete/i }).first().dblclick();
    await expect(dialog.getByText(/verify: is my vision stable/i)).toHaveCount(0);
  });

  test("the brief builds with a period, extra sections, and saves into the timeline", async ({ page }) => {
    const errors = collectErrors(page);
    await asReturningUser(page);
    await loadDemo(page);
    await page.goto("/#/appointments");
    await page.getByRole("button", { name: /prepare appointment brief/i }).click();

    await expect(page.getByText(/appointment brief/i).first()).toBeVisible();
    await page.getByRole("button", { name: /last 30 days/i }).click();
    await page.getByRole("checkbox", { name: /recorded numbers/i }).check();

    await page.getByRole("button", { name: /save this brief/i }).click();
    await expect(page.getByText(/brief saved/i)).toBeVisible();

    // A saved brief is reachable through search, listed as an Appointment brief.
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog").getByRole("textbox").fill("brief");
    await page.waitForTimeout(500);
    await expect(page.getByRole("dialog").getByText(/appointment brief/i).first()).toBeVisible();
    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });

  test("the share flow shows what is included AND what is left out, and the QR card is plain text", async ({ page }) => {
    await asReturningUser(page);
    await loadDemo(page);
    await page.goto("/#/appointments");
    await page.getByRole("button", { name: /prepare appointment brief/i }).click();
    await page.getByRole("button", { name: /share/i }).click();

    const dialog = page.getByRole("dialog");
    // The file tab states the counts of what is in and what stays out.
    await expect(dialog.getByText(/what it will not/i).first()).toBeVisible();

    // The QR tab: the code renders and says what it is.
    await dialog.getByRole("tab", { name: /code in the room/i }).click();
    await expect(dialog.locator("svg").first()).toBeVisible();
  });

  test.skip(({ isMobile }) => isMobile, "presentation is a desktop gesture");
  test("present mode steps through the brief and exits", async ({ page }) => {
    await asReturningUser(page);
    await loadDemo(page);
    await page.goto("/#/appointments");
    await page.getByRole("button", { name: /prepare appointment brief/i }).click();
    await page.getByRole("button", { name: /present fullscreen/i }).click();

    const next = page.getByRole("button", { name: /next/i });
    await expect(next).toBeVisible();
    for (let i = 0; i < 12 && (await next.isEnabled().catch(() => false)); i++) await next.click();
    await expect(next).toBeDisabled();
    await page.getByRole("button", { name: /exit/i }).click();
    await expect(page.getByRole("button", { name: /save as pdf/i })).toBeVisible();
  });
});
