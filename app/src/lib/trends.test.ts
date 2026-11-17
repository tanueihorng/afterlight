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

  it("keeps unchecked document transcriptions out of trends", () => {
    const data = anAllData({ measurements: [
      iop("2026-08-24", "14.6", { source_type: "document_extracted", confirmed: false }),
      iop("2026-09-01", "15", { source_type: "document_extracted", confirmed: true }),
    ] });
    expect(seriesFor(data, "iop", "right").points.map((p) => p.raw)).toEqual(["15"]);
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

describe("clinic and home readings are never one series", () => {
  it("does not compute a difference or range across a clinic reading and a home check", () => {
    const data = anAllData({
      measurements: [
        aMeasurement({ id: "c1", kind: "iop", eye: "right", date: "2026-03-01", value: "14", unit: "mmHg", source_type: "device_measurement" }),
        aMeasurement({ id: "c2", kind: "iop", eye: "right", date: "2026-05-01", value: "16", unit: "mmHg", source_type: "device_measurement" }),
        aMeasurement({ id: "h1", kind: "iop", eye: "right", date: "2026-06-01", value: "22", unit: "mmHg", source_type: "patient_reported" }),
      ],
    });
    const notes = describeSeries(seriesFor(data, "iop", "right")).notes.join(" ");
    // 22 (home) − 14 (clinic) would be the cross-kind comparison the rules forbid.
    expect(notes).not.toMatch(/8 mmHg higher/);
    expect(notes).not.toMatch(/range from 14 to 22/);
    expect(notes).toMatch(/Clinic readings: recorded values range from 14 to 16 mmHg/);
    expect(notes).toMatch(/Clinic readings: the most recent reading is 2 mmHg higher than the first/);
    // One home check alone has nothing to compare against.
    expect(notes).not.toMatch(/Home checks:/);
  });
});

describe("describing acuity", () => {
  const va = (date: string, value: string, unit?: string) =>
    aMeasurement({ kind: "visual_acuity", value, date, eye: "right", unit });
  const notesFor = (...ms: ReturnType<typeof va>[]) =>
    describeSeries(seriesFor(anAllData({ measurements: ms }), "visual_acuity", "right")).notes.join(" ");

  it("names the largest- and smallest-letter readings with their dates, never logMAR arithmetic", () => {
    const notes = notesFor(va("2024-10-19", "20/200"), va("2025-01-01", "20/50"), va("2026-11-05", "20/25"));
    expect(notes).toMatch(/20\/200 \(19 Oct 2024\) is the one with the largest letters and 20\/25 \(5 Nov 2026\) the one with the smallest/);
    expect(notes).toMatch(/not the order they were taken in/);
    // "0.9 lower than the first" was true of logMAR and backwards to anyone reading it.
    expect(notes).not.toMatch(/lower than the first|higher than the first|around their average|0\.1/);
  });

  it("does not read as an improvement when the finer reading came first", () => {
    const notes = notesFor(va("2024-01-01", "20/25"), va("2026-01-01", "20/200"));
    expect(notes).toMatch(/20\/200 \(1 Jan 2026\) is the one with the largest letters/);
    expect(notes).not.toMatch(/run from|went from/);
  });

  it("says the sentence covers only the readings written as numbers when there are others", () => {
    const notes = notesFor(va("2026-01-01", "20/40"), va("2026-02-01", "HM"), va("2026-03-01", "20/25"));
    expect(notes).toMatch(/Of the readings written as numbers, 20\/40/);
    const same = notesFor(va("2026-01-01", "6/6"), va("2026-02-01", "6/6"), va("2026-03-01", "CF"));
    expect(same).toMatch(/Of the readings written as numbers, each was recorded as 6\/6/);
    expect(same).not.toMatch(/Every reading/);
  });

  it("says so when every reading is the same, and shows each way it was written", () => {
    expect(notesFor(va("2026-01-01", "6/6"), va("2026-02-01", "6/6"))).toMatch(/Every reading was recorded as 6\/6\./);
    expect(notesFor(va("2026-01-01", "6/6"), va("2026-02-01", "20/20"))).toMatch(
      /These readings are the same acuity, written as 6\/6 and 20\/20/,
    );
  });

  it("plots a bare number when its unit says how it was written, with that unit", () => {
    const series = seriesFor(anAllData({ measurements: [va("2026-01-01", "0.3", "logMAR"), va("2026-02-01", "0.5", "decimal"), va("2026-03-01", "0.3")] }), "visual_acuity", "right");
    expect(series.points.map((p) => p.numeric)).toEqual([true, true, false]);
    expect(describeSeries(series).notes.join(" ")).toMatch(/0\.3 logMAR/);
  });
});
