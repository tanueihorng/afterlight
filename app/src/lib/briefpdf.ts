// Turning an appointment brief into a printable document.
//
// The ordering here is the whole point. A clinician reads the top of page one and often nothing
// else, so page one carries what is new in each eye and what the patient wants to ask. Everything
// that is context rather than change — drawings, clinic events, treatment, recorded numbers —
// comes after. Nothing is dropped; it is only ordered by what a short appointment needs first.

import type { BriefItem, BriefPayload, SourceType } from "./models";
import { SOURCE_LABELS } from "./models";
import type { Block, PageSize, PdfDocument, PdfImage } from "./pdf";
import { formatDate } from "./util";

export const PATIENT_GENERATED_FOOTER =
  "Patient-generated record, produced by Afterlight from this patient's own entries and from " +
  "documents the patient holds. Patient-reported items are the patient's own descriptions of " +
  "their experience. This is not a clinical record, not a measurement, and not a diagnosis.";

/**
 * Where a clinician can read a fuller explanation. Printed as text rather than a link, because
 * the person holding the page is holding paper.
 */
export const CLINICIAN_NOTE_URL =
  "github.com/tanueihorng/afterlight/blob/main/docs/clinician-note.md";

export const HOW_TO_READ =
  "How to read this: each panel is one eye. Inside a panel, the patient's own reports come first, " +
  "grouped by what changed and newest first, then anything copied from clinic documents. " +
  "Everything below the panels is context. Nothing here is interpreted by the app.";

const BUCKET_LABEL: Record<BriefItem["bucket"], string> = {
  new: "NEW",
  worse: "MORE THAN USUAL",
  unchanged: "UNCHANGED",
  improved: "LESS THAN USUAL",
};

/** The order a short appointment needs: what changed first, what stayed the same after. */
export const BUCKET_ORDER: BriefItem["bucket"][] = ["new", "worse", "unchanged", "improved"];

/**
 * Fall back to the plain string arrays when a brief was saved before provenance was carried
 * per item. An old saved brief must still print, and must not claim a provenance it never had.
 */
export function itemsForEye(payload: BriefPayload, eye: "right" | "left"): BriefItem[] {
  const structured = payload.perEyeItems?.[eye];
  if (structured && structured.length > 0) return structured;
  const out: BriefItem[] = [];
  for (const bucket of BUCKET_ORDER) {
    const key = bucket === "worse" ? "worse" : bucket;
    for (const text of payload.perEye[eye][key]) {
      out.push({ bucket, text, date: payload.range_end, source_type: "patient_reported" });
    }
  }
  return out;
}

/**
 * The same items, most important first.
 *
 * Anywhere the brief has to be cut short — a QR card, a phone screen — the cut has to fall on the
 * unchanged lines, not the new ones. Sorting by bucket here means every consumer trims in the
 * same, defensible order instead of dropping whatever happens to be last by date.
 */
export function orderedItemsForEye(payload: BriefPayload, eye: "right" | "left"): BriefItem[] {
  const items = itemsForEye(payload, eye);
  return [...items].sort((a, b) => BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket));
}

function eyeColumn(payload: BriefPayload, eye: "right" | "left"): Block[] {
  const blocks: Block[] = [
    { kind: "heading", text: eye === "right" ? "RIGHT EYE (OD)" : "LEFT EYE (OS)", level: 2 },
  ];
  const items = itemsForEye(payload, eye);

  // The split is the point of the panel. Blending a clinician's documented finding into a list a
  // reader will take as subjective is exactly the error this brief exists to avoid, so the two
  // never share a run of bullets — they are separately headed, even when one side is empty.
  const own = items.filter(
    (i) => i.source_type === "patient_reported" || i.source_type === "patient_drawn",
  );
  const documented = items.filter((i) => !own.includes(i));

  blocks.push({ kind: "heading", text: "The patient's own reports", level: 3 });
  if (own.length === 0) {
    blocks.push({
      kind: "text",
      text: "Nothing recorded for this eye in this period.",
      grey: 0.4,
      size: 8.5,
    });
  } else {
    for (const bucket of BUCKET_ORDER) {
      const rows = own.filter((i) => i.bucket === bucket);
      if (rows.length === 0) continue;
      blocks.push({ kind: "text", text: BUCKET_LABEL[bucket], size: 7.5, font: "bold", grey: 0.3 });
      for (const row of rows) blocks.push({ kind: "bullet", text: row.text, marker: "–" });
    }
  }

  if (documented.length > 0) {
    blocks.push({ kind: "heading", text: "Copied from clinic documents", level: 3 });
    for (const row of documented) {
      blocks.push({
        kind: "bullet",
        text: `${row.text}  [${SOURCE_LABELS[row.source_type].toLowerCase()}]`,
        marker: "–",
      });
    }
  }
  return blocks;
}

export interface BriefPdfOptions {
  title: string;
  pageSize: PageSize;
  /** Whatever the patient wants at the top of every page: a name, a hospital number, nothing. */
  header?: string;
  /** Rasterised drawings, keyed to `payload.drawings[].id`. */
  images?: PdfImage[];
  /** Point width each drawing is placed at; used to keep them above 150 dpi. */
  figureSizePt?: number;
}

