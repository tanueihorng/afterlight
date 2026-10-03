import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORES, dbClear, dbGet, dbGetAll, dbPatch, dbPut, loadMigrated } from "./db";
import { SCHEMA_VERSION } from "./migrations";
import type { AppMeta } from "./models";

beforeEach(async () => {
  for (const store of STORES) await dbClear(store);
});
afterEach(() => vi.restoreAllMocks());

function abortAfterRequestSuccess() {
  const original = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
    this: IDBObjectStore,
    value: unknown,
    key?: IDBValidKey,
  ) {
    const request = original.call(this, value, key);
    request.addEventListener("success", () => this.transaction.abort());
    return request;
  });
}

describe("IndexedDB commit acknowledgements", () => {
  it("rejects a put when request success is followed by transaction abort", async () => {
    abortAfterRequestSuccess();
    await expect(dbPut("meta", { id: "meta", onboarded: true })).rejects.toThrow();
    expect(await dbGet("meta", "meta")).toBeUndefined();
  });

  it("rejects an aborted patch and preserves the previous committed value", async () => {
    const before = { id: "meta", onboarded: false, schema_version: SCHEMA_VERSION };
    await dbPut("meta", before);
    abortAfterRequestSuccess();
    await expect(dbPatch<AppMeta>("meta", "meta", { onboarded: true })).rejects.toThrow();
    expect(await dbGet("meta", "meta")).toEqual(before);
  });

  it("allows an idempotent patch without losing unrelated metadata", async () => {
    const before = { id: "meta", onboarded: true, schema_version: SCHEMA_VERSION };
    await dbPut("meta", before);
    expect(await dbPatch<AppMeta>("meta", "meta", { onboarded: true })).toEqual(before);
    expect(await dbGet("meta", "meta")).toEqual(before);
  });
});

describe("empty-store migration", () => {
  it("initialises the schema once and preserves onboarding across subsequent loads", async () => {
    await loadMigrated();
    expect(await dbGet("meta", "meta")).toEqual({ id: "meta", schema_version: SCHEMA_VERSION });
    expect(await dbGetAll("backups")).toHaveLength(1);
    await dbPatch<AppMeta>("meta", "meta", { onboarded: true });
    await loadMigrated();
    expect(await dbGet("meta", "meta")).toEqual({
      id: "meta", schema_version: SCHEMA_VERSION, onboarded: true,
    });
    expect(await dbGetAll("backups")).toHaveLength(1);
  });
});
