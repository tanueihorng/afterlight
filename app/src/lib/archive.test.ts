import { beforeEach, describe, expect, it } from "vitest";
import {
  ARCHIVE_FORMAT,
  buildArchive,
  canonicalJSON,
  checksumOf,
  decryptArchive,
  encryptArchive,
  importArchive,
  inspectArchive,
  isEncryptedArchive,
  WrongPassphrase,
  base64ToBytes,
  bytesToBase64,
  type Archive,
} from "./archive";
import { STORES, dbClear, dbGetAll, dbPut, getStoredFile } from "./db";
import { SCHEMA_VERSION } from "./migrations";
import type { StoredFile, SymptomEntry } from "./models";
import { aDrawing, aFloater, anImaging, aSymptom } from "../test/factories";

const OCT_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 128, 64]);

const storedFile = (id = "file-1"): StoredFile => ({
  id,
  name: "oct-left.png",
  mime: "image/png",
  bytes: OCT_BYTES.buffer.slice(0),
  size: OCT_BYTES.byteLength,
  stored_at: "2026-06-01T09:00:00Z",
});

async function seedRecord() {
  await dbPut("symptoms", aSymptom({ id: "s1", description: "one new dark dot" }));
  await dbPut("drawings", aDrawing({ id: "d1" }));
  await dbPut("imaging", anImaging({ id: "i1" }));
  await dbPut("floaters", aFloater({ id: "f1" }));
  await dbPut("files", storedFile());
  await dbPut("meta", {
    id: "meta",
    onboarded: true,
    theme: "dark",
    demo_seeded: false,
    schema_version: SCHEMA_VERSION,
  });
}

beforeEach(async () => {
  for (const store of STORES) await dbClear(store);
});

describe("base64", () => {
  it("round-trips arbitrary bytes, including 0 and 255", () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 254, 255]);
    expect(Array.from(new Uint8Array(base64ToBytes(bytesToBase64(bytes.buffer))))).toEqual(
      Array.from(bytes),
    );
  });

  it("handles a payload larger than one chunk", () => {
    const big = new Uint8Array(200_000).map((_, i) => i % 256);
    const back = new Uint8Array(base64ToBytes(bytesToBase64(big.buffer)));
    expect(back.byteLength).toBe(big.byteLength);
    expect(back[199_999]).toBe(big[199_999]);
  });
});

describe("canonicalJSON", () => {
  it("does not depend on key order", () => {
    expect(canonicalJSON({ b: 1, a: 2 })).toBe(canonicalJSON({ a: 2, b: 1 }));
  });

  it("distinguishes different content", () => {
    expect(canonicalJSON({ a: 1 })).not.toBe(canonicalJSON({ a: 2 }));
  });
});

describe("buildArchive", () => {
  it("carries every record, the files, counts and a checksum", async () => {
    await seedRecord();
    const archive = await buildArchive();

    expect(archive.format).toBe(ARCHIVE_FORMAT);
    expect(archive.version).toBe(2);
    expect(archive.counts.symptoms).toBe(1);
    expect(archive.counts.files).toBe(1);
    expect(archive.files[0].size).toBe(OCT_BYTES.byteLength);
    expect(archive.checksum).toMatch(/^sha256-/);
    expect(await checksumOf(archive)).toBe(archive.checksum);
  });

  it("never includes the backup snapshots store", async () => {
    await dbPut("backups", { id: "b1", created_at: "now" });
    const archive = await buildArchive();
    expect(Object.keys(archive.data)).not.toContain("backups");
  });
});

describe("inspectArchive", () => {
  it("summarises without importing", async () => {
    await seedRecord();
    const archive = await buildArchive();
    for (const store of STORES) await dbClear(store);

    const summary = await inspectArchive(archive);
    expect(summary.valid).toBe(true);
    expect(summary.checksumOk).toBe(true);
    expect(summary.totalRecords).toBe(4);
    expect(summary.fileCount).toBe(1);
    // Nothing was written.
    expect(await dbGetAll("symptoms")).toHaveLength(0);
  });

  it("rejects a file that is not an archive", async () => {
    const summary = await inspectArchive({ hello: "world" });
    expect(summary.valid).toBe(false);
    expect(summary.problems.join(" ")).toMatch(/not an Afterlight archive/i);
  });

  it("detects a tampered archive", async () => {
    await seedRecord();
    const archive = await buildArchive();
    const tampered = JSON.parse(JSON.stringify(archive)) as Archive;
    (tampered.data.symptoms as SymptomEntry[])[0].description = "edited after export";

    const summary = await inspectArchive(tampered);
    expect(summary.checksumOk).toBe(false);
    expect(summary.valid).toBe(false);
    expect(summary.problems.join(" ")).toMatch(/checksum/i);
  });

  it("accepts a version 1 archive and flags that it needs upgrading", async () => {
    const v1 = { app: "afterlight", version: 1, data: { symptoms: [aSymptom()] } };
    const summary = await inspectArchive(v1);
    expect(summary.valid).toBe(true);
    expect(summary.needsMigrationFrom).toBe(1);
    expect(summary.totalRecords).toBe(1);
  });

  it("reports the span of the record", async () => {
    await dbPut("symptoms", aSymptom({ date_time: "2026-01-05T09:00:00" }));
    await dbPut("imaging", anImaging({ date: "2026-08-24" }));
    const summary = await inspectArchive(await buildArchive());
    expect(summary.earliest).toBe("2026-01-05");
    expect(summary.latest).toBe("2026-08-24");
  });
});

