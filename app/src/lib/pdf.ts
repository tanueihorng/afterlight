// A small, deterministic PDF writer.
//
// Why write one rather than pull in a library: the brief is the artefact that leaves this device.
// It goes to a clinician, into a hospital scanner, into someone's email. It has to be byte-stable
// (so "did the brief change?" is answerable by comparing two files), it has to work with the
// network off, and it must not carry a dependency that could start fetching fonts. Producing a
// page of text and a few images is a small enough job to own.
//
// Determinism is the design constraint: nothing here reads the clock, the locale, a random source
// or the DOM. The same document model always produces the same bytes.
//
// Fonts: the PDF base-14 (Helvetica family, WinAnsiEncoding), which every conforming reader is
// required to provide, so nothing is embedded and nothing is fetched. That is a deliberate
// trade-off against PDF/A, which requires embedded fonts — recorded in docs/clinician-note.md.

/* ------------------------------------------------------------------ pages */

export type PageSize = "A4" | "Letter";

/** Points (1/72 inch), portrait. */
export const PAGE_DIMENSIONS: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
};

export const MARGIN = { top: 48, right: 48, bottom: 54, left: 48 };

/* ------------------------------------------------------------- encoding */

/**
 * Unicode → WinAnsi byte for the characters outside Latin-1 that the app actually produces.
 * Anything unmapped is transliterated rather than dropped: a missing character in a clinical
 * document is worse than an approximate one.
 */
const WINANSI_HIGH: Record<string, number> = {
  "€": 128, // €
  "‚": 130,
  ƒ: 131,
  "„": 132,
  "…": 133, // …
  "†": 134,
  "‡": 135,
  ˆ: 136,
  "‰": 137,
  Š: 138,
  "‹": 139,
  Œ: 140,
  Ž: 142,
  "‘": 145, // '
  "’": 146, // '
  "“": 147, // "
  "”": 148, // "
  "•": 149, // •
  "–": 150, // –
  "—": 151, // —
  "˜": 152,
  "™": 153,
  š: 154,
  "›": 155,
  œ: 156,
  ž: 158,
  Ÿ: 159,
};

/** Characters with no WinAnsi code that the app's own copy uses. */
const TRANSLITERATE: Record<string, string> = {
  "→": "–", // → : an en dash reads correctly in "1 Jan – 2 Feb"
  "←": "<-",
  "✓": "[done]",
  "✗": "[no]",
  "＋": "+",
  "≥": ">=",
  "≤": "<=",
  "‘": "‘",
  " ": " ",
  "‑": "-",
  " ": " ",
  "​": "",
};

/** Encode a string to WinAnsi bytes, transliterating what cannot be represented. */
export function toWinAnsi(text: string): number[] {
  const out: number[] = [];
  for (const ch of normaliseForPdf(text)) {
    const code = ch.codePointAt(0)!;
    if (code >= 32 && code <= 126) {
      out.push(code);
    } else if (ch in WINANSI_HIGH) {
      out.push(WINANSI_HIGH[ch]);
    } else if (code >= 160 && code <= 255) {
      out.push(code);
    } else if (code === 9 || code === 10 || code === 13) {
      out.push(32);
    } else {
      out.push(63); // "?" — visible, so a gap in the font is never a silent omission
    }
  }
  return out;
}

function normaliseForPdf(text: string): string {
  let out = "";
  for (const ch of text) {
    const sub = TRANSLITERATE[ch];
    out += sub === undefined ? ch : sub;
  }
  return out;
}

/* --------------------------------------------------------------- metrics */

// Helvetica and Helvetica-Bold advance widths, in 1/1000 em, for WinAnsi codes 32–126.
const W_REGULAR_ASCII = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const W_BOLD_ASCII = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

