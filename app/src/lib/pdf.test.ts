import { describe, expect, it } from "vitest";
import {
  MARGIN,
  PAGE_DIMENSIONS,
  imageDpi,
  jpegSize,
  paginate,
  textWidth,
  toWinAnsi,
  wrapText,
  writePdf,
  type PdfDocument,
  type PdfImage,
} from "./pdf";

const base: PdfDocument = {
  title: "Appointment brief",
  footer: "Patient-generated record. Not a clinical record.",
  pageSize: "A4",
  generatedAt: "2026-09-08T09:00:00.000Z",
  blocks: [
    { kind: "heading", text: "AFTERLIGHT — APPOINTMENT BRIEF", level: 1 },
    { kind: "text", text: "Period 1 Sep 2026 – 8 Sep 2026" },
    { kind: "rule" },
    { kind: "bullet", text: "One new small dark dot, slightly right of centre." },
  ],
};

/** A minimal but structurally real JPEG: SOI, SOF0 carrying dimensions, EOI. */
function fakeJpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9,
  ]);
}

const decoder = new TextDecoder("latin1");

describe("PDF writer", () => {
  it("produces a file a reader will accept", () => {
    const text = decoder.decode(writePdf(base));
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/BaseFont /Helvetica");
    expect(text).toContain("startxref");
  });

  it("is byte-identical for the same document", () => {
    const a = writePdf(base);
    const b = writePdf(JSON.parse(JSON.stringify(base)) as PdfDocument);
    expect(a).toEqual(b);
  });

  it("changes bytes when the content changes", () => {
    const other: PdfDocument = {
      ...base,
      blocks: [...base.blocks, { kind: "text", text: "extra" }],
    };
    expect(writePdf(other)).not.toEqual(writePdf(base));
  });

  it("never reads the clock", () => {
    // The timestamp comes from the payload, so two runs an hour apart still agree.
    const text = decoder.decode(writePdf(base));
    expect(text).toContain("/CreationDate (D:20260908090000Z)");
  });

  it("declares the same page count as it writes", () => {
    const many: PdfDocument = {
      ...base,
      blocks: Array.from({ length: 400 }, (_, i): PdfDocument["blocks"][number] => ({
        kind: "text",
        text: `line ${i}`,
      })),
    };
    const pages = paginate(many);
    expect(pages.length).toBeGreaterThan(1);
    const text = decoder.decode(writePdf(many));
    expect(text).toContain(`/Count ${pages.length}`);
    expect(text).toContain(`Page ${pages.length} of ${pages.length}`);
  });

  it("keeps a two-column block whole rather than splitting an eye across pages", () => {
    const filler = Array.from({ length: 70 }, (_, i): PdfDocument["blocks"][number] => ({
      kind: "text",
      text: `filler ${i}`,
    }));
    const doc: PdfDocument = {
      ...base,
      blocks: [
        ...filler,
        {
          kind: "columns",
          left: [
            { kind: "heading", text: "RIGHT EYE (OD)", level: 2 },
            { kind: "bullet", text: "a" },
          ],
          right: [
            { kind: "heading", text: "LEFT EYE (OS)", level: 2 },
            { kind: "bullet", text: "b" },
          ],
        },
      ],
    };
    const pages = paginate(doc);
    const pageWith = (needle: string) =>
      pages.findIndex((p) => p.ops.some((o) => o.op.t === "text" && o.op.text === needle));
    expect(pageWith("RIGHT EYE (OD)")).toBe(pageWith("LEFT EYE (OS)"));
    expect(pageWith("RIGHT EYE (OD)")).toBeGreaterThanOrEqual(0);
  });

  it("wraps inside the text column and never past the right margin", () => {
    const width = PAGE_DIMENSIONS.A4.width - MARGIN.left - MARGIN.right;
    const long =
      "Floaters — usual strand and several small dots in the temporal field, unchanged since " +
      "the last appointment, most noticeable against a bright sky or a white wall.";
    for (const line of wrapText(long, width, 9.5)) {
      expect(textWidth(line, 9.5)).toBeLessThanOrEqual(width);
    }
  });

  it("breaks a word that cannot fit rather than overflowing", () => {
    const lines = wrapText("a".repeat(400), 100, 10);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(textWidth(line, 10)).toBeLessThanOrEqual(100);
  });

  it("keeps every page inside the printable area", () => {
    const doc: PdfDocument = {
      ...base,
      blocks: Array.from({ length: 200 }, (_, i): PdfDocument["blocks"][number] => ({
        kind: "text",
        text: `row ${i}`,
      })),
    };
    const usable = PAGE_DIMENSIONS.A4.height - MARGIN.top - MARGIN.bottom;
    for (const page of paginate(doc)) {
      for (const op of page.ops) expect(op.y).toBeLessThanOrEqual(usable + 1);
    }
  });

  it("prints on Letter as well as A4", () => {
    const letter = decoder.decode(writePdf({ ...base, pageSize: "Letter" }));
    expect(letter).toContain("/MediaBox [0 0 612 792]");
    const a4 = decoder.decode(writePdf(base));
    expect(a4).toContain("/MediaBox [0 0 595.28 841.89]");
  });

  it("embeds a JPEG untouched and references it from the page", () => {
    const image: PdfImage = { id: "d1", jpeg: fakeJpeg(600, 600), width: 600, height: 600 };
    const doc: PdfDocument = {
      ...base,
      images: [image],
      blocks: [{ kind: "figures", heightPt: 96, figures: [{ imageId: "d1", caption: "4 Sep OD" }] }],
    };
    const text = decoder.decode(writePdf(doc));
    expect(text).toContain("/Filter /DCTDecode");
    expect(text).toContain("/d1 Do");
    expect(text.includes(decoder.decode(image.jpeg))).toBe(true);
  });

  it("places drawings above 150 dpi", () => {
    const image: PdfImage = { id: "d1", jpeg: fakeJpeg(600, 600), width: 600, height: 600 };
    expect(imageDpi(image, 96)).toBeGreaterThanOrEqual(150);
  });

  it("reads a JPEG's real dimensions", () => {
    expect(jpegSize(fakeJpeg(640, 480))).toEqual({ width: 640, height: 480 });
  });

  it("carries the footer onto every page", () => {
    const doc: PdfDocument = {
      ...base,
      blocks: Array.from({ length: 300 }, (_, i): PdfDocument["blocks"][number] => ({
        kind: "text",
        text: `row ${i}`,
      })),
    };
    const pages = paginate(doc);
    const text = decoder.decode(writePdf(doc));
    const occurrences = text.split("Patient-generated record").length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(pages.length);
  });

  it("substitutes characters it cannot encode rather than dropping them", () => {
    // An arrow has no WinAnsi code; it becomes an en dash (150) rather than disappearing.
    expect(toWinAnsi("→")).toEqual([150]);
    // A character with no sensible substitute stays visible as a question mark.
    expect(toWinAnsi("\u{1F441}")).toEqual([63]);
    expect(toWinAnsi("µm")).toEqual([0xb5, 109]);
  });

  it("escapes parentheses and backslashes so a name cannot break the file", () => {
    const doc: PdfDocument = { ...base, blocks: [{ kind: "text", text: "Smith (J) \\ OD" }] };
    const text = decoder.decode(writePdf(doc));
    expect(text).toContain("Smith \\(J\\) \\\\ OD");
  });
});
