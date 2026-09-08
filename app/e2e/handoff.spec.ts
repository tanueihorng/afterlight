import { expect, test, type Page } from "@playwright/test";

/**
 * The clinician handoff, end to end in a real browser.
 *
 * The pieces this covers cannot be reached from a unit test: a PDF is produced by a canvas and a
 * download, a QR code is an SVG the browser has to lay out, and the print stylesheet only exists
 * under print emulation. Each of these has already been wrong once in a way that looked fine in
 * the code — a drawing that flattened to a black square, a card that trimmed off the new symptom.
 */
async function openBrief(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /skip setup/i }).click();
  await page.goto("/#/settings");
  await page.getByRole("button", { name: /load demo data/i }).click();
  await expect(page.getByRole("button", { name: /remove demo data/i })).toBeVisible({
    timeout: 15_000,
  });
  await page.goto("/#/appointments");
  await page.getByRole("button", { name: /prepare appointment brief/i }).click();
  await expect(page.getByText(/AFTERLIGHT — APPOINTMENT BRIEF/)).toBeVisible();
}

test.describe("the appointment brief leaves the device", () => {
  test("saves a real PDF with the drawings embedded", async ({ page }) => {
    await openBrief(page);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /save as pdf/i }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^afterlight-brief-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.pdf$/);

    const path = await file.path();
    const bytes = await (await import("node:fs/promises")).readFile(path);
    const text = bytes.toString("latin1");

    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    // The demo record has drawings, so the file must carry embedded images, not just text.
    expect(text).toContain("/Filter /DCTDecode");
    // Every page says what the document is.
    expect(text).toContain("Patient-generated record");
    expect(text).toContain("not a clinical record");
    // Bundled base-14 fonts: nothing is fetched to render this.
    expect(text).toContain("/BaseFont /Helvetica");
    expect(text).not.toMatch(/https?:\/\//);
  });

  test("the same brief produces the same bytes twice", async ({ page }) => {
    await openBrief(page);
    const read = async () => {
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: /save as pdf/i }).click();
      const file = await download;
      return (await import("node:fs/promises")).readFile(await file.path());
    };
    const first = await read();
    const second = await read();
    // "Has the brief changed?" is answerable by comparing two files, which needs this to hold.
    expect(Buffer.compare(first, second)).toBe(0);
  });

  test("the drawings are not printed as black squares", async ({ page }) => {
    await openBrief(page);
    // The white ground has to go on behind the marks. JPEG has no alpha, so a canvas that is
    // still transparent where nothing was drawn flattens to solid black — which is what the first
    // printed brief did to two of the patient's drawings.
    const hasFigure = await page.evaluate(
      () => !!document.querySelector<HTMLImageElement>(".print-doc figure img"),
    );
    expect(hasFigure).toBe(true);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /save as pdf/i }).click();
    const file = await download;
    const bytes = await (await import("node:fs/promises")).readFile(await file.path());
    // A flat black square compresses to almost nothing; a drawing on a white ground does not.
    const lengths = bytes
      .toString("latin1")
      .match(/\/Filter \/DCTDecode \/Length (\d+)/g)!
      .map((m) => Number(m.match(/(\d+)$/)![1]));
    for (const length of lengths) expect(length).toBeGreaterThan(2000);
  });
});

