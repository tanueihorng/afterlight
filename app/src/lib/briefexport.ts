// Browser-side glue between a brief and a PDF file.
//
// Everything that touches a canvas or the DOM lives here, so `pdf.ts` and `briefpdf.ts` stay pure
// and testable. The one job with any judgement in it is the drawings: they are re-rendered from
// their marks at print resolution rather than scaled up from a screen thumbnail, because a
// patient's drawing of a shadow is the part of this document a clinician will actually squint at.

import { briefPdfFilename, briefToPdfDocument, type BriefPdfOptions } from "./briefpdf";
import { LIGHT_PALETTE, renderDrawing } from "./render";
import type { BriefPayload, VisualFieldDrawing } from "./models";
import { jpegSize, writePdf, type PageSize, type PdfImage } from "./pdf";

/**
 * Points a drawing occupies on the page, and the pixels it is rendered at.
 *
 * 132pt is about 47mm — small enough that three fit across a page, large enough that the shape of
 * a shadow is legible without leaning in. At 600px that is 327 dpi.
 */
export const FIGURE_SIZE_PT = 132;
const FIGURE_PIXELS = 600;

/** The lowest resolution worth putting in front of a clinician. */
export const MIN_FIGURE_DPI = 150;

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Re-render each drawing at print resolution as a JPEG.
 *
 * On white, with the light palette: the printed page is white whatever theme the app is in, and a
 * dark-theme drawing printed as-is is either a black rectangle or nothing at all.
 */
export function rasteriseDrawings(drawings: VisualFieldDrawing[]): PdfImage[] {
  const out: PdfImage[] = [];
  for (const drawing of drawings) {
    const canvas = document.createElement("canvas");
    canvas.width = FIGURE_PIXELS;
    canvas.height = FIGURE_PIXELS;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    renderDrawing(ctx, drawing.canvas_data.marks, FIGURE_PIXELS, FIGURE_PIXELS, LIGHT_PALETTE, {
      fieldOutline: true,
    });
    // The white ground goes on *behind* the marks, not before them: `renderDrawing` opens with a
    // clearRect, so a fill drawn first is wiped, and JPEG has no alpha — a transparent canvas
    // flattens to solid black. That is exactly what the first printed brief did to two drawings.
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, FIGURE_PIXELS, FIGURE_PIXELS);
    ctx.globalCompositeOperation = "source-over";
    const jpeg = dataUrlToBytes(canvas.toDataURL("image/jpeg", 0.92));
    const size = jpegSize(jpeg) ?? { width: FIGURE_PIXELS, height: FIGURE_PIXELS };
    out.push({ id: drawing.id, jpeg, width: size.width, height: size.height });
  }
  return out;
}

export interface BriefExportOptions {
  title: string;
  pageSize: PageSize;
  header?: string;
  /** The full drawing records for the ids in the payload, when figures are wanted. */
  drawings?: VisualFieldDrawing[];
}

export function briefToPdfBytes(payload: BriefPayload, opts: BriefExportOptions): Uint8Array {
  const images = opts.drawings?.length ? rasteriseDrawings(opts.drawings) : undefined;
  const pdfOptions: BriefPdfOptions = {
    title: opts.title,
    pageSize: opts.pageSize,
    header: opts.header,
    images,
    figureSizePt: FIGURE_SIZE_PT,
  };
  return writePdf(briefToPdfDocument(payload, pdfOptions));
}

/** Hand the PDF to the browser as a download. */
export function downloadBriefPdf(payload: BriefPayload, opts: BriefExportOptions): string {
  const bytes = briefToPdfBytes(payload, opts);
  const filename = briefPdfFilename(payload);
  downloadBytes(bytes, filename, "application/pdf");
  return filename;
}

export function downloadBytes(bytes: Uint8Array | string, filename: string, mime: string): void {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // The download has been handed to the browser by the time click() returns; holding the URL
  // open any longer just pins the bytes in memory.
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

/** True when this browser can hand a file to another app rather than only to the filesystem. */
export function canShareFiles(): boolean {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share !== "function" || typeof nav.canShare !== "function") return false;
  try {
    return nav.canShare({
      files: [new File([new Uint8Array([1])], "probe.bin", { type: "application/octet-stream" })],
    });
  } catch {
    return false;
  }
}

/** Offer a file through the OS share sheet. Returns false when the person cancelled. */
export async function shareFile(
  bytes: Uint8Array | string,
  filename: string,
  mime: string,
  title: string,
): Promise<boolean> {
  const file = new File([bytes as BlobPart], filename, { type: mime });
  try {
    await navigator.share({ files: [file], title });
    return true;
  } catch {
    return false;
  }
}
