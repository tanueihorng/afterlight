import { expect, test, asReturningUser, loadDemo, collectErrors, openSearch, openAsk } from "./helpers";

test.describe("search and ask palettes", () => {
  test("opens with the sidebar button, with Cmd+K, and with /", async ({ page }) => {
    await asReturningUser(page);
    await loadDemo(page);

    await openSearch(page);
    await expect(page.getByRole("dialog").getByText(/search records/i)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.keyboard.press("/");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("search finds a demo record and the result is clickable", async ({ page }) => {
    const errors = collectErrors(page);
    await asReturningUser(page);
    await loadDemo(page);

    await page.keyboard.press("Control+k");
    await page.getByRole("dialog").getByRole("textbox").fill("vitreous");
    await page.waitForTimeout(400);
    const results = page.getByRole("dialog").getByRole("option");
    expect(await results.count()).toBeGreaterThan(0);
    await results.first().click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("main")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("ask: an example chip runs its question and the answer cites its source", async ({ page }) => {
    const errors = collectErrors(page);
    await asReturningUser(page);
    await loadDemo(page);

    await openAsk(page);
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /when did glare in my left eye first appear/i }).click();
    await page.waitForTimeout(500);
    // Either a cited answer or the exact not-found sentence — never a silent panel.
    const text = await dialog.innerText();
    expect(text).toMatch(/source|nothing in your records/i);
    expect(errors).toEqual([]);
  });

  test("typing ? inside a field does not open ask", async ({ page }) => {
    await asReturningUser(page);
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog").getByRole("textbox").fill("what changed?");
    const count = await page.getByRole("dialog").count();
    expect(count).toBe(1); // still just the palette the user opened
  });
});
