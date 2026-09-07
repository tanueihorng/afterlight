// Schema migrations.
//
// A shape change without a migration is data loss for anyone who already has records, so every
// change to a stored record goes through here. Migrations are pure functions over a snapshot,
// which makes them testable, and they run inside one transaction after a pre-migration snapshot
// has been written — a schema upgrade must never be a one-way door.

import type { AllData } from "./db";
import type { AppMeta, FloaterObject, StoredFile } from "./models";

/** Bump this whenever a migration is added. */
export const SCHEMA_VERSION = 3;

export interface Snapshot {
  data: AllData;
  files: LegacyOrCurrentFile[];
  meta?: AppMeta;
}

/** A stored file as it may exist on disk from any released version. */
export type LegacyOrCurrentFile =
  | StoredFile
  | {
      id: string;
      name: string;
      mime: string;
      blob?: Blob;
      bytes?: ArrayBuffer;
      size?: number;
      stored_at?: string;
    };

export interface Migration {
  from: number;
  to: number;
  /** Shown in the migration log so a person can see what happened to their record. */
  describe: string;
  migrate(s: Snapshot): Snapshot;
}

export const MIGRATIONS: Migration[] = [
  {
    from: 1,
    to: 2,
    describe: "Record the source of every floater (they have always been patient-reported).",
    migrate: (s) => ({
      ...s,
      data: {
        ...s.data,
        floaters: s.data.floaters.map((f: FloaterObject) =>
          f.source_type ? f : { ...f, source_type: "patient_reported" as const },
        ),
      },
    }),
  },
  {
    from: 2,
    to: 3,
    describe: "Store uploaded files as bytes rather than Blobs, and record their size.",
    migrate: (s) => ({
      ...s,
      files: s.files.map((f) => {
        const anyFile = f as { bytes?: ArrayBuffer; size?: number; stored_at?: string };
        if (anyFile.bytes) {
          return {
            ...f,
            size: anyFile.size ?? anyFile.bytes.byteLength,
            stored_at: anyFile.stored_at ?? new Date().toISOString(),
          } as StoredFile;
        }
        // A Blob cannot be converted synchronously; mark it for the async pass below.
        return f;
      }),
    }),
  },
];

/** The version a record is at, defaulting to 1 for anything written before versioning existed. */
export function schemaVersionOf(meta?: AppMeta): number {
  return meta?.schema_version ?? 1;
}

export function migrationsFor(fromVersion: number): Migration[] {
  return MIGRATIONS.filter((m) => m.from >= fromVersion).sort((a, b) => a.from - b.from);
}

export interface MigrationResult {
  snapshot: Snapshot;
  applied: Migration[];
  from: number;
  to: number;
}

/**
 * Apply every migration needed to bring a snapshot to the current schema version.
 * Pure: it returns a new snapshot and never touches storage.
 */
export function migrate(snapshot: Snapshot, fromVersion = schemaVersionOf(snapshot.meta)): MigrationResult {
  const applied: Migration[] = [];
  let current = snapshot;
  let version = fromVersion;

  for (const migration of migrationsFor(fromVersion)) {
    if (migration.from !== version) continue;
    current = migration.migrate(current);
    applied.push(migration);
    version = migration.to;
  }

  const meta: AppMeta | undefined = current.meta
    ? { ...current.meta, schema_version: SCHEMA_VERSION }
    : undefined;

  return { snapshot: { ...current, meta }, applied, from: fromVersion, to: version };
}

/**
 * The one part of migration that cannot be pure: reading Blob payloads written by versions before
 * files were stored as bytes. Run after `migrate`, before writing back.
 */
export async function materialiseFiles(files: LegacyOrCurrentFile[]): Promise<StoredFile[]> {
  const out: StoredFile[] = [];
  for (const f of files) {
    const candidate = f as {
      id: string;
      name: string;
      mime: string;
      blob?: Blob;
      bytes?: ArrayBuffer;
      size?: number;
      stored_at?: string;
    };
    if (candidate.bytes) {
      out.push({
        id: candidate.id,
        name: candidate.name,
        mime: candidate.mime,
        bytes: candidate.bytes,
        size: candidate.size ?? candidate.bytes.byteLength,
        stored_at: candidate.stored_at ?? new Date().toISOString(),
      });
      continue;
    }
    if (candidate.blob && typeof candidate.blob.arrayBuffer === "function") {
      const bytes = await candidate.blob.arrayBuffer();
      out.push({
        id: candidate.id,
        name: candidate.name,
        mime: candidate.mime || candidate.blob.type || "application/octet-stream",
        bytes,
        size: bytes.byteLength,
        stored_at: candidate.stored_at ?? new Date().toISOString(),
      });
      continue;
    }
    // Neither form is readable. Keep the record with an empty payload rather than dropping it
    // silently — a file entry the patient can see and re-upload beats a file that vanished.
    out.push({
      id: candidate.id,
      name: candidate.name,
      mime: candidate.mime || "application/octet-stream",
      bytes: new ArrayBuffer(0),
      size: 0,
      stored_at: candidate.stored_at ?? new Date().toISOString(),
    });
  }
  return out;
}
