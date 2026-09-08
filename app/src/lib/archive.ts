// Reading the whole record out to a single file, and putting it back.
//
// This is the only thing standing between a patient and losing years of entries to a cleared
// browser, so it is deliberately conservative: everything is versioned, counted and checksummed,
// an import is previewed before it writes, and encryption is available but never assumed.
//
// It reads IndexedDB directly rather than the React store, so it still works when the UI has
// crashed — the error boundary offers it at exactly that moment.

import {
  STORES,
  dbGetAll,
  dbWriteSnapshot,
  type AllData,
  type StoreName,
} from "./db";
import { SCHEMA_VERSION, materialiseFiles, migrate, type Snapshot } from "./migrations";
import type { AppMeta, StoredFile } from "./models";
import { nowISO } from "./util";

export const ARCHIVE_FORMAT = "afterlight-archive";
export const ARCHIVE_VERSION = 2;
export const APP_VERSION = "0.2.0";

/** Record stores, in the order an archive lists them. `files` and `meta` are handled separately. */
const RECORD_STORES = STORES.filter(
  (s) => s !== "files" && s !== "meta" && s !== "backups",
) as readonly StoreName[];

export interface ArchiveFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  stored_at?: string;
  /** Base64 of the raw bytes — no data-URL prefix. */
  b64: string;
}

/**
 * What a shared extract says about itself. Present only on a bundle built for someone else, so
 * both ends can see that this is a slice of a record rather than the record.
 */
export interface ShareDescriptor {
  range_start: string;
  range_end: string;
  /** Stores deliberately left out, named so the recipient is not guessing. */
  omitted: string[];
  /** True when original scans and documents were not included. */
  files_omitted: boolean;
  note: string;
}

export interface Archive {
  format: typeof ARCHIVE_FORMAT;
  version: number;
  schema_version: number;
  exported_at: string;
  app_version: string;
  counts: Record<string, number>;
  checksum: string;
  data: Record<string, unknown>;
  files: ArchiveFile[];
  meta?: AppMeta | null;
  /** Set when this file is a range-scoped extract rather than a whole export. */
  share?: ShareDescriptor;
}

export interface EncryptedArchive {
  format: typeof ARCHIVE_FORMAT;
  version: number;
  encrypted: true;
  encryption: { kdf: "PBKDF2-SHA256"; iterations: number; salt: string; iv: string };
  exported_at: string;
  /** Base64 ciphertext of the JSON archive. */
  payload: string;
}

/* ------------------------------------------------------------------ bytes */

export function bytesToBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  const CHUNK = 0x8000; // avoid blowing the argument limit on large scans
  for (let i = 0; i < view.length; i += CHUNK) {
    binary += String.fromCharCode(...view.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out.buffer;
}

/* ------------------------------------------------------------- checksumming */

/** Stable stringify: key order must not change a checksum. */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJSON(v)}`).join(",")}}`;
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return `sha256-${bytesToBase64(digest)}`;
}

function payloadOf(archive: Pick<Archive, "data" | "files" | "meta">) {
  return { data: archive.data, files: archive.files, meta: archive.meta ?? null };
}

export async function checksumOf(archive: Pick<Archive, "data" | "files" | "meta">): Promise<string> {
  return sha256(canonicalJSON(payloadOf(archive)));
}

/* ---------------------------------------------------------------- building */

export async function buildArchive(): Promise<Archive> {
  const data: Record<string, unknown> = {};
  const counts: Record<string, number> = {};
  for (const store of RECORD_STORES) {
    const rows = await dbGetAll<unknown>(store);
    data[store] = rows;
    counts[store] = rows.length;
  }

  const storedFiles = await dbGetAll<StoredFile>("files");
  const files: ArchiveFile[] = storedFiles.map((f) => ({
    id: f.id,
    name: f.name,
    mime: f.mime,
    size: f.size ?? f.bytes.byteLength,
    stored_at: f.stored_at,
    b64: bytesToBase64(f.bytes),
  }));
  counts.files = files.length;

  const meta = (await dbGetAll<AppMeta>("meta"))[0] ?? null;

  const partial = { data, files, meta };
  return {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    schema_version: meta?.schema_version ?? SCHEMA_VERSION,
    exported_at: nowISO(),
    app_version: APP_VERSION,
    counts,
    checksum: await checksumOf(partial),
    ...partial,
  };
}

export function archiveFilename(now = nowISO(), encrypted = false): string {
  return `afterlight-export-${now.slice(0, 10)}${encrypted ? ".encrypted" : ""}.json`;
}