// The high codes the app's copy reaches for; anything else falls back to a sane average, which
// only ever affects where a line wraps.
const W_REGULAR_HIGH: Record<number, number> = {
  145: 222,
  146: 222,
  147: 333,
  148: 333,
  149: 350,
  150: 556,
  151: 1000,
  133: 1000,
  176: 400,
  181: 556,
  183: 278,
  215: 584,
  224: 556,
  233: 556,
  246: 556,
};
const W_BOLD_HIGH: Record<number, number> = {
  145: 278,
  146: 278,
  147: 500,
  148: 500,
  149: 350,
  150: 556,
  151: 1000,
  133: 1000,
  176: 400,
  181: 611,
  183: 278,
  215: 584,
  224: 556,
  233: 556,
  246: 611,
};

export type FontName = "regular" | "bold" | "italic";

function widthOfCode(code: number, font: FontName): number {
  const bold = font === "bold";
  if (code >= 32 && code <= 126) return (bold ? W_BOLD_ASCII : W_REGULAR_ASCII)[code - 32];
  const high = bold ? W_BOLD_HIGH : W_REGULAR_HIGH;
  return high[code] ?? (bold ? 600 : 556);
}

/** Width of a string at a given size, in points. */
export function textWidth(text: string, size: number, font: FontName = "regular"): number {
  let total = 0;
  for (const code of toWinAnsi(text)) total += widthOfCode(code, font);
  return (total * size) / 1000;
}

/** Greedy wrap. Words longer than the line are broken rather than allowed to overflow. */
export function wrapText(
  text: string,
  width: number,
  size: number,
  font: FontName = "regular",
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, size, font) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (textWidth(word, size, font) <= width) {
        line = word;
        continue;
      }
      // A single unbreakable run (a long filename, a URL) — break it at the character.
      let chunk = "";
      for (const ch of word) {
        if (textWidth(chunk + ch, size, font) > width && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      line = chunk;
    }
    if (line) lines.push(line);
  }
  return lines;
}

/* --------------------------------------------------------- document model */

/** A JPEG to embed. Raw JPEG bytes go into the file untouched, via /DCTDecode. */
export interface PdfImage {
  id: string;
  jpeg: Uint8Array;
  /** Pixel dimensions of the JPEG. */
  width: number;
  height: number;
}

export type Block =
  | { kind: "heading"; text: string; level: 1 | 2 | 3 }
  | { kind: "text"; text: string; size?: number; font?: FontName; grey?: number }
  | { kind: "bullet"; text: string; size?: number; marker?: string }
  | { kind: "labelled"; label: string; text: string; size?: number }
  | { kind: "rule" }
  | { kind: "space"; height: number }
  /** Two independent stacks side by side; the pair never splits across a page. */
  | { kind: "columns"; left: Block[]; right: Block[] }
  /** Thumbnails in a row with captions underneath. */
  | { kind: "figures"; figures: { imageId: string; caption: string }[]; heightPt: number }
  /** Blocks that must stay on one page together. */
  | { kind: "group"; blocks: Block[] };

export interface PdfDocument {
  title: string;
  /** Shown top-right on every page; the patient chooses what identifies them. */
  header?: string;
  /** Repeated at the foot of every page, above the page number. */
  footer: string;
  pageSize: PageSize;
  /** A fixed ISO timestamp. Passed in rather than read, so output stays reproducible. */
  generatedAt: string;
  blocks: Block[];
  images?: PdfImage[];
}

/* ----------------------------------------------------------------- layout */

interface Op {
  /** Offset from the top of the text area. */
  y: number;
  op:
    | { t: "text"; x: number; text: string; size: number; font: FontName; grey: number }
    | { t: "rule"; x1: number; x2: number }
    | { t: "image"; x: number; imageId: string; w: number; h: number };
}

const SIZES = { h1: 17, h2: 11, h3: 9, body: 9.5, small: 8, tiny: 7 };
const LEADING = 1.32;

