// Getting clinic paperwork into the record without an hour of typing.
//
// The value here is entirely in what it does *not* do. Everything this module produces is a
// suggestion: a date read out of a filename, a laterality guessed from "_OD", a modality inferred
// from "OCT" in the name, a line of recognised text. None of it is a fact until the person
// confirms it, and none of it is ever written as anything but `document_extracted` /
// `confirmed: false`. A wrong date silently accepted into an eye record is worse than no date,
// because it will be believed later.
//
// Two things follow from that:
//   * an ambiguous date (04/09/2026) is returned as ambiguous, with both readings, never resolved
//     by guessing a locale;
//   * a file that cannot be read is stored intact with a plain sentence saying so, never dropped
//     and never failed.

import type { DocumentType, Eye, ImagingModality } from "./models";

/* ------------------------------------------------------------- filenames */

export interface FilenameGuess {
  /** ISO date, only when a single reading is possible. */
  date?: string;
  /** Both readings of a date like 04/09/2026, in day-first then month-first order. */
  ambiguousDates?: [string, string];
  eye?: Eye;
  modality?: ImagingModality;
  docType?: DocumentType;
  clinic?: string;
  /** Plain sentences describing what was read and how confident it can be. */
  notes: string[];
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function iso(y: number, m: number, d: number): string | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Read a date out of a filename.
 *
 * Unambiguous forms resolve. `04-09-2026` does not: it is 4 September in most of the world and
 * 9 April in the United States, and a scan filed under the wrong month is exactly the kind of
 * quiet corruption this record cannot carry. Both readings come back for the person to choose.
 */
export function dateFromFilename(name: string): Pick<FilenameGuess, "date" | "ambiguousDates"> {
  const stem = name.replace(/\.[a-z0-9]+$/i, "");

  const ymd = stem.match(/(?:^|[^\d])(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})(?:[^\d]|$)/);
  if (ymd) {
    const value = iso(+ymd[1], +ymd[2], +ymd[3]);
    if (value) return { date: value };
  }

  // "4 Sep 2026", "Sep 4 2026", "4-Sep-2026"
  const named = stem.match(/(?:^|[^a-z0-9])(\d{1,2})[-_. ]?([a-z]{3,4})[-_. ]?(\d{4})/i);
  if (named && MONTHS[named[2].toLowerCase()]) {
    const value = iso(+named[3], MONTHS[named[2].toLowerCase()], +named[1]);
    if (value) return { date: value };
  }
  const namedFirst = stem.match(/(?:^|[^a-z0-9])([a-z]{3,4})[-_. ]?(\d{1,2})[-_. ,]+(\d{4})/i);
  if (namedFirst && MONTHS[namedFirst[1].toLowerCase()]) {
    const value = iso(+namedFirst[3], MONTHS[namedFirst[1].toLowerCase()], +namedFirst[2]);
    if (value) return { date: value };
  }

  const dmy = stem.match(/(?:^|[^\d])(\d{1,2})[-_./](\d{1,2})[-_./](\d{4})(?:[^\d]|$)/);
  if (dmy) {
    const a = +dmy[1];
    const b = +dmy[2];
    const year = +dmy[3];
    const dayFirst = iso(year, b, a);
    const monthFirst = iso(year, a, b);
    if (dayFirst && monthFirst && dayFirst !== monthFirst) {
      return { ambiguousDates: [dayFirst, monthFirst] };
    }
    const only = dayFirst ?? monthFirst;
    if (only) return { date: only };
  }

  return {};
}

const MODALITY_WORDS: [RegExp, ImagingModality][] = [
  [/\boct\b|tomograph/i, "OCT"],
  [/\bfundus\b|\bcfp\b|\bfaf\b|colou?r ?photo|retinal ?photo/i, "fundus"],
  [/visual ?field|\bhvf\b|\bvf\b|humphrey|24-?2|10-?2|30-?2|octopus/i, "visual_field"],
  [/topograph|pentacam|\bpachy|specular|corneal/i, "corneal"],
];

const DOC_WORDS: [RegExp, DocumentType][] = [
  [/discharge/i, "discharge note"],
  [/referral/i, "referral"],
  [/operat|surg|theatre/i, "surgical report"],
  [/prescription|\brx\b|spectacle|glasses/i, "prescription"],
  [/report/i, "scan report"],
  [/letter|clinic ?note|correspond/i, "clinic letter"],
  [/insurance|claim/i, "insurance"],
];

/**
 * Separators a clinic's export uses are not word boundaries to a regular expression: `OCT_2026`
 * has no boundary after "OCT" because an underscore is a word character. Normalising first is
 * what makes `\bOCT\b` mean what it looks like it means.
 */
function tokenised(name: string): string {
  return name.replace(/[_.\-/]+/g, " ");
}