function download(text: string, filename: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Build the archive and hand it to the browser as a download. */
export async function downloadArchive(passphrase?: string): Promise<Archive> {
  const archive = await buildArchive();
  if (passphrase) {
    const sealed = await encryptArchive(archive, passphrase);
    download(JSON.stringify(sealed), archiveFilename(archive.exported_at, true));
  } else {
    download(JSON.stringify(archive, null, 2), archiveFilename(archive.exported_at));
  }
  return archive;
}

/* -------------------------------------------------------------- encryption */

const KDF_ITERATIONS = 250_000;

async function deriveKey(passphrase: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: KDF_ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Seal any JSON value into the archive envelope. Shared extracts use the same envelope as a whole
 * export deliberately: one encryption path, one set of parameters, one thing to get right.
 */
export async function seal(value: unknown, passphrase: string, exportedAt: string): Promise<EncryptedArchive> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt.buffer);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    encrypted: true,
    encryption: {
      kdf: "PBKDF2-SHA256",
      iterations: KDF_ITERATIONS,
      salt: bytesToBase64(salt.buffer),
      iv: bytesToBase64(iv.buffer),
    },
    exported_at: exportedAt,
    payload: bytesToBase64(ciphertext),
  };
}

export async function encryptArchive(
  archive: Archive,
  passphrase: string,
): Promise<EncryptedArchive> {
  return seal(archive, passphrase, archive.exported_at);
}

export class WrongPassphrase extends Error {
  constructor() {
    super("That passphrase does not open this archive.");
    this.name = "WrongPassphrase";
  }
}

export async function decryptArchive(
  sealed: EncryptedArchive,
  passphrase: string,
): Promise<Archive> {
  const key = await deriveKey(passphrase, base64ToBytes(sealed.encryption.salt));
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(base64ToBytes(sealed.encryption.iv)) },
      key,
      base64ToBytes(sealed.payload),
    );
    return JSON.parse(new TextDecoder().decode(plain)) as Archive;
  } catch {
    throw new WrongPassphrase();
  }
}

export function isEncryptedArchive(value: unknown): value is EncryptedArchive {
  return !!value && typeof value === "object" && (value as EncryptedArchive).encrypted === true;
}

/* ------------------------------------------------------------- inspection */

export interface ArchiveSummary {
  valid: boolean;
  problems: string[];
  encrypted: boolean;
  exported_at?: string;
  schema_version?: number;
  needsMigrationFrom?: number;
  counts: Record<string, number>;
  totalRecords: number;
  fileCount: number;
  fileBytes: number;
  earliest?: string;
  latest?: string;
  checksumOk?: boolean;
  /** Present when the file is a range-scoped extract someone shared, not a whole export. */
  share?: ShareDescriptor;
}

const DATE_FIELDS = ["date", "date_time", "first_documented", "first_seen", "start_date", "created_at"];

function datesIn(rows: unknown[]): string[] {
  const out: string[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    for (const field of DATE_FIELDS) {
      const v = (row as Record<string, unknown>)[field];
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
        out.push(v.slice(0, 10));
        break;
      }
    }
  }
  return out;
}

/** Validate and describe an archive without importing anything. */
export async function inspectArchive(parsed: unknown): Promise<ArchiveSummary> {
  const problems: string[] = [];
  const empty: ArchiveSummary = {
    valid: false,
    problems,
    encrypted: false,
    counts: {},
    totalRecords: 0,
    fileCount: 0,
    fileBytes: 0,
  };

  if (!parsed || typeof parsed !== "object") {
    problems.push("This file is not readable as an Afterlight archive.");
    return empty;
  }
  if (isEncryptedArchive(parsed)) {
    return { ...empty, encrypted: true, valid: true, exported_at: parsed.exported_at, problems: [] };
  }

  const a = parsed as Partial<Archive> & { app?: string };
  // Version 1 archives used { app: "afterlight" }; accept them.
  const looksLikeV1 = a.app === "afterlight" && !!a.data;
  if (a.format !== ARCHIVE_FORMAT && !looksLikeV1) {
    problems.push("This file is not an Afterlight archive.");
    return empty;
  }

  const data = (a.data ?? {}) as Record<string, unknown>;
  const files = (a.files ?? (data.files as ArchiveFile[]) ?? []) as ArchiveFile[];
  const counts: Record<string, number> = {};
  let total = 0;
  const dates: string[] = [];

  for (const store of RECORD_STORES) {
    const rows = Array.isArray(data[store]) ? (data[store] as unknown[]) : [];
    counts[store] = rows.length;
    total += rows.length;
    dates.push(...datesIn(rows));
  }
  dates.sort();

  let checksumOk: boolean | undefined;
  if (a.checksum) {
    const recomputed = await checksumOf({
      data: a.data as Record<string, unknown>,
      files: files,
      meta: (a.meta ?? null) as AppMeta | null,
    });
    checksumOk = recomputed === a.checksum;
    if (!checksumOk) {
      problems.push(
        "This archive's contents do not match its checksum — the file may be damaged or edited.",
      );
    }
  }

  const schema_version = a.schema_version ?? 1;

  return {
    valid: problems.length === 0,
    problems,
    encrypted: false,
    exported_at: a.exported_at,
    schema_version,
    needsMigrationFrom: schema_version < SCHEMA_VERSION ? schema_version : undefined,
    counts: { ...counts, files: files.length },
    totalRecords: total,
    fileCount: files.length,
    fileBytes: files.reduce((n, f) => n + (f.size ?? 0), 0),
    earliest: dates[0],
    latest: dates[dates.length - 1],
    checksumOk,
    share: a.share,
  };
}