function blockOps(block: Block, width: number, x0: number): { ops: Op[]; height: number } {
  const ops: Op[] = [];
  let y = 0;

  const push = (text: string, size: number, font: FontName, grey: number, x = x0) => {
    ops.push({ y, op: { t: "text", x, text, size, font, grey } });
    y += size * LEADING;
  };

  switch (block.kind) {
    case "heading": {
      const size = block.level === 1 ? SIZES.h1 : block.level === 2 ? SIZES.h2 : SIZES.h3;
      const font: FontName = "bold";
      y += block.level === 1 ? 0 : 6;
      for (const line of wrapText(block.text, width, size, font)) push(line, size, font, 0.08);
      y += block.level === 1 ? 4 : 2;
      break;
    }
    case "text": {
      const size = block.size ?? SIZES.body;
      const font = block.font ?? "regular";
      for (const line of wrapText(block.text, width, size, font))
        push(line, size, font, block.grey ?? 0.15);
      y += 2;
      break;
    }
    case "bullet": {
      const size = block.size ?? SIZES.body;
      const marker = block.marker ?? "•";
      const indent = textWidth(`${marker} `, size);
      const lines = wrapText(block.text, width - indent, size);
      lines.forEach((line, i) => {
        if (i === 0)
          ops.push({
            y,
            op: { t: "text", x: x0, text: marker, size, font: "regular", grey: 0.35 },
          });
        push(line, size, "regular", 0.15, x0 + indent);
      });
      y += 1;
      break;
    }
    case "labelled": {
      const size = block.size ?? SIZES.body;
      const labelWidth = textWidth(`${block.label}  `, size, "bold");
      const lines = wrapText(block.text, width - labelWidth, size);
      lines.forEach((line, i) => {
        if (i === 0)
          ops.push({
            y,
            op: { t: "text", x: x0, text: block.label, size, font: "bold", grey: 0.08 },
          });
        push(line, size, "regular", 0.15, x0 + labelWidth);
      });
      y += 1;
      break;
    }
    case "rule": {
      y += 5;
      ops.push({ y, op: { t: "rule", x1: x0, x2: x0 + width } });
      y += 7;
      break;
    }
    case "space":
      y += block.height;
      break;
    case "columns": {
      const gutter = 20;
      const colWidth = (width - gutter) / 2;
      const left = flowBlocks(block.left, colWidth, x0);
      const right = flowBlocks(block.right, colWidth, x0 + colWidth + gutter);
      ops.push(...left.ops, ...right.ops);
      y = Math.max(left.height, right.height);
      break;
    }
    case "figures": {
      const gap = 10;
      const captionSize = SIZES.tiny;
      let x = x0;
      for (const fig of block.figures) {
        const w = block.heightPt;
        if (x + w > x0 + width) break;
        ops.push({ y, op: { t: "image", x, imageId: fig.imageId, w, h: block.heightPt } });
        ops.push({
          y: y + block.heightPt + captionSize,
          op: { t: "text", x, text: fig.caption, size: captionSize, font: "regular", grey: 0.35 },
        });
        x += w + gap;
      }
      y += block.heightPt + captionSize * 2 + 4;
      break;
    }
    case "group": {
      const inner = flowBlocks(block.blocks, width, x0);
      ops.push(...inner.ops);
      y = inner.height;
      break;
    }
  }
  return { ops, height: y };
}

function flowBlocks(blocks: Block[], width: number, x0: number): { ops: Op[]; height: number } {
  const ops: Op[] = [];
  let y = 0;
  for (const block of blocks) {
    const laid = blockOps(block, width, x0);
    for (const op of laid.ops) ops.push({ y: y + op.y, op: op.op });
    y += laid.height;
  }
  return { ops, height: y };
}

interface LaidPage {
  ops: Op[];
}

/**
 * Break the block stream into pages. `columns`, `group` and `figures` blocks never split; if one
 * is taller than a whole page it starts a page of its own and is allowed to run over rather than
 * being silently truncated — losing a line of a clinical summary is not an acceptable failure.
 */
export function paginate(doc: PdfDocument): LaidPage[] {
  const page = PAGE_DIMENSIONS[doc.pageSize];
  const width = page.width - MARGIN.left - MARGIN.right;
  const usable = page.height - MARGIN.top - MARGIN.bottom;

  const pages: LaidPage[] = [];
  let current: Op[] = [];
  let y = 0;

  const flush = () => {
    pages.push({ ops: current });
    current = [];
    y = 0;
  };

  const atomic = (b: Block) => b.kind === "columns" || b.kind === "group" || b.kind === "figures";

  for (const block of doc.blocks) {
    const laid = blockOps(block, width, MARGIN.left);
    if (y > 0 && y + laid.height > usable) {
      if (atomic(block) || laid.height <= usable) {
        flush();
      } else {
        // A long run of text: let it start here and continue on the next page.
        for (const op of laid.ops) {
          if (y + op.y > usable) {
            flush();
            y = -op.y;
          }
          current.push({ y: y + op.y, op: op.op });
        }
        y += laid.height;
        continue;
      }
    }
    for (const op of laid.ops) current.push({ y: y + op.y, op: op.op });
    y += laid.height;
  }
  if (current.length > 0 || pages.length === 0) flush();
  return pages;
}

