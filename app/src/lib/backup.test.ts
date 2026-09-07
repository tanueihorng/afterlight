import { describe, expect, it } from "vitest";
import {
  BACKUP_STALE_DAYS,
  backupState,
  changesSinceExport,
  countRecords,
  formatBytes,
  shouldNudge,
} from "./backup";
import type { AppMeta } from "./models";
import { anAllData, aSymptom } from "../test/factories";

const meta = (over: Partial<AppMeta> = {}): AppMeta => ({
  id: "meta",
  onboarded: true,
  theme: "dark",
  demo_seeded: false,
  ...over,
});

describe("counting", () => {
  it("counts every record in the store", () => {
    expect(countRecords(anAllData({ symptoms: [aSymptom(), aSymptom()] }))).toBe(2);
    expect(countRecords(anAllData())).toBe(0);
  });

  it("treats everything as unsaved when there has never been an export", () => {
    const data = anAllData({ symptoms: [aSymptom(), aSymptom()] });
    expect(changesSinceExport(data, undefined)).toBe(2);
  });

  it("counts only records touched after the last export", () => {
    const data = anAllData({
      symptoms: [
        aSymptom({ updated_at: "2026-01-01T09:00:00" }),
        aSymptom({ updated_at: "2026-06-01T09:00:00" }),
      ],
    });
    expect(changesSinceExport(data, "2026-03-01T00:00:00")).toBe(1);
  });
});

describe("backupState", () => {
  it("says nothing is at risk when the record is empty", () => {
    const state = backupState(anAllData(), meta(), "2026-09-08");
    expect(state.stale).toBe(false);
    expect(state.totalRecords).toBe(0);
  });

  it("is stale when a record has never been exported", () => {
    const data = anAllData({ symptoms: [aSymptom()] });
    const state = backupState(data, meta(), "2026-09-08");
    expect(state.neverExported).toBe(true);
    expect(state.stale).toBe(true);
  });

  it("is not stale right after an export", () => {
    const data = anAllData({ symptoms: [aSymptom({ updated_at: "2026-09-01T09:00:00" })] });
    const state = backupState(data, meta({ last_export_at: "2026-09-07T09:00:00" }), "2026-09-08");
    expect(state.stale).toBe(false);
    expect(state.unsavedChanges).toBe(0);
    expect(state.daysSinceExport).toBe(1);
  });

  it("becomes stale once the export is old and something has changed since", () => {
    const data = anAllData({ symptoms: [aSymptom({ updated_at: "2026-09-05T09:00:00" })] });
    const old = `2026-07-01T09:00:00`;
    const state = backupState(data, meta({ last_export_at: old }), "2026-09-08");
    expect(state.daysSinceExport).toBeGreaterThanOrEqual(BACKUP_STALE_DAYS);
    expect(state.unsavedChanges).toBe(1);
    expect(state.stale).toBe(true);
  });

  it("stays quiet when the export is old but nothing has changed since", () => {
    const data = anAllData({ symptoms: [aSymptom({ updated_at: "2026-01-01T09:00:00" })] });
    const state = backupState(data, meta({ last_export_at: "2026-06-01T09:00:00" }), "2026-09-08");
    expect(state.unsavedChanges).toBe(0);
    expect(state.stale).toBe(false);
  });
});

describe("shouldNudge", () => {
  const staleState = backupState(
    anAllData({ symptoms: [aSymptom({ updated_at: "2026-09-05T09:00:00" })] }),
    meta({ last_export_at: "2026-07-01T09:00:00" }),
    "2026-09-08",
  );

  it("says nothing when the backup is current", () => {
    const fresh = backupState(anAllData(), meta({ last_export_at: "2026-09-07T09:00:00" }), "2026-09-08");
    expect(shouldNudge(fresh, null, "2026-09-08")).toBe(false);
  });

  it("raises it once when the backup is stale", () => {
    expect(shouldNudge(staleState, null, "2026-09-08")).toBe(true);
  });

  it("does not raise it again the next day", () => {
    expect(shouldNudge(staleState, "2026-09-07T10:00:00", "2026-09-08")).toBe(false);
  });

  it("raises it again after a week", () => {
    expect(shouldNudge(staleState, "2026-09-01T10:00:00", "2026-09-08")).toBe(true);
  });
});

describe("formatBytes", () => {
  it("is readable at every scale", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(undefined)).toBe("unknown");
  });
});
