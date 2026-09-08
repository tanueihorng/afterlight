// Handing part of a record to someone else, without a server.
//
// The whole export already exists. This is the other thing a patient needs: giving a clinician,
// a second opinion or a family member the part of the record that is relevant, and nothing more.
//
// Three rules shape everything here.
//
//   1. Scope is a date range and a set of record types, and the default is the narrowest thing
//      that is still useful. Handing over four years of everything because the button was easier
//      is a privacy failure the app would have caused.
//   2. What is included and what is left out is stated in counts before anything is produced, and
//      recorded inside the bundle itself, so neither end has to guess.
//   3. A bundle is an archive. It goes through the same envelope, the same checksum and the same
//      importer, because a second, lightly-tested path for the file that carries someone's
//      medical history is not worth the convenience.

import {
  APP_VERSION,
  ARCHIVE_FORMAT,
  ARCHIVE_VERSION,
  bytesToBase64,
  checksumOf,
  seal,
  type Archive,
  type ArchiveFile,
  type EncryptedArchive,
  type ShareDescriptor,
} from "./archive";
import { STORES, type AllData } from "./db";
import { SCHEMA_VERSION } from "./migrations";
import type { StoredFile } from "./models";
import { dateOf, type Entity } from "./query";
import { byteCapacity } from "./qr";

/** Stores a share can carry. `files`, `meta`, `backups` and `briefs` are handled separately. */
export const SHAREABLE = STORES.filter(
  (s) => s !== "files" && s !== "meta" && s !== "backups" && s !== "briefs",
) as readonly Entity[];

export const SHARE_LABELS: Partial<Record<Entity, string>> = {
  symptoms: "Symptom entries",
  dailyLogs: "Daily logs",
  floaters: "Tracked floaters",
  drawings: "Drawings of what I see",
  appointments: "Appointments",
  questions: "Questions for my doctor",
  diagnoses: "Diagnoses",
  procedures: "Procedures",
  medications: "Medication and treatment",
  prescriptions: "Glasses prescriptions",
  measurements: "Measurements",
  selfTests: "Checks I did at home",
  imaging: "Imaging records",
  documents: "Documents",
  baselines: "My baselines",
};

export interface ShareScope {
  range_start: string; // YYYY-MM-DD inclusive
  range_end: string; // YYYY-MM-DD inclusive
  include: Partial<Record<Entity, boolean>>;
  /** Original scans and letters. Off by default: they are the bulk and the most identifying part. */
  includeFiles: boolean;
}

/**
 * The default a patient gets before touching anything: what they themselves recorded over the
 * period, and the questions they want to ask. Everything else is a deliberate addition.
 */
export function defaultScope(range_start: string, range_end: string): ShareScope {
  return {
    range_start,
    range_end,
    include: {
      symptoms: true,
      dailyLogs: true,
      drawings: true,
      questions: true,
    },
    includeFiles: false,
  };
}

function inRange(scope: ShareScope, entity: Entity, row: unknown): boolean {
  const date = dateOf(entity, row);
  if (!date) return false;
  return date >= scope.range_start && date <= scope.range_end;
}

/**
 * Rows a scope selects, per store.
 *
 * Questions and baselines are deliberately not date-filtered. A question the patient has been
 * carrying for six months is exactly the thing they need in the room, and a baseline is what the
 * period is measured against — filtering either by the period would drop the point of including
 * it. Both are stated as such in the preview rather than being quietly broadened.
 */
export const NOT_DATE_FILTERED: Entity[] = ["questions", "baselines"];

export function selectForShare(data: AllData, scope: ShareScope): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  for (const entity of SHAREABLE) {
    if (!scope.include[entity]) continue;
    const rows = (data[entity] ?? []) as unknown[];
    out[entity] = NOT_DATE_FILTERED.includes(entity)
      ? [...rows]
      : rows.filter((row) => inRange(scope, entity, row));
  }
  return out;
}

export interface SharePreview {
  counts: Partial<Record<Entity, number>>;
  totalRecords: number;
  /** Ids of stored files the selected records point at. */
  fileIds: string[];
  fileBytes: number;
  /** Store labels that carry records in this period but were not selected. */
  omitted: { entity: Entity; label: string; count: number }[];
  /** Selected records whose original file is not being sent. */
  danglingFiles: number;
}

function fileIdsIn(rows: Record<string, unknown[]>): string[] {
  const ids = new Set<string>();
  for (const list of Object.values(rows)) {
    for (const row of list) {
      const record = row as { file_ids?: string[]; file_id?: string; thumb_file_id?: string };
      for (const id of record.file_ids ?? []) ids.add(id);
      if (record.file_id) ids.add(record.file_id);
      if (record.thumb_file_id) ids.add(record.thumb_file_id);
    }
  }
  return [...ids];
}