/**
 * Laterality.
 *
 * The strong forms (OD/OS/OU, "right eye") are safe anywhere. A bare "R" or "L" is only a
 * laterality in a filename; in the body of a letter it is a hundred other things, so it is read
 * only from something short enough to be a name.
 */
function eyeFrom(text: string, shortEnoughToBeAFilename: boolean): Eye | undefined {
  const t = tokenised(text);
  if (/\bou\b|both ?eyes/i.test(t)) return "both";
  if (/\bod\b|\bre\b|right ?eye/i.test(t)) return "right";
  if (/\bos\b|\ble\b|left ?eye/i.test(t)) return "left";
  if (!shortEnoughToBeAFilename) return undefined;
  if (/\br\b/i.test(t)) return "right";
  if (/\bl\b/i.test(t)) return "left";
  return undefined;
}

export function guessFromFilename(name: string): FilenameGuess {
  const notes: string[] = [];
  const { date, ambiguousDates } = dateFromFilename(name);
  if (ambiguousDates) {
    notes.push(
      `The date in this filename could be ${ambiguousDates[0]} or ${ambiguousDates[1]}. ` +
        "Afterlight will not choose for you.",
    );
  } else if (date) {
    notes.push(`Date read from the filename: ${date}. Check it against the document.`);
  }

  const eye = eyeFrom(name, name.length <= 120);
  if (eye)
    notes.push("Eye guessed from the filename. Check it — a wrong eye is not recoverable later.");

  const tokens = tokenised(name);
  const modality = MODALITY_WORDS.find(([re]) => re.test(tokens))?.[1];
  const docType = DOC_WORDS.find(([re]) => re.test(tokens))?.[1];

  return { date, ambiguousDates, eye, modality, docType, notes };
}

/* ------------------------------------------------------------------- PDF */

export interface PdfInfo {
  pages?: number;
  title?: string;
  creationDate?: string;
  /** True when the structure is compressed and these fields could not be read. */
  opaque: boolean;
}

function latin1(bytes: Uint8Array, limit = 4_000_000): string {
  const view = bytes.subarray(0, limit);
  let out = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < view.length; i += CHUNK) {
    out += String.fromCharCode(...view.subarray(i, i + CHUNK));
  }
  return out;
}

/**
 * Page count and metadata from a PDF, read from the uncompressed object structure.
 *
 * PDF 1.5 and later may pack objects into compressed streams, in which case none of this is
 * visible without a full parser. That is reported as opaque rather than guessed at — a wrong page
 * count on a clinic letter is a small lie, but it is still a lie.
 */
export function readPdfInfo(bytes: Uint8Array): PdfInfo {
  const text = latin1(bytes);
  const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
  const countHint = text.match(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/);
  const pages = countHint ? Number(countHint[1]) : pageMatches ? pageMatches.length : undefined;

  const title = text.match(/\/Title\s*\(([^)]{0,200})\)/)?.[1];
  const created = text.match(/\/CreationDate\s*\(D:(\d{8})/)?.[1];
  const creationDate = created
    ? iso(+created.slice(0, 4), +created.slice(4, 6), +created.slice(6, 8))
    : undefined;

  return {
    pages,
    title: title || undefined,
    creationDate,
    opaque: pages === undefined,
  };
}

/* ----------------------------------------------------------------- DICOM */

export interface DicomInfo {
  ok: boolean;
  /** Plain sentence for the person when this could not be read. */
  reason?: string;
  studyDate?: string;
  modality?: string;
  laterality?: Eye;
  rows?: number;
  columns?: number;
  institution?: string;
  seriesDescription?: string;
  transferSyntax?: string;
  /** The embedded image, when it is a format a browser can display directly. */
  image?: { bytes: Uint8Array; mime: string };
}

const EXPLICIT_LE = "1.2.840.10008.1.2.1";
const IMPLICIT_LE = "1.2.840.10008.1.2";
const EXPLICIT_BE = "1.2.840.10008.1.2.2";

/** Encapsulated pixel formats a browser can render as-is. */
const BROWSER_PIXEL: Record<string, string> = {
  "1.2.840.10008.1.2.4.50": "image/jpeg",
  "1.2.840.10008.1.2.4.51": "image/jpeg",
  "1.2.840.10008.1.2.4.70": "image/jpeg",
  "1.2.840.10008.1.2.4.90": "image/jp2",
  "1.2.840.10008.1.2.4.91": "image/jp2",
};

const LONG_VR = new Set(["OB", "OW", "OF", "SQ", "UT", "UN"]);

function trimDicomString(s: string): string {
  return s.replace(/\0+$/, "").trim();
}

