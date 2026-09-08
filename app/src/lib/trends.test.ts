import { describe, expect, it } from "vitest";
import { allSeries, describe as describeSeries, priorInstances, seriesFor } from "./trends";
import { anAllData, aMeasurement, aSymptom } from "../test/factories";

const iop = (date: string, value: string, over = {}) =>
  aMeasurement({ date, value, kind: "iop", unit: "mmHg", eye: "right", ...over });

describe("series extraction", () => {
  it("orders points oldest first, whatever order they were stored in", () => {
    const data = anAllData({
      measurements: [iop("2026-06-01", "18"), iop("2026-03-01", "16"), iop("2026-09-01", "22")],
    });
    expect(seriesFor(data, "iop", "right").points.map((p) => p.date)).toEqual([
      "2026-03-01",
      "2026-06-01",
      "2026-09-01",
    ]);
  });

  it("keeps the two eyes as separate series", () => {
    const data = anAllData({
      measurements: [iop("2026-06-01", "18"), iop("2026-06-01", "27", { eye: "left" })],
    });
    expect(seriesFor(data, "iop", "right").points).toHaveLength(1);
    expect(seriesFor(data, "iop", "left").points[0].raw).toBe("27");
  });

  it("converts acuity to logMAR so a mixed record reads as one series", () => {
    const data = anAllData({
      measurements: [
        aMeasurement({ kind: "visual_acuity", value: "6/6", date: "2026-01-01", eye: "right" }),
        aMeasurement({ kind: "visual_acuity", value: "20/40", date: "2026-02-01", eye: "right" }),
      ],
    });
    const points = seriesFor(data, "visual_acuity", "right").points;
    expect(points[0].value).toBe(0);
    expect(points[1].value).toBeCloseTo(0.3, 2);
    expect(points[0].raw).toBe("6/6");
  });

  it("carries a non-numeric acuity without turning it into a number", () => {
    const data = anAllData({
      measurements: [aMeasurement({ kind: "visual_acuity", value: "HM", eye: "right" })],
    });
    const point = seriesFor(data, "visual_acuity", "right").points[0];
    expect(point.numeric).toBe(false);
    expect(point.raw).toBe("HM");
  });

  it("marks home checks and clinic measurements distinctly", () => {
    const data = anAllData({
      measurements: [
        iop("2026-06-01", "18", { source_type: "device_measurement" }),
        aMeasurement({
          kind: "visual_acuity",
          value: "6/12",
          eye: "right",
          source_type: "patient_reported",
          method: "home_screen_test",
        }),
      ],
    });
    expect(seriesFor(data, "iop", "right").points[0].provenance).toBe("clinic");
    expect(seriesFor(data, "visual_acuity", "right").points[0].provenance).toBe("home");
  });

  it("returns every series that has data, and none that does not", () => {
    const data = anAllData({ measurements: [iop("2026-06-01", "18")] });
    const all = allSeries(data);
    expect(all).toHaveLength(1);
    expect(all[0].eye).toBe("right");
  });
});

describe("describing a series, without judging it", () => {
  const data = anAllData({
    measurements: [iop("2026-03-01", "18"), iop("2026-06-01", "22"), iop("2026-09-01", "24")],
  });
  const described = describeSeries(seriesFor(data, "iop", "right"));

  it("states the count, the span and every value", () => {
    expect(described.summary).toMatch(/3 readings/);
    expect(described.summary).toMatch(/18, 22, 24/);
    expect(described.summary).toMatch(/mmHg/);
  });

  it("reports the arithmetic difference without a verdict", () => {
    expect(described.notes.join(" ")).toMatch(/6 mmHg higher than the first/);
  });

  it("never uses judgement, threshold or prediction language", () => {
    const prose = [described.summary, ...described.notes].join(" ");
    // "higher"/"lower" are arithmetic and allowed; a bare "high", "raised" or "elevated" is a
    // verdict about the number and is not.
    expect(prose).not.toMatch(
      /worse|worsening|better|improv|declin|deteriorat|stable|normal|abnormal|concerning|should|risk|expect/i,
    );
    expect(prose).not.toMatch(/\b(high|low|elevated|raised)\b/i);
  });

  it("says plainly when nothing has been recorded", () => {
    expect(describeSeries(seriesFor(anAllData(), "iop", "right")).summary).toMatch(/nothing recorded/);
  });

  it("does not compare a single reading with anything", () => {
    const one = anAllData({ measurements: [iop("2026-06-01", "18")] });
    const d = describeSeries(seriesFor(one, "iop", "right"));
    expect(d.summary).toMatch(/one reading/);
    expect(d.notes.join(" ")).not.toMatch(/higher|lower/);
  });

  it("warns when clinic and home values are mixed rather than blending them", () => {
    const mixed = anAllData({
      measurements: [
        aMeasurement({ kind: "visual_acuity", value: "6/6", eye: "right", source_type: "device_measurement" }),
        aMeasurement({
          kind: "visual_acuity",
          value: "6/12",
          eye: "right",
          source_type: "patient_reported",
          method: "home_screen_test",
        }),
      ],
    });
    const d = describeSeries(seriesFor(mixed, "visual_acuity", "right"));
    expect(d.mixedProvenance).toBe(true);
    expect(d.notes.join(" ")).toMatch(/not the same kind of measurement/);
  });

  it("says which values are not numbers rather than plotting them as zero", () => {
    const data = anAllData({
      measurements: [
        aMeasurement({ kind: "visual_acuity", value: "6/60", eye: "right", date: "2026-01-01" }),
        aMeasurement({ kind: "visual_acuity", value: "CF", eye: "right", date: "2026-02-01" }),
      ],
    });
    expect(describeSeries(seriesFor(data, "visual_acuity", "right")).notes.join(" ")).toMatch(
      /not numbers and are not plotted/,
    );
  });
});

describe("is this the same as last time?", () => {
  const data = anAllData({
    symptoms: [
      aSymptom({ id: "old", symptom_type: "glare", eye: "left", date_time: "2026-05-01T09:00:00" }),
      aSymptom({ id: "mid", symptom_type: "glare", eye: "left", date_time: "2026-07-01T09:00:00" }),
      aSymptom({ id: "other", symptom_type: "floaters", eye: "left", date_time: "2026-07-15T09:00:00" }),
      aSymptom({ id: "now", symptom_type: "glare", eye: "left", date_time: "2026-09-01T09:00:00" }),
    ],
  });

  it("lists earlier instances of the same symptom in the same eye, newest first", () => {
    const prior = priorInstances(data, "glare", "left", "2026-09-01");
    expect(prior.map((p) => p.record.id)).toEqual(["mid", "old"]);
  });

  it("says how long before each one was", () => {
    const prior = priorInstances(data, "glare", "left", "2026-09-01");
    expect(prior[0].daysBefore).toBe(62);
  });

  it("does not mix in another symptom type", () => {
    const prior = priorInstances(data, "glare", "left", "2026-09-01");
    expect(prior.some((p) => p.record.id === "other")).toBe(false);
    expect(prior.every((p) => p.record.symptom_type === "glare")).toBe(true);
  });

  it("does not mix in the other eye", () => {
    // Every recorded instance here is left-eye, so asking about the right eye finds nothing.
    expect(priorInstances(data, "glare", "right", "2026-09-01")).toEqual([]);
  });

  it("returns nothing when there is no earlier instance", () => {
    expect(priorInstances(data, "glare", "left", "2026-01-01")).toEqual([]);
  });
});