describe("export → wipe → import", () => {
  it("restores every record and the file bytes exactly", async () => {
    await seedRecord();
    const archive = await buildArchive();

    for (const store of STORES) await dbClear(store);
    expect(await dbGetAll("symptoms")).toHaveLength(0);

    const result = await importArchive(archive, "replace");
    expect(result.added).toBe(4);
    expect(result.files).toBe(1);

    const symptoms = await dbGetAll<SymptomEntry>("symptoms");
    expect(symptoms[0].description).toBe("one new dark dot");

    const file = await getStoredFile("file-1");
    expect(Array.from(new Uint8Array(file!.bytes))).toEqual(Array.from(OCT_BYTES));
    expect(file!.mime).toBe("image/png");
    expect(file!.size).toBe(OCT_BYTES.byteLength);
  });

  it("replace discards records that are not in the archive", async () => {
    await seedRecord();
    const archive = await buildArchive();
    await dbPut("symptoms", aSymptom({ id: "later", description: "added after the export" }));

    await importArchive(archive, "replace");
    const ids = (await dbGetAll<SymptomEntry>("symptoms")).map((s) => s.id);
    expect(ids).toEqual(["s1"]);
  });
});

describe("merge import", () => {
  it("adds what is missing and keeps what is newer here", async () => {
    await seedRecord();
    const archive = await buildArchive();

    // This device has moved on: s1 edited more recently, plus a record the archive never saw.
    await dbPut("symptoms", {
      ...aSymptom({ id: "s1", description: "edited on this device" }),
      updated_at: "2030-01-01T00:00:00",
    });
    await dbPut("symptoms", aSymptom({ id: "local-only" }));

    const result = await importArchive(archive, "merge");
    const symptoms = await dbGetAll<SymptomEntry>("symptoms");

    expect(symptoms).toHaveLength(2);
    expect(symptoms.find((s) => s.id === "s1")!.description).toBe("edited on this device");
    expect(symptoms.find((s) => s.id === "local-only")).toBeTruthy();
    expect(result.skipped).toBeGreaterThan(0);
  });

  it("takes the archive's copy when it is the newer one", async () => {
    await dbPut("symptoms", {
      ...aSymptom({ id: "s1", description: "old local copy" }),
      updated_at: "2020-01-01T00:00:00",
    });
    const archive = {
      format: ARCHIVE_FORMAT,
      version: 2,
      schema_version: SCHEMA_VERSION,
      exported_at: "2026-09-01T00:00:00Z",
      app_version: "0.2.0",
      counts: {},
      checksum: "",
      files: [],
      data: {
        symptoms: [
          { ...aSymptom({ id: "s1", description: "newer archive copy" }), updated_at: "2026-09-01T00:00:00" },
        ],
      },
    } as unknown as Archive;

    const result = await importArchive(archive, "merge");
    const symptoms = await dbGetAll<SymptomEntry>("symptoms");
    expect(symptoms[0].description).toBe("newer archive copy");
    expect(result.updated).toBe(1);
  });

  it("never duplicates a record by id", async () => {
    await seedRecord();
    const archive = await buildArchive();
    await importArchive(archive, "merge");
    await importArchive(archive, "merge");
    const ids = (await dbGetAll<SymptomEntry>("symptoms")).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("encryption", () => {
  it("round-trips with the right passphrase", async () => {
    await seedRecord();
    const archive = await buildArchive();

    const sealed = await encryptArchive(archive, "correct horse battery staple");
    expect(isEncryptedArchive(sealed)).toBe(true);
    expect(JSON.stringify(sealed)).not.toContain("one new dark dot");

    const opened = await decryptArchive(sealed, "correct horse battery staple");
    expect(opened.checksum).toBe(archive.checksum);
    expect((opened.data.symptoms as SymptomEntry[])[0].description).toBe("one new dark dot");
  });

  it("refuses the wrong passphrase without damaging anything", async () => {
    await seedRecord();
    const sealed = await encryptArchive(await buildArchive(), "right one");
    await expect(decryptArchive(sealed, "wrong one")).rejects.toBeInstanceOf(WrongPassphrase);
    expect(await dbGetAll("symptoms")).toHaveLength(1);
  });

  it("states its parameters in the clear so the file can be opened later", async () => {
    const sealed = await encryptArchive(await buildArchive(), "passphrase");
    expect(sealed.encryption.kdf).toBe("PBKDF2-SHA256");
    expect(sealed.encryption.iterations).toBeGreaterThanOrEqual(250_000);
    expect(sealed.encryption.salt).toBeTruthy();
    expect(sealed.encryption.iv).toBeTruthy();
  });

  it("uses a fresh salt and iv every time", async () => {
    const archive = await buildArchive();
    const a = await encryptArchive(archive, "same passphrase");
    const b = await encryptArchive(archive, "same passphrase");
    expect(a.encryption.salt).not.toBe(b.encryption.salt);
    expect(a.payload).not.toBe(b.payload);
  });
});

describe("importing an older archive", () => {
  it("migrates a version 1 archive on the way in", async () => {
    const legacyFloater = { ...aFloater({ id: "old-f" }) } as Record<string, unknown>;
    delete legacyFloater.source_type;
    const v1 = {
      app: "afterlight",
      version: 1,
      schema_version: 1,
      data: { floaters: [legacyFloater] },
    } as unknown as Archive;

    const result = await importArchive(v1, "replace");
    expect(result.migrationsApplied.length).toBeGreaterThan(0);
    const floaters = await dbGetAll<{ source_type?: string }>("floaters");
    expect(floaters[0].source_type).toBe("patient_reported");
  });
});