/**
 * Read the header of a DICOM Part 10 file, and the image where it is a format a browser knows.
 *
 * Deliberately not a DICOM library: it reads the handful of tags that answer "when, which eye,
 * what kind of scan", and hands back the encapsulated JPEG when there is one. Anything else —
 * an unusual transfer syntax, raw pixel data needing a windowing pass, a multi-frame series —
 * is reported honestly so the file can still be stored intact.
 */
export function readDicom(buffer: ArrayBuffer): DicomInfo {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  if (bytes.length < 140)
    return { ok: false, reason: "This file is too short to be a DICOM file." };
  if (String.fromCharCode(bytes[128], bytes[129], bytes[130], bytes[131]) !== "DICM") {
    return { ok: false, reason: "This file does not carry a DICOM header." };
  }

  const info: DicomInfo = { ok: true };
  let at = 132;
  let explicit = true; // the file meta group always is
  let inMeta = true;
  let metaEnd = Infinity;

  const readString = (start: number, length: number) =>
    trimDicomString(latin1(bytes.subarray(start, start + length)));

  while (at + 8 <= bytes.length) {
    const group = view.getUint16(at, true);
    const element = view.getUint16(at + 2, true);
    let length: number;
    let vr = "";
    let headerLength: number;

    if (explicit) {
      vr = String.fromCharCode(bytes[at + 4], bytes[at + 5]);
      if (LONG_VR.has(vr)) {
        length = view.getUint32(at + 8, true);
        headerLength = 12;
      } else {
        length = view.getUint16(at + 6, true);
        headerLength = 8;
      }
    } else {
      length = view.getUint32(at + 4, true);
      headerLength = 8;
    }

    const valueAt = at + headerLength;
    const tag = `${group.toString(16).padStart(4, "0")},${element.toString(16).padStart(4, "0")}`;

    if (tag === "0002,0000") {
      metaEnd = valueAt + 4 + view.getUint32(valueAt, true);
    }
    if (tag === "0002,0010") {
      info.transferSyntax = readString(valueAt, length);
    }

    if (tag === "7fe0,0010") {
      // Encapsulated pixel data announces itself with an undefined length.
      if (length === 0xffffffff && info.transferSyntax && BROWSER_PIXEL[info.transferSyntax]) {
        const frame = firstFragment(view, bytes, valueAt);
        if (frame) info.image = { bytes: frame, mime: BROWSER_PIXEL[info.transferSyntax] };
        else info.reason = "The image inside this file could not be separated from its container.";
      } else if (info.transferSyntax && !BROWSER_PIXEL[info.transferSyntax]) {
        info.reason =
          "The scan inside this file is stored in a format Afterlight cannot display. " +
          "The original file is kept exactly as it is.";
      }
      break;
    }

    if (tag === "0008,0020" || (tag === "0008,0022" && !info.studyDate)) {
      const raw = readString(valueAt, length);
      if (/^\d{8}$/.test(raw)) {
        info.studyDate = iso(+raw.slice(0, 4), +raw.slice(4, 6), +raw.slice(6, 8));
      }
    }
    if (tag === "0008,0060") info.modality = readString(valueAt, length) || undefined;
    if (tag === "0008,0080") info.institution = readString(valueAt, length) || undefined;
    if (tag === "0008,103e") info.seriesDescription = readString(valueAt, length) || undefined;
    if (tag === "0020,0060" || tag === "0020,0062") {
      const raw = readString(valueAt, length).toUpperCase();
      if (raw === "R") info.laterality = "right";
      else if (raw === "L") info.laterality = "left";
      else if (raw === "B") info.laterality = "both";
    }
    if (tag === "0028,0010") info.rows = length === 2 ? view.getUint16(valueAt, true) : undefined;
    if (tag === "0028,0011")
      info.columns = length === 2 ? view.getUint16(valueAt, true) : undefined;

    if (length === 0xffffffff) break; // an undefined-length sequence; stop rather than guess
    at = valueAt + length;

    if (inMeta && at >= metaEnd) {
      inMeta = false;
      const syntax = info.transferSyntax ?? EXPLICIT_LE;
      if (syntax === EXPLICIT_BE) {
        return {
          ...info,
          ok: false,
          reason:
            "This file is stored big-endian, which Afterlight does not read. " +
            "The original file is kept exactly as it is.",
        };
      }
      explicit = syntax !== IMPLICIT_LE;
    }
  }

  if (!info.studyDate && !info.modality && !info.image) {
    return {
      ok: false,
      reason:
        "Afterlight could not read anything useful out of this DICOM file, so it is stored as-is.",
      transferSyntax: info.transferSyntax,
    };
  }
  return info;
}

