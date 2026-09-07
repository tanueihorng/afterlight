// Tiny promise wrapper over IndexedDB. All Afterlight records live locally in the browser.

import {
  migrate,
  materialiseFiles,
  schemaVersionOf,
  SCHEMA_VERSION,
  type LegacyOrCurrentFile,
  type Snapshot,
} from "./migrations";
import type {
  AppMeta,
  Appointment,
  DailyLog,
  Diagnosis,
  DoctorQuestion,
  DocumentRecord,
  EyeBaseline,
  FloaterObject,
  GeneratedBrief,
  ImagingRecord,
  Medication,
  Measurement,
  Prescription,
  Procedure,
  StoredFile,
  SymptomEntry,
  VisualFieldDrawing,
} from "./models";

export const DB_NAME = "afterlight";
export const DB_VERSION = 2;

export const STORES = [
  "symptoms",
  "dailyLogs",
  "floaters",
  "drawings",
  "appointments",
  "questions",
  "diagnoses",
  "procedures",
  "medications",
  "prescriptions",
  "measurements",
  "imaging",
  "documents",
  "files",
  "baselines",
  "briefs",
  "meta",
  // Pre-migration snapshots, so a schema upgrade is never a one-way door.
  "backups",
] as const;

export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export const dbGetAll = <T>(store: StoreName) => tx<T[]>(store, "readonly", (s) => s.getAll());
export const dbGet = <T>(store: StoreName, id: string) =>
  tx<T | undefined>(store, "readonly", (s) => s.get(id));
export const dbPut = <T>(store: StoreName, value: T) =>
  tx<IDBValidKey>(store, "readwrite", (s) => s.put(value as unknown as object));
export const dbDelete = (store: StoreName, id: string) =>
  tx<undefined>(store, "readwrite", (s) => s.delete(id));
export const dbClear = (store: StoreName) => tx<undefined>(store, "readwrite", (s) => s.clear());

export async function dbPutMany<T>(store: StoreName, values: T[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, "readwrite");
    const os = t.objectStore(store);
    for (const v of values) os.put(v as unknown as object);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export interface AllData {
  symptoms: SymptomEntry[];
  dailyLogs: DailyLog[];
  floaters: FloaterObject[];
  drawings: VisualFieldDrawing[];
  appointments: Appointment[];
  questions: DoctorQuestion[];
  diagnoses: Diagnosis[];
  procedures: Procedure[];
  medications: Medication[];
  prescriptions: Prescription[];
  measurements: Measurement[];
  imaging: ImagingRecord[];
  documents: DocumentRecord[];
  baselines: EyeBaseline[];
  briefs: GeneratedBrief[];
}

const EMPTY_DATA: AllData = {
  symptoms: [],
  dailyLogs: [],
  floaters: [],
  drawings: [],
  appointments: [],
  questions: [],
  diagnoses: [],
  procedures: [],
  medications: [],
  prescriptions: [],
  measurements: [],
  imaging: [],
  documents: [],
  baselines: [],
  briefs: [],
};

export async function loadAllData(): Promise<AllData & { meta?: AppMeta }> {
  const [data, metaAll] = await Promise.all([
    (async () => ({
      symptoms: await dbGetAll<SymptomEntry>("symptoms"),
      dailyLogs: await dbGetAll<DailyLog>("dailyLogs"),
      floaters: await dbGetAll<FloaterObject>("floaters"),
      drawings: await dbGetAll<VisualFieldDrawing>("drawings"),
      appointments: await dbGetAll<Appointment>("appointments"),
      questions: await dbGetAll<DoctorQuestion>("questions"),
      diagnoses: await dbGetAll<Diagnosis>("diagnoses"),
      procedures: await dbGetAll<Procedure>("procedures"),
      medications: await dbGetAll<Medication>("medications"),
      prescriptions: await dbGetAll<Prescription>("prescriptions"),
      measurements: await dbGetAll<Measurement>("measurements"),
      imaging: await dbGetAll<ImagingRecord>("imaging"),
      documents: await dbGetAll<DocumentRecord>("documents"),
      baselines: await dbGetAll<EyeBaseline>("baselines"),
      briefs: await dbGetAll<GeneratedBrief>("briefs"),
    }))(),
    dbGetAll<AppMeta>("meta"),
  ]);
  return { ...data, meta: metaAll[0] };
}

/** Write many records across many stores in a single transaction — all of it, or none of it. */
export async function dbWriteSnapshot(
  entries: { store: StoreName; values: unknown[]; clearFirst?: boolean }[],
): Promise<void> {
  const db = await openDB();
  const stores = Array.from(new Set(entries.map((e) => e.store)));
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, "readwrite");
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error("write aborted"));
    for (const entry of entries) {
      const store = t.objectStore(entry.store);
      if (entry.clearFirst) store.clear();
      for (const value of entry.values) store.put(value as object);
    }
  });
}

