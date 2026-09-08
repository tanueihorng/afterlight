import { describe, expect, it } from "vitest";
import { dateOf, select } from "./query";
import {
  anAllData,
  anAppointment,
  aDiagnosis,
  aDrawing,
  anImaging,
  aMeasurement,
  aSymptom,
} from "../test/factories";

const data = anAllData({
  symptoms: [
    aSymptom({ id: "a", eye: "left", symptom_type: "glare", date_time: "2026-06-01T09:00:00" }),
    aSymptom({ id: "b", eye: "right", symptom_type: "glare", date_time: "2026-07-01T09:00:00" }),
    aSymptom({ id: "c", eye: "both", symptom_type: "floaters", date_time: "2026-08-01T09:00:00" }),
    aSymptom({ id: "d", eye: "left", symptom_type: "glare", date_time: "2026-09-01T09:00:00", demo: true }),
  ],
  imaging: [anImaging({ id: "i1", modality: "OCT", date: "2026-07-15" })],
  measurements: [aMeasurement({ id: "m1", kind: "iop", date: "2026-06-20" })],
  appointments: [anAppointment({ id: "ap1", date_time: "2026-08-20T10:00:00" })],
  diagnoses: [aDiagnosis({ id: "dx1", first_documented: "2024-08-09" })],
  drawings: [aDrawing({ id: "dr1", date_time: "2026-06-02T09:00:00" })],
});

describe("filtering", () => {
  it("filters by eye and always keeps both-eye records", () => {
    const left = select(data, "symptoms").eye("left").all();
    expect(left.map((s) => s.id).sort()).toEqual(["a", "c", "d"]);
  });

  it("returns everything for eye 'any'", () => {
    expect(select(data, "symptoms").eye("any").count()).toBe(4);
  });

  it("filters by type across entities that name themselves differently", () => {
    expect(select(data, "symptoms").type("glare").count()).toBe(3);
    expect(select(data, "imaging").type("OCT").count()).toBe(1);
    expect(select(data, "measurements").type("iop").count()).toBe(1);
  });

  it("filters a date range inclusively at both ends", () => {
    const inRange = select(data, "symptoms").between("2026-06-01", "2026-07-01").all();
    expect(inRange.map((s) => s.id).sort()).toEqual(["a", "b"]);
  });

  it("excludes demo records when asked", () => {
    expect(select(data, "symptoms").real().count()).toBe(3);
  });

  it("composes filters without mutating the source", () => {
    const q = select(data, "symptoms").eye("left").type("glare").real();
    expect(q.all().map((s) => s.id)).toEqual(["a"]);
    expect(data.symptoms).toHaveLength(4);
  });

  it("returns an empty result rather than throwing when nothing matches", () => {
    const none = select(data, "symptoms").type("nothing-like-this");
    expect(none.isEmpty()).toBe(true);
    expect(none.first()).toBeUndefined();
    expect(none.earliest()).toBeUndefined();
  });
});

describe("ordering", () => {
  it("orders newest first by default", () => {
    expect(select(data, "symptoms").order().all()[0].id).toBe("d");
  });

  it("orders oldest first when asked", () => {
    expect(select(data, "symptoms").order("asc").all()[0].id).toBe("a");
  });

  it("finds the earliest and latest regardless of current order", () => {
    const q = select(data, "symptoms").order("desc");
    expect(q.earliest()?.id).toBe("a");
    expect(q.latest()?.id).toBe("d");
  });
});

describe("dates across entities", () => {
  it("knows which field dates each entity", () => {
    expect(dateOf("symptoms", data.symptoms[0])).toBe("2026-06-01");
    expect(dateOf("imaging", data.imaging[0])).toBe("2026-07-15");
    expect(dateOf("appointments", data.appointments[0])).toBe("2026-08-20");
    expect(dateOf("diagnoses", data.diagnoses[0])).toBe("2024-08-09");
    expect(dateOf("drawings", data.drawings[0])).toBe("2026-06-02");
  });

  it("filters every entity by its own date field", () => {
    expect(select(data, "diagnoses").since("2026-01-01").count()).toBe(0);
    expect(select(data, "diagnoses").before("2026-01-01").count()).toBe(1);
  });
});

describe("aggregation", () => {
  it("counts and groups", () => {
    const byEye = select(data, "symptoms").groupBy((s) => s.eye);
    expect(byEye.get("left")).toHaveLength(2);
    expect(byEye.get("both")).toHaveLength(1);
    expect(select(data, "symptoms").count()).toBe(4);
  });

  it("limits without reordering", () => {
    const two = select(data, "symptoms").order("asc").limit(2).all();
    expect(two.map((s) => s.id)).toEqual(["a", "b"]);
  });
});