/** The first pixel fragment after the basic offset table. */
function firstFragment(view: DataView, bytes: Uint8Array, start: number): Uint8Array | null {
  let at = start;
  const fragments: Uint8Array[] = [];
  while (at + 8 <= bytes.length) {
    const group = view.getUint16(at, true);
    const element = view.getUint16(at + 2, true);
    const length = view.getUint32(at + 4, true);
    if (group !== 0xfffe) return null;
    if (element === 0xe0dd) break; // sequence delimiter
    if (element !== 0xe000) return null;
    const body = bytes.subarray(at + 8, at + 8 + length);
    at += 8 + length;
    if (fragments.length === 0 && looksLikeOffsetTable(body)) continue;
    fragments.push(body);
    // One frame is enough: a still is what goes in the record, and a series belongs to the clinic.
    break;
  }
  if (fragments.length === 0) return null;
  return fragments[0];
}

function looksLikeOffsetTable(body: Uint8Array): boolean {
  // The basic offset table is either empty or a list of 32-bit offsets — never a JPEG.
  return body.length === 0 || !(body[0] === 0xff && body[1] === 0xd8);
}

/* ------------------------------------------------------------------- OCR */

/**
 * Text recognition is a seam, not an implementation.
 *
 * The plan for this phase named Tesseract WASM. Nothing is bundled: the engine and its language
 * data are around ten megabytes, and fetching them at runtime would break the first
 * non-negotiable — no third-party requests, ever. So the pipeline is built and tested here and a
 * recogniser is registered by whoever provisions one locally (see docs/ocr.md). Until then the
 * app says text recognition is not installed, which is true, rather than offering a button that
 * quietly reaches for a CDN.
 */
export interface TextRecogniser {
  name: string;
  recognise(bytes: ArrayBuffer, mime: string): Promise<{ text: string; confidence: number }>;
}

let recogniser: TextRecogniser | null = null;

export function registerRecogniser(next: TextRecogniser | null): void {
  recogniser = next;
}

export function recogniserName(): string | null {
  return recogniser?.name ?? null;
}

export const OCR_NOT_INSTALLED =
  "Text recognition is not installed on this device. Afterlight will not download it for you, " +
  "because that would send a request to someone else's server. You can add it yourself — see " +
  "docs/ocr.md — or type the details in, which is what most people do.";

export const OCR_BOUNDARY =
  "Anything read out of a document is a suggestion until you confirm it. It is stored as " +
  "extracted from a document, and unconfirmed, and it stays out of your appointment brief until " +
  "you have checked it.";

export interface Extraction {
  /** Always this, for anything derived from a file rather than typed by the person. */
  source_type: "document_extracted";
  /** Always false at this point. Confirmation is a human action. */
  confirmed: false;
  text: string;
  confidence: number;
  suggestions: FilenameGuess;
}

/**
 * The value `confirmed` takes when a *person* says the details are right.
 *
 * It exists so that the only place `true` is written is one the guard can see is a human action.
 * Nothing derived from a file may set it; the check in `scripts/check-invariants.mjs` fails the
 * build on a bare `confirmed: true` anywhere in the ingestion path.
 */
export const PERSON_CONFIRMED = true;

export class RecogniserNotInstalled extends Error {
  constructor() {
    super(OCR_NOT_INSTALLED);
    this.name = "RecogniserNotInstalled";
  }
}

/** Run the registered recogniser, if there is one, and turn its text into suggestions. */
export async function extractFromDocument(bytes: ArrayBuffer, mime: string): Promise<Extraction> {
  if (!recogniser) throw new RecogniserNotInstalled();
  const { text, confidence } = await recogniser.recognise(bytes, mime);
  return {
    source_type: "document_extracted",
    confirmed: false,
    text,
    confidence,
    suggestions: suggestionsFromText(text),
  };
}

// Bounded to one line: `\s` would happily run across a newline and glue the clinic's name to the
// first word of the next paragraph.
const CLINIC_LINE =
  /\b([A-Z][A-Za-z'’]+(?:[ \t]+[A-Z][A-Za-z'’]+)*[ \t]+(?:Eye[ \t]+(?:Hospital|Unit|Centre|Center|Clinic)|Hospital|Clinic|Infirmary|Institute))\b/;

/** Dates, clinic and document type from recognised text. Suggestions only, always. */
export function suggestionsFromText(text: string): FilenameGuess {
  const notes: string[] = [];
  const guess = guessFromFilename(text.slice(0, 400));

  const clinic = text.match(CLINIC_LINE)?.[1];
  if (clinic) notes.push(`Clinic name read from the document: ${clinic}. Check the spelling.`);

  const docType = DOC_WORDS.find(([re]) => re.test(text))?.[1];

  return {
    ...guess,
    clinic,
    docType: guess.docType ?? docType,
    notes: [...guess.notes, ...notes],
  };
}