test.describe("sharing part of the record", () => {
  test("defaults narrow, states what is left out, and encrypts", async ({ page }) => {
    await openBrief(page);
    await page.getByRole("button", { name: /^share…$/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/exactly what this file will contain/i)).toBeVisible();
    await expect(dialog.getByText(/and what it will not/i)).toBeVisible();

    // Nothing that identifies a clinic goes out unless it is chosen.
    await expect(dialog.getByLabel("Imaging records", { exact: true })).not.toBeChecked();
    await expect(dialog.getByLabel("Documents", { exact: true })).not.toBeChecked();
    await expect(dialog.getByLabel("Diagnoses", { exact: true })).not.toBeChecked();
    await expect(dialog.getByLabel("Symptom entries", { exact: true })).toBeChecked();
    // The bulk and the most identifying part: originals stay behind unless asked for.
    await expect(dialog.getByLabel(/^Original scans and documents/)).not.toBeChecked();

    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: /save encrypted file/i }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.afterlight$/);

    const contents = await (await import("node:fs/promises")).readFile(await file.path(), "utf8");
    const sealed = JSON.parse(contents);
    expect(sealed.encrypted).toBe(true);
    expect(sealed.encryption.iterations).toBe(250_000);
    // No plaintext survives into the file.
    expect(contents).not.toMatch(/floaters/i);
    expect(contents).not.toMatch(/retina/i);
  });

  test("the QR card scans as text and says it is not encrypted", async ({ page }) => {
    await openBrief(page);
    await page.getByRole("button", { name: /^share…$/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: /show a code in the room/i }).click();

    await expect(dialog.getByText(/not encrypted/i)).toBeVisible();
    const qr = dialog.getByRole("img");
    await expect(qr).toBeVisible();

    // The code's content is available to someone who cannot point a camera at it.
    const label = await qr.getAttribute("aria-label");
    expect(label).toContain("AFTERLIGHT");
    expect(label).toContain("Not a clinical record");
  });
});

test.describe("present mode", () => {
  test("pages by keyboard, in high contrast, one section at a time", async ({ page }) => {
    await openBrief(page);
    await page.getByRole("button", { name: /present fullscreen/i }).click();

    const view = page.getByRole("dialog", { name: /presentation view/i });
    await expect(view).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "hc-light");
    await expect(view.getByRole("heading", { name: /right eye \(od\)/i })).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(view.getByRole("heading", { name: /left eye \(os\)/i })).toBeVisible();

    await page.keyboard.press("ArrowLeft");
    await expect(view.getByRole("heading", { name: /right eye \(od\)/i })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(view).toBeHidden();
    // The person's own theme comes back; presenting is not a settings change.
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", "hc-light");
  });
});

test.describe("print", () => {
  test("hides the app and keeps provenance as text", async ({ page }) => {
    await openBrief(page);
    await page.emulateMedia({ media: "print" });

    await expect(page.locator(".sidebar")).toBeHidden();
    await expect(page.locator(".no-print").first()).toBeHidden();
    // The footer is chrome on screen and content on paper.
    await expect(page.locator(".print-footer")).toBeVisible();

    // Badges are colour chips on screen and bracketed words on paper.
    const badge = page.locator(".print-doc .badge").first();
    const bracket = await badge.evaluate(
      (el) => getComputedStyle(el, "::before").content + getComputedStyle(el, "::after").content,
    );
    expect(bracket).toContain("[");
    expect(bracket).toContain("]");

    await page.emulateMedia({ media: "screen" });
  });
});

test.describe("bringing clinic paperwork in", () => {
  test("reads several files at once and refuses to guess an ambiguous date", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /skip setup/i }).click();
    await page.goto("/#/imaging");
    await page.getByRole("button", { name: /add files/i }).click();

    await page.locator(".dropzone input[type=file]").setInputFiles([
      {
        name: "Clinic letter 04-09-2026 Moorfields.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n1 0 obj << /Type /Pages /Count 2 >> endobj\n%%EOF\n"),
      },
      {
        name: "fundus_2026-09-06_OD.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      },
    ]);

    const rows = page.locator(".ingest-row");
    await expect(rows).toHaveCount(2);

    // 04-09-2026 is two different dates depending on where you are. It is offered, never chosen.
    await expect(page.getByText(/could be 2026-09-04 or 2026-04-09/)).toBeVisible();
    await expect(page.getByText(/will not choose for you/i)).toBeVisible();

    // The unambiguous one is read, and says where it came from.
    await expect(page.getByText(/date read from the filename: 2026-09-06/i)).toBeVisible();
    await expect(page.getByText(/a wrong eye is not recoverable later/i)).toBeVisible();

    // Nothing is confirmed until a person says so.
    await expect(page.getByText(/2 of 2 still unchecked/)).toBeVisible();
    await expect(page.getByText(/stay out of your appointment brief/i)).toBeVisible();
  });
});