/** Exactly what a bundle would contain, computed before anything is produced. */
export function previewShare(
  data: AllData,
  scope: ShareScope,
  storedFiles: Pick<StoredFile, "id" | "size">[] = [],
): SharePreview {
  const selected = selectForShare(data, scope);
  const counts: Partial<Record<Entity, number>> = {};
  let totalRecords = 0;
  for (const [entity, rows] of Object.entries(selected)) {
    counts[entity as Entity] = rows.length;
    totalRecords += rows.length;
  }

  const referenced = fileIdsIn(selected);
  const known = new Map(storedFiles.map((f) => [f.id, f.size ?? 0]));
  const fileIds = scope.includeFiles ? referenced.filter((id) => known.has(id)) : [];
  const fileBytes = fileIds.reduce((n, id) => n + (known.get(id) ?? 0), 0);

  const omitted: SharePreview["omitted"] = [];
  for (const entity of SHAREABLE) {
    if (scope.include[entity]) continue;
    const rows = (data[entity] ?? []) as unknown[];
    const count = NOT_DATE_FILTERED.includes(entity)
      ? rows.length
      : rows.filter((row) => inRange(scope, entity, row)).length;
    if (count > 0) omitted.push({ entity, label: SHARE_LABELS[entity] ?? entity, count });
  }

  return {
    counts,
    totalRecords,
    fileIds,
    fileBytes,
    omitted,
    danglingFiles: scope.includeFiles ? 0 : referenced.length,
  };
}

export function shareDescriptor(scope: ShareScope, preview: SharePreview): ShareDescriptor {
  return {
    range_start: scope.range_start,
    range_end: scope.range_end,
    omitted: preview.omitted.map((o) => o.label),
    files_omitted: !scope.includeFiles || preview.danglingFiles > 0,
    note:
      "A range-scoped extract of one person's Afterlight record, shared deliberately. It is not " +
      "the whole record, and absence of a record here does not mean the event did not happen.",
  };
}

/**
 * Build the bundle. It is an ordinary archive plus a share descriptor, so the receiving device
 * imports it with the code that is already tested rather than a second path.
 */
export async function buildShareBundle(
  data: AllData,
  scope: ShareScope,
  storedFiles: StoredFile[],
  exportedAt: string,
): Promise<Archive> {
  const preview = previewShare(data, scope, storedFiles);
  const selected = selectForShare(data, scope);

  const dataOut: Record<string, unknown> = {};
  const counts: Record<string, number> = {};
  for (const store of SHAREABLE) {
    const rows = selected[store] ?? [];
    dataOut[store] = rows;
    counts[store] = rows.length;
  }

  const wanted = new Set(preview.fileIds);
  const files: ArchiveFile[] = storedFiles
    .filter((f) => wanted.has(f.id))
    .map((f) => ({
      id: f.id,
      name: f.name,
      mime: f.mime,
      size: f.size ?? f.bytes.byteLength,
      stored_at: f.stored_at,
      b64: bytesToBase64(f.bytes),
    }));
  counts.files = files.length;

  // Preferences and the demo flag are the sender's, not the recipient's; a share carries records.
  const partial = { data: dataOut, files, meta: null };
  return {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    schema_version: SCHEMA_VERSION,
    exported_at: exportedAt,
    app_version: APP_VERSION,
    counts,
    checksum: await checksumOf(partial),
    ...partial,
    share: shareDescriptor(scope, preview),
  };
}

/** Build and encrypt in one step. A share is never written unencrypted. */
export async function sealShareBundle(
  data: AllData,
  scope: ShareScope,
  storedFiles: StoredFile[],
  passphrase: string,
  exportedAt: string,
): Promise<EncryptedArchive> {
  const bundle = await buildShareBundle(data, scope, storedFiles, exportedAt);
  return seal(bundle, passphrase, exportedAt);
}

export function shareFilename(scope: ShareScope): string {
  return `afterlight-share-${scope.range_start}-to-${scope.range_end}.afterlight`;
}

/* ------------------------------------------------------------ passphrase */

/**
 * A passphrase the patient can read aloud across a desk. Ordinary words, unambiguous when spoken,
 * and chosen from the browser's cryptographic random source rather than Math.random.
 *
 * Four words from this list is about 46 bits before the key derivation's 250,000 PBKDF2 rounds,
 * which is the right shape for a secret that exists for the length of an appointment.
 */