/* ---------------------------------------------------------------- writing */

function escapePdfString(bytes: number[]): string {
  let out = "";
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) out += `\\${String.fromCharCode(b)}`;
    else if (b < 32 || b > 126) out += `\\${b.toString(8).padStart(3, "0")}`;
    else out += String.fromCharCode(b);
  }
  return out;
}

function pdfString(text: string): string {
  return `(${escapePdfString(toWinAnsi(text))})`;
}

function fmt(n: number): string {
  // Fixed precision keeps the bytes stable across engines with different float printing.
  const s = n.toFixed(2);
  return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

const FONT_RES: Record<FontName, string> = { regular: "F1", bold: "F2", italic: "F3" };

function contentStream(
  page: LaidPage,
  doc: PdfDocument,
  pageNo: number,
  pageCount: number,
): string {
  const size = PAGE_DIMENSIONS[doc.pageSize];
  const top = size.height - MARGIN.top;
  const parts: string[] = [];

  if (doc.header) {
    const w = textWidth(doc.header, SIZES.tiny);
    parts.push(
      `0.4 g BT /F1 ${SIZES.tiny} Tf 1 0 0 1 ${fmt(size.width - MARGIN.right - w)} ${fmt(size.height - MARGIN.top + 16)} Tm ${pdfString(doc.header)} Tj ET`,
    );
  }

  for (const { y, op } of page.ops) {
    const pageY = top - y;
    if (op.t === "text") {
      if (!op.text) continue;
      parts.push(
        `${fmt(op.grey)} g BT /${FONT_RES[op.font]} ${fmt(op.size)} Tf 1 0 0 1 ${fmt(op.x)} ${fmt(pageY - op.size)} Tm ${pdfString(op.text)} Tj ET`,
      );
    } else if (op.t === "rule") {
      parts.push(`0.75 G 0.5 w ${fmt(op.x1)} ${fmt(pageY)} m ${fmt(op.x2)} ${fmt(pageY)} l S`);
    } else if (op.t === "image") {
      parts.push(
        `q ${fmt(op.w)} 0 0 ${fmt(op.h)} ${fmt(op.x)} ${fmt(pageY - op.h)} cm /${op.imageId} Do Q`,
      );
    }
  }

  // Footer: provenance on every page, so a page that gets separated still says what it is.
  const footerY = MARGIN.bottom - 24;
  const footerLines = wrapText(doc.footer, size.width - MARGIN.left - MARGIN.right, SIZES.tiny);
  footerLines.forEach((line, i) => {
    parts.push(
      `0.4 g BT /F1 ${SIZES.tiny} Tf 1 0 0 1 ${fmt(MARGIN.left)} ${fmt(footerY + (footerLines.length - 1 - i) * SIZES.tiny * 1.3)} Tm ${pdfString(line)} Tj ET`,
    );
  });
  const number = `Page ${pageNo} of ${pageCount}`;
  parts.push(
    `0.4 g BT /F1 ${SIZES.tiny} Tf 1 0 0 1 ${fmt(size.width - MARGIN.right - textWidth(number, SIZES.tiny))} ${fmt(footerY - SIZES.tiny * 1.3)} Tm ${pdfString(number)} Tj ET`,
  );

  return parts.join("\n");
}

function latin1Bytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

/** A PDF date string, derived from the caller's ISO timestamp — never from the clock. */
function pdfDate(iso: string): string {
  const compact = iso.replace(/[-:]/g, "").replace(/\.\d+/, "");
  const [date, time = "000000Z"] = compact.split("T");
  return `D:${date}${time.replace("Z", "")}Z`;
}

/** Render the document to PDF bytes. Same document in, same bytes out. */
export function writePdf(doc: PdfDocument): Uint8Array {
  const pages = paginate(doc);
  const size = PAGE_DIMENSIONS[doc.pageSize];
  const images = doc.images ?? [];

  // Object numbering: 1 catalog, 2 pages, 3–5 fonts, 6 info, then images, then page/content pairs.
  const firstImageObj = 7;
  const imageObjNo = new Map(images.map((img, i) => [img.id, firstImageObj + i]));
  const firstPageObj = firstImageObj + images.length;

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const write = (bytes: Uint8Array) => {
    chunks.push(bytes);
    length += bytes.length;
  };
  const writeText = (text: string) => write(latin1Bytes(text));
  const beginObject = (n: number) => {
    offsets[n] = length;
    writeText(`${n} 0 obj\n`);
  };
  const endObject = () => writeText("endobj\n");

  writeText("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  const pageObjNos = pages.map((_, i) => firstPageObj + i * 2);

  beginObject(1);
  writeText(`<< /Type /Catalog /Pages 2 0 R >>\n`);
  endObject();

  beginObject(2);
  writeText(
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjNos.map((n) => `${n} 0 R`).join(" ")}] >>\n`,
  );
  endObject();

  const fonts: [number, string][] = [
    [3, "Helvetica"],
    [4, "Helvetica-Bold"],
    [5, "Helvetica-Oblique"],
  ];
  for (const [n, base] of fonts) {
    beginObject(n);
    writeText(`<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>\n`);
    endObject();
  }

  beginObject(6);
  writeText(
    `<< /Title ${pdfString(doc.title)} /Producer (Afterlight) /Creator (Afterlight) /CreationDate (${pdfDate(doc.generatedAt)}) /ModDate (${pdfDate(doc.generatedAt)}) >>\n`,
  );
  endObject();

  for (const img of images) {
    beginObject(imageObjNo.get(img.id)!);
    writeText(
      `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>\nstream\n`,
    );
    write(img.jpeg);
    writeText("\nendstream\n");
    endObject();
  }

  pages.forEach((page, i) => {
    const pageNo = firstPageObj + i * 2;
    const contentNo = pageNo + 1;
    const usedImages = new Set(
      page.ops.filter((o) => o.op.t === "image").map((o) => (o.op as { imageId: string }).imageId),
    );
    const xobjects = [...usedImages].map((id) => `/${id} ${imageObjNo.get(id)} 0 R`).join(" ");

    beginObject(pageNo);
    writeText(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fmt(size.width)} ${fmt(size.height)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>` +
        (xobjects ? ` /XObject << ${xobjects} >>` : "") +
        ` >> /Contents ${contentNo} 0 R >>\n`,
    );
    endObject();

    const stream = contentStream(page, doc, i + 1, pages.length);
    const streamBytes = latin1Bytes(stream);
    beginObject(contentNo);
    writeText(`<< /Length ${streamBytes.length} >>\nstream\n`);
    write(streamBytes);
    writeText("\nendstream\n");
    endObject();
  });

  const objectCount = firstPageObj + pages.length * 2;
  const xrefOffset = length;
  writeText(`xref\n0 ${objectCount}\n0000000000 65535 f \n`);
  for (let n = 1; n < objectCount; n++) {
    writeText(`${String(offsets[n] ?? 0).padStart(10, "0")} 00000 n \n`);
  }
  writeText(
    `trailer\n<< /Size ${objectCount} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** Effective resolution of an embedded image, for checking print quality. */
export function imageDpi(image: PdfImage, drawnWidthPt: number): number {
  return (image.width / drawnWidthPt) * 72;
}

/** Read a JPEG's pixel dimensions from its SOF marker. */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i < bytes.length - 9) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1];
    // SOF0–SOF15, excluding the non-frame markers in that range.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: (bytes[i + 5] << 8) | bytes[i + 6],
        width: (bytes[i + 7] << 8) | bytes[i + 8],
      };
    }
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
  }
  return null;
}
