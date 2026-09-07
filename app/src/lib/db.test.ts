import { beforeEach, describe, expect, it } from "vitest";
import {
  STORES,
  dbClear,
  dbDelete,
  dbGet,
  dbGetAll,
  dbPut,
  dbPutMany,
  getStoredFile,
  loadAllData,
  loadMigrated,
  storedFileToBlob,
} from "./db";
import { SCHEMA_VERSION } from "./migrations";
import type { FloaterObject, StoredFile } from "./models";
import { aDrawing, aFloater, anImaging, aSymptom } from "../test/factories";

beforeEach(async () => {
  for (const store of STORES) await dbClear(store);
});

describe("record round trip", () => {
  it("stores and reads a record unchanged", async () => {
    const symptom = aSymptom({ description: "One new dark dot, slightly right of centre" });
    await dbPut("symptoms", symptom);
    expect(await dbGet("symptoms", symptom.id)).toEqual(symptom);
  });

  it("writes many records in one call", async () => {
    await dbPutMany("symptoms", [aSymptom(), aSymptom(), aSymptom()]);
    expect(await dbGetAll("symptoms")).toHaveLength(3);
  });

  it("deletes only the named record", async () => {
    const keep = aSymptom();
    const drop = aSymptom();
    await dbPutMany("symptoms", [keep, drop]);
    await dbDelete("symptoms", drop.id);
    const left = await dbGetAll<{ id: string }>("symptoms");
    expect(left.map((r) => r.id)).toEqual([keep.id]);
  });
});

describe("stored files", () => {
  it("round-trips the file's identity and type", async () => {
    const file: StoredFile = {
      id: "file-1",
      name: "oct.png",
      mime: "image/png",
      bytes: new Uint8Array([137, 80, 78, 71]).buffer,
      size: 4,
      stored_at: "2026-06-01T09:00:00Z",
    };
    await dbPut("files", file);

    const back = await getStoredFile("file-1");
    expect(back).toBeDefined();
    expect(back!.name).toBe("oct.png");
    expect(back!.mime).toBe("image/png");
  });

  // Phase 00 could not assert this at all: fake-indexeddb drops a jsdom Blob in its structured
  // clone. Storing bytes instead of a Blob makes the patient's scans and letters — the least
  // replaceable part of the record — verifiable in CI.
  it("round-trips the payload byte for byte", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 128]);
    await dbPut("files", {
      id: "file-2",
      name: "oct.png",
      mime: "image/png",
      bytes: bytes.buffer,
      size: bytes.byteLength,
      stored_at: "2026-06-01T09:00:00Z",
    });
    const back = await getStoredFile("file-2");
    expect(Array.from(new Uint8Array(back!.bytes))).toEqual(Array.from(bytes));
    expect(back!.size).toBe(bytes.byteLength);
  });

  it("rebuilds a usable Blob from the stored bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const stored = {
      id: "file-3",
      name: "letter.pdf",
      mime: "application/pdf",
      bytes: bytes.buffer,
      size: 4,
      stored_at: "2026-06-01T09:00:00Z",
    };
    await dbPut("files", stored);
    const blob = storedFileToBlob((await getStoredFile("file-3"))!);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBe(4);
  });
});

describe("loadAllData", () => {
  it("returns empty lists rather than undefined for a fresh record", async () => {
    const data = await loadAllData();
    expect(data.symptoms).toEqual([]);
    expect(data.imaging).toEqual([]);
    expect(data.meta).toBeUndefined();
  });

  it("loads every slice it stored", async () => {
    await dbPut("symptoms", aSymptom());
    await dbPut("drawings", aDrawing());
    await dbPut("imaging", anImaging());
    const data = await loadAllData();
    expect(data.symptoms).toHaveLength(1);
    expect(data.drawings).toHaveLength(1);
    expect(data.imaging).toHaveLength(1);
  });

  it("returns records exactly as stored, without patching them on read", async () => {
    // Read is a read. Fixing old shapes is migration's job, and it happens once, on write.
    const legacy = { ...aFloater() } as Partial<FloaterObject>;
    delete legacy.source_type;
    await dbPut("floaters", legacy);

    const data = await loadAllData();
    expect(data.floaters[0].source_type).toBeUndefined();
  });
});

describe("loadMigrated", () => {
  it("upgrades a version 1 record and records the new version", async () => {
    const legacy = { ...aFloater() } as Partial<FloaterObject>;
    delete legacy.source_type;
    await dbPut("floaters", legacy);
    await dbPut("meta", { id: "meta", onboarded: true, theme: "dark", demo_seeded: false });

    const data = await loadMigrated();
    expect(data.floaters[0].source_type).toBe("patient_reported");
    expect(data.meta?.schema_version).toBe(SCHEMA_VERSION);
    expect(data.migrated?.length).toBeGreaterThan(0);
  });

  it("keeps a pre-migration snapshot so the upgrade is not a one-way door", async () => {
    await dbPut("floaters", { ...aFloater(), source_type: undefined });
    await dbPut("meta", { id: "meta", onboarded: true, theme: "dark", demo_seeded: false });
    await loadMigrated();

    const backups = await dbGetAll<{ from_version: number; data: unknown }>("backups");
    expect(backups).toHaveLength(1);
    expect(backups[0].from_version).toBe(1);
    expect(backups[0].data).toBeTruthy();
  });

  it("does nothing to a record already at the current version", async () => {
    await dbPut("meta", {
      id: "meta",
      onboarded: true,
      theme: "dark",
      demo_seeded: false,
      schema_version: SCHEMA_VERSION,
    });
    await dbPut("floaters", aFloater({ source_type: "clinician_reported" }));

    const data = await loadMigrated();
    expect(data.migrated).toBeUndefined();
    expect(data.floaters[0].source_type).toBe("clinician_reported");
    expect(await dbGetAll("backups")).toHaveLength(0);
  });
});