export function briefToPdfDocument(payload: BriefPayload, opts: BriefPdfOptions): PdfDocument {
  const blocks: Block[] = [];

  blocks.push({ kind: "heading", text: "AFTERLIGHT — APPOINTMENT BRIEF", level: 1 });
  blocks.push({ kind: "text", text: opts.title, size: 10, font: "bold" });
  blocks.push({
    kind: "text",
    text: `Period ${formatDate(payload.range_start)} – ${formatDate(payload.range_end)}  ·  prepared ${formatDate(payload.generated_at.slice(0, 10))}`,
    size: 8,
    grey: 0.35,
  });
  blocks.push({ kind: "text", text: HOW_TO_READ, size: 7.5, grey: 0.4 });
  blocks.push({
    kind: "text",
    text: `A one-page explanation of this document for a clinician: ${CLINICIAN_NOTE_URL}`,
    size: 7,
    grey: 0.45,
  });
  blocks.push({ kind: "rule" });

  blocks.push({
    kind: "heading",
    text: "BY EYE, OVER THIS PERIOD",
    level: 2,
  });
  blocks.push({
    kind: "columns",
    left: eyeColumn(payload, "right"),
    right: eyeColumn(payload, "left"),
  });

  blocks.push({ kind: "rule" });
  blocks.push({
    kind: "group",
    blocks: [
      { kind: "heading", text: "QUESTIONS THE PATIENT WANTS TO ASK", level: 2 },
      ...(payload.questions.length === 0
        ? ([{ kind: "text", text: "None written down.", grey: 0.4 }] as Block[])
        : payload.questions.map((q): Block => ({ kind: "bullet", text: q, marker: "–" }))),
    ],
  });

  const figures = payload.drawings
    .filter((d) => (opts.images ?? []).some((img) => img.id === d.id))
    .slice(0, 6);
  if (figures.length > 0) {
    blocks.push({ kind: "rule" });
    blocks.push({
      kind: "group",
      blocks: [
        { kind: "heading", text: "WHAT THE PATIENT DREW", level: 2 },
        {
          kind: "figures",
          heightPt: opts.figureSizePt ?? 96,
          figures: figures.map((d) => ({
            imageId: d.id,
            caption: `${formatDate(d.date_time.slice(0, 10))} ${d.eye === "right" ? "OD" : d.eye === "left" ? "OS" : "OU"}`,
          })),
        },
        {
          kind: "text",
          text: "Patient drawings of perceived vision. These are not retinal images and not a field test.",
          size: 7,
          grey: 0.4,
        },
      ],
    });
  }

  blocks.push({ kind: "rule" });
  blocks.push({
    kind: "heading",
    text: "FROM CLINIC RECORDS AND SCANS THE PATIENT HOLDS",
    level: 2,
  });
  if (payload.clinicalEvents.length === 0) {
    blocks.push({ kind: "text", text: "None recorded in this period.", grey: 0.4 });
  } else {
    for (const event of payload.clinicalEvents) {
      blocks.push({
        kind: "labelled",
        label: formatDate(event.date),
        text: `${event.kind}: ${event.title}${suffixFor(event.source_type)}`,
      });
    }
  }

  blocks.push({ kind: "rule" });
  blocks.push({ kind: "heading", text: "CURRENT TREATMENT", level: 2 });
  if (payload.treatment.length === 0) {
    blocks.push({ kind: "text", text: "No active treatment recorded.", grey: 0.4 });
  } else {
    for (const line of payload.treatment) blocks.push({ kind: "bullet", text: line, marker: "–" });
  }

  if (payload.trends && payload.trends.length > 0) {
    blocks.push({ kind: "rule" });
    blocks.push({ kind: "heading", text: "NUMBERS RECORDED IN THIS PERIOD", level: 2 });
    for (const line of payload.trends)
      blocks.push({ kind: "bullet", text: line, size: 8.5, marker: "–" });
    blocks.push({
      kind: "text",
      text: "Values exactly as recorded, with no interpretation applied.",
      size: 7,
      grey: 0.4,
    });
  }

  if (payload.selfTestNotes && payload.selfTestNotes.length > 0) {
    blocks.push({ kind: "rule" });
    blocks.push({ kind: "heading", text: "CHECKS THE PATIENT DID AT HOME", level: 2 });
    for (const line of payload.selfTestNotes)
      blocks.push({ kind: "bullet", text: line, size: 8.5, marker: "–" });
    blocks.push({
      kind: "text",
      text: "Home checks under uncontrolled conditions. Not clinical measurements.",
      size: 7,
      grey: 0.4,
    });
  }

  return {
    title: opts.title,
    header: opts.header,
    footer: PATIENT_GENERATED_FOOTER,
    pageSize: opts.pageSize,
    generatedAt: payload.generated_at,
    blocks,
    images: opts.images,
  };
}

function suffixFor(source: SourceType | undefined): string {
  if (!source || source === "clinician_reported") return "";
  return `  [${SOURCE_LABELS[source].toLowerCase()}]`;
}

export function briefPdfFilename(payload: BriefPayload): string {
  return `afterlight-brief-${payload.range_start}-to-${payload.range_end}.pdf`;
}