/* ----------------------------------------------------------------- import */

export type ImportMode = "replace" | "merge";

export interface ImportResult {
  mode: ImportMode;
  added: number;
  updated: number;
  skipped: number;
  files: number;
  migrationsApplied: string[];
}

interface Identified {
  id: string;
  updated_at?: string;
}

/** Newest wins, by `updated_at`; a record with no timestamp never overwrites one that has it. */
function isNewer(incoming: Identified, existing: Identified): boolean {
  if (!incoming.updated_at) return false;
  if (!existing.updated_at) return true;
  return incoming.updated_at > existing.updated_at;
}

export async function importArchive(parsed: Archive, mode: ImportMode): Promise<ImportResult> {
  const data = (parsed.data ?? {}) as Record<string, unknown>;
  const archiveFiles = (parsed.files ?? (data.files as ArchiveFile[]) ?? []) as ArchiveFile[];
  const incomingMeta = (parsed.meta ?? (data.meta as AppMeta) ?? undefined) as AppMeta | undefined;

  // Bring the incoming record up to the current schema before it touches storage.
  const incomingData = {} as AllData;
  for (const store of RECORD_STORES) {
    (incomingData as unknown as Record<string, unknown[]>)[store] = Array.isArray(data[store])
      ? (data[store] as unknown[])
      : [];
  }
  const snapshot: Snapshot = {
    data: incomingData,
    files: archiveFiles.map((f) => ({
      id: f.id,
      name: f.name,
      mime: f.mime,
      bytes: base64ToBytes(f.b64),
      size: f.size,
      stored_at: f.stored_at,
    })),
    meta: incomingMeta,
  };
  const migrated = migrate(snapshot, parsed.schema_version ?? 1);
  const files = await materialiseFiles(migrated.snapshot.files);

  let added = 0;
  let updated = 0;
  let skipped = 0;
  const writes: { store: StoreName; values: unknown[]; clearFirst?: boolean }[] = [];

  for (const store of RECORD_STORES) {
    const incoming = ((migrated.snapshot.data as unknown as Record<string, unknown[]>)[store] ??
      []) as Identified[];
    if (mode === "replace") {
      added += incoming.length;
      writes.push({ store, values: incoming, clearFirst: true });
      continue;
    }
    const existing = await dbGetAll<Identified>(store);
    const byId = new Map(existing.map((r) => [r.id, r]));
    const toWrite: unknown[] = [];
    for (const record of incoming) {
      const current = byId.get(record.id);
      if (!current) {
        toWrite.push(record);
        added++;
      } else if (isNewer(record, current)) {
        toWrite.push(record);
        updated++;
      } else {
        skipped++;
      }
    }
    if (toWrite.length) writes.push({ store, values: toWrite });
  }

  if (mode === "replace") {
    writes.push({ store: "files", values: files, clearFirst: true });
  } else if (files.length) {
    const existingFiles = await dbGetAll<StoredFile>("files");
    const known = new Set(existingFiles.map((f) => f.id));
    const newFiles = files.filter((f) => !known.has(f.id));
    if (newFiles.length) writes.push({ store: "files", values: newFiles });
  }

  const meta: AppMeta = {
    id: "meta",
    onboarded: true,
    theme: incomingMeta?.theme ?? "dark",
    demo_seeded: incomingMeta?.demo_seeded ?? false,
    schema_version: SCHEMA_VERSION,
    last_export_at: incomingMeta?.last_export_at,
    changes_since_export: 0,
  };
  writes.push({ store: "meta", values: [meta] });

  await dbWriteSnapshot(writes);

  return {
    mode,
    added,
    updated,
    skipped,
    files: files.length,
    migrationsApplied: migrated.applied.map((m) => m.describe),
  };
}

/** Parse a file the user chose, without importing it. */
export async function readArchiveFile(file: File): Promise<unknown> {
  return JSON.parse(await file.text());
}