export async function getStoredFile(id: string): Promise<StoredFile | undefined> {
  return dbGet<StoredFile>("files", id);
}

export async function fileToStoredFile(file: File): Promise<StoredFile> {
  const bytes = await file.arrayBuffer();
  return {
    id: crypto.randomUUID(),
    name: file.name,
    mime: file.type || "application/octet-stream",
    bytes,
    size: bytes.byteLength,
    stored_at: new Date().toISOString(),
  };
}

export class StorageFullError extends Error {
  constructor(public readonly bytes: number) {
    super("There is not enough room on this device to store that file.");
    this.name = "StorageFullError";
  }
}

/**
 * Save an uploaded file, turning the browser's quota error into something a person can act on.
 * A silent failure here means a scan the patient believes is saved and is not.
 */
export async function saveStoredFile(file: StoredFile): Promise<void> {
  try {
    await dbPut("files", file);
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
      throw new StorageFullError(file.size);
    }
    throw e;
  }
}

/** Rebuild a Blob for display or download. The stored form is always bytes. */
export function storedFileToBlob(f: StoredFile): Blob {
  return new Blob([f.bytes], { type: f.mime || "application/octet-stream" });
}

/** An object URL for a stored file. Callers must revoke it. */
export function storedFileURL(f: StoredFile): string {
  return URL.createObjectURL(storedFileToBlob(f));
}

export { EMPTY_DATA };

/**
 * Load the record, bringing it up to the current schema first.
 *
 * Migration writes a pre-migration snapshot into `backups` before changing anything, then applies
 * every step in one transaction. If a migration throws, the stored record is left exactly as it
 * was and the error surfaces — a half-migrated eye record is worse than an un-migrated one.
 */
export async function loadMigrated(): Promise<AllData & { meta?: AppMeta; migrated?: string[] }> {
  const [data, metaAll, files] = await Promise.all([
    loadAllData(),
    dbGetAll<AppMeta>("meta"),
    dbGetAll<LegacyOrCurrentFile>("files"),
  ]);
  const meta = metaAll[0];
  const from = schemaVersionOf(meta);
  if (from >= SCHEMA_VERSION) return data;

  const before: Snapshot = { data, files, meta };
  const result = migrate(before, from);
  const materialised = await materialiseFiles(result.snapshot.files);

  await dbPut("backups", {
    id: `pre-migration-v${from}-${new Date().toISOString()}`,
    created_at: new Date().toISOString(),
    from_version: from,
    to_version: result.to,
    // Records only: file payloads stay where they are, since migrations never delete them.
    data: before.data,
    meta: before.meta ?? null,
  });

  await dbWriteSnapshot([
    { store: "floaters", values: result.snapshot.data.floaters, clearFirst: true },
    { store: "files", values: materialised, clearFirst: true },
    {
      store: "meta",
      values: [result.snapshot.meta ?? { id: "meta", onboarded: false, theme: "dark", demo_seeded: false, schema_version: SCHEMA_VERSION }],
    },
  ]);

  const reloaded = await loadAllData();
  return { ...reloaded, migrated: result.applied.map((m) => m.describe) };
}