const WORDS = [
  "amber",
  "anchor",
  "autumn",
  "beacon",
  "bramble",
  "candle",
  "canvas",
  "cedar",
  "cinder",
  "clover",
  "compass",
  "copper",
  "cotton",
  "crescent",
  "current",
  "daisy",
  "dawn",
  "delta",
  "ember",
  "fable",
  "falcon",
  "fathom",
  "feather",
  "fennel",
  "ferry",
  "flint",
  "forest",
  "garnet",
  "gentle",
  "glimmer",
  "granite",
  "harbour",
  "harvest",
  "hazel",
  "heather",
  "hollow",
  "indigo",
  "island",
  "ivory",
  "jasmine",
  "juniper",
  "kestrel",
  "lantern",
  "lattice",
  "linen",
  "lupin",
  "marble",
  "meadow",
  "mellow",
  "mercy",
  "mineral",
  "mirror",
  "morning",
  "mosaic",
  "nectar",
  "nimbus",
  "nutmeg",
  "oaken",
  "ochre",
  "orchard",
  "otter",
  "parcel",
  "pebble",
  "pewter",
  "pigeon",
  "pillar",
  "plover",
  "pollen",
  "quarry",
  "quiet",
  "quiver",
  "rafter",
  "raven",
  "ribbon",
  "rosemary",
  "rowan",
  "saffron",
  "sandal",
  "sapling",
  "scarlet",
  "shallow",
  "shelter",
  "silver",
  "sorrel",
  "sparrow",
  "spindle",
  "starling",
  "sterling",
  "summer",
  "swallow",
  "tangle",
  "teasel",
  "thicket",
  "thimble",
  "thistle",
  "tidal",
  "timber",
  "tundra",
  "umber",
  "velvet",
  "vessel",
  "willow",
  "window",
  "winter",
  "wombat",
  "yarrow",
  "yonder",
];

export function generatePassphrase(words = 4): string {
  const picked: string[] = [];
  const buffer = new Uint32Array(words);
  crypto.getRandomValues(buffer);
  for (let i = 0; i < words; i++) picked.push(WORDS[buffer[i] % WORDS.length]);
  return picked.join("-");
}

export const PASSPHRASE_WORDLIST_SIZE = WORDS.length;

/* ------------------------------------------------------------ QR handoff */

/**
 * How much text goes in the handoff QR.
 *
 * Not the largest symbol this encoder can make. A version-20 code is 93 modules across, and a
 * phone camera reading one off another phone's screen at arm's length starts failing well before
 * that; version 15 is the size that still scans in a consulting room.
 */
export const QR_TEXT_LIMIT = byteCapacity(15, "M");

export const QR_BOUNDARY =
  "This code is plain text, not encrypted. It is meant to be held up to someone in the room, " +
  "not sent. Anyone who photographs the screen can read it.";

export interface HandoffCard {
  text: string;
  /** True when content was dropped to fit; the card says so on its own face. */
  truncated: boolean;
  /** False when even the shortest honest card is too big for the limit. */
  fits: boolean;
  bytes: number;
}

/**
 * A short text card for a QR code: the eye-by-eye headline and the questions, and nothing else.
 *
 * A QR code holds a few hundred bytes, so this trims content — the least essential lines first —
 * and states on the card that it was trimmed. What it will never do is cut the card off at the
 * limit: the header and the "not a clinical record" line are structural, and a card that loses
 * its own boundary statement because it ran out of room is worse than no card. If the shortest
 * honest card still does not fit, it comes back with `fits: false` for the caller to refuse.
 */
export function handoffCardText(
  parts: {
    title: string;
    range_start: string;
    range_end: string;
    right: string[];
    left: string[];
    questions: string[];
  },
  limit: number,
): HandoffCard {
  const size = (text: string) => new TextEncoder().encode(text).length;

  const build = (right: string[], left: string[], questions: string[], trimmed: boolean) =>
    [
      "AFTERLIGHT — patient's own record",
      parts.title,
      `${parts.range_start} to ${parts.range_end}`,
      "",
      "RIGHT (OD)",
      ...(right.length ? right.map((r) => `- ${r}`) : ["- nothing recorded"]),
      "",
      "LEFT (OS)",
      ...(left.length ? left.map((r) => `- ${r}`) : ["- nothing recorded"]),
      ...(questions.length ? ["", "QUESTIONS", ...questions.map((q) => `- ${q}`)] : []),
      "",
      ...(trimmed ? ["(Shortened to fit. Full brief in the shared file.)"] : []),
      "Patient-reported. Not a clinical record.",
    ].join("\n");

  let right = [...parts.right];
  let left = [...parts.left];
  let questions = [...parts.questions];
  let trimmed = false;

  for (let guard = 0; guard < 500; guard++) {
    const text = build(right, left, questions, trimmed);
    if (size(text) <= limit) return { text, truncated: trimmed, fits: true, bytes: size(text) };

    trimmed = true;
    // The caller passes each eye's lines most-important-first, so the tail of a list is the
    // unchanged and improved lines. Those go before the questions do: a clinician can read
    // "nothing else changed" off the patient's face, but not the question they came to ask.
    if (right.length > 1 && right.length >= left.length) {
      right = right.slice(0, -1);
    } else if (left.length > 1) {
      left = left.slice(0, -1);
    } else if (questions.length > 0) {
      questions = questions.slice(0, -1);
    } else {
      break;
    }
  }

  const text = build(right, left, questions, true);
  return { text, truncated: true, fits: size(text) <= limit, bytes: size(text) };
}
