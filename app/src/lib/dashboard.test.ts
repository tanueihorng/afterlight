import { describe, expect, it } from "vitest";
import type { AllData } from "./db";
import { greeting, latestAcuity, nextAppointment, recentDays, recentEntries } from "./dashboard";

const T = "2026-01-01T00:00:00.000Z";

function empty(): AllData {
  return {
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
    selfTests: [],
    imaging: [],
    documents: [],
    baselines: [],
    briefs: [],
  } as unknown as AllData;
}

describe("recentDays", () => {
  it("keeps a day with nothing written down as missing, never as a quiet normal day", () => {
    const data = empty();
    data.dailyLogs.push({
      id: "2026-03-09",
      date: "2026-03-09",
      overall: "no_change",
      source_type: "patient_reported",
      created_at: T,
      updated_at: T,
    });
    const days = recentDays(data, "2026-03-10", 3);
    expect(days.map((d) => d.date)).toEqual(["2026-03-08", "2026-03-09", "2026-03-10"]);
    expect(days.map((d) => d.state)).toEqual(["missing", "no_change", "missing"]);
  });

  it("marks a day with a symptom as changed even without a daily log", () => {
    const data = empty();
    data.symptoms.push({
      id: "s1",
      date_time: "2026-03-10T09:00:00",
      eye: "left",
      symptom_type: "floaters",
      status: "new",
      source_type: "patient_reported",
      created_at: T,
      updated_at: T,
    } as AllData["symptoms"][number]);
    expect(recentDays(data, "2026-03-10", 1)[0].state).toBe("changed");
  });
});

describe("latestAcuity", () => {
  it("returns the newest acuity for that eye only, with its source intact", () => {
    const data = empty();
    const m = (id: string, date: string, eye: "right" | "left", value: string) => ({
      id,
      date,
      eye,
      kind: "visual_acuity" as const,
      value,
      source_type: "clinician_reported" as const,
      created_at: T,
      updated_at: T,
    });
    data.measurements.push(
      m("a", "2026-01-01", "right", "6/12"),
      m("b", "2026-02-01", "right", "6/9"),
    );
    data.measurements.push(m("c", "2026-03-01", "left", "6/6"));
    expect(latestAcuity(data, "right")?.value).toBe("6/9");
    expect(latestAcuity(data, "right")?.source_type).toBe("clinician_reported");
    expect(latestAcuity(data, "left")?.value).toBe("6/6");
  });

  it("returns nothing when nothing was recorded, so the screen can say so", () => {
    expect(latestAcuity(empty(), "left")).toBeUndefined();
  });
});

describe("nextAppointment", () => {
  it("picks the soonest visit from today on, ignoring past ones", () => {
    const data = empty();
    const a = (id: string, date_time: string) => ({ id, date_time, created_at: T, updated_at: T });
    data.appointments.push(a("past", "2026-03-01T10:00:00"), a("later", "2026-05-01T10:00:00"));
    data.appointments.push(a("soon", "2026-04-02T09:40:00"));
    expect(nextAppointment(data, "2026-03-10")?.id).toBe("soon");
  });
});

describe("recentEntries", () => {
  it("merges record types newest first and keeps eye and provenance on every row", () => {
    const data = empty();
    data.symptoms.push({
      id: "s",
      date_time: "2026-03-02T09:00:00",
      eye: "left",
      symptom_type: "floaters",
      status: "new",
      baseline_comparison: "new",
      source_type: "patient_reported",
      created_at: T,
      updated_at: T,
    } as AllData["symptoms"][number]);
    data.measurements.push({
      id: "m",
      date: "2026-03-05",
      eye: "both",
      kind: "iop",
      value: "17",
      unit: "mmHg",
      source_type: "clinician_reported",
      created_at: T,
      updated_at: T,
    });
    const rows = recentEntries(data, 4);
    expect(rows.map((r) => r.id)).toEqual(["m", "s"]);
    expect(rows[0]).toMatchObject({ eye: "both", source: "clinician_reported", detail: "17 mmHg" });
    expect(rows[1]).toMatchObject({ eye: "left", source: "patient_reported" });
  });
});

describe("greeting", () => {
  it("depends only on the hour", () => {
    expect(greeting(8)).toBe("Good morning");
    expect(greeting(14)).toBe("Good afternoon");
    expect(greeting(21)).toBe("Good evening");
  });
});
