// Tiny promise wrapper over IndexedDB. All Afterlight records live locally in the browser.

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
export const DB_VERSION = 1;

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

export async function getStoredFile(id: string): Promise<StoredFile | undefined> {
  return dbGet<StoredFile>("files", id);
}

export async function fileToStoredFile(file: File): Promise<StoredFile> {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    mime: file.type,
    blob: file,
  };
}

export { EMPTY_DATA };
