import { describe, expect, it } from "vitest";
import { cardFacts, markersWithin, trackedKinds, treatmentMarkers } from "./eyedash";
import { aMeasurement, aMedication, aProcedure, anAllData } from "../test/factories";

const iop = (date: string, value: string, over = {}) =>
  aMeasurement({ date, value, kind: "iop", unit: "mmHg", eye: "right", ...over });
const va = (date: string, value: string, over = {}) =>
  aMeasurement({ date, value, kind: "visual_acuity", eye: "right", ...over });

describe("tracked measurements", () => {
  it("lists each eye measurement once, in a stable order, and leaves out whole-body ones", () => {
    const data = anAllData({
      measurements: [
        iop("2026-01-01", "18"),
        va("2026-01-01", "6/9", { eye: "left" }),
        aMeasurement({ kind: "hba1c", value: "48", eye: "not_applicable" }),
      ],
    });
    expect(trackedKinds(data)).toEqual(["visual_acuity", "iop"]);
  });
});

describe("card facts", () => {
  it("places the latest between the person's own lowest and highest", () => {
    const data = anAllData({
      measurements: [iop("2026-01-01", "14"), iop("2026-02-01", "24"), iop("2026-03-01", "19")],
    });
    const f = cardFacts(data, "iop", "right");
    expect(f.latest?.raw).toBe("19");
    expect(f.position).toBeCloseTo(0.5);
    expect([f.leftEnd?.raw, f.rightEnd?.raw]).toEqual(["14", "24"]);
  });

  it("puts the poorer acuity on the left, as the chart does", () => {
    const data = anAllData({
      measurements: [va("2026-01-01", "20/200"), va("2026-02-01", "20/25"), va("2026-03-01", "20/50")],
    });
    const f = cardFacts(data, "visual_acuity", "right");
    expect([f.leftEnd?.raw, f.rightEnd?.raw]).toEqual(["20/200", "20/25"]);
    expect(f.position).toBeGreaterThan(0);
    expect(f.position).toBeLessThan(1);
  });

  it("has no position with one reading, the same number twice, or a non-numeric latest", () => {
    const one = cardFacts(anAllData({ measurements: [iop("2026-01-01", "18")] }), "iop", "right");
    expect([one.position, one.unplaced]).toEqual([undefined, "single"]);
    const same = anAllData({ measurements: [iop("2026-01-01", "18"), iop("2026-02-01", "18")] });
    expect(cardFacts(same, "iop", "right").unplaced).toBe("all_same");
    const cf = anAllData({ measurements: [va("2026-01-01", "6/60"), va("2026-02-01", "CF")] });
    const f = cardFacts(cf, "visual_acuity", "right");
    expect(f.latest?.raw).toBe("CF");
    expect(f.position).toBeUndefined();
  });

  it("never places a home check against clinic readings", () => {
    const data = anAllData({
      measurements: [
        iop("2026-01-01", "12"),
        iop("2026-02-01", "30"),
        iop("2026-03-01", "20", { source_type: "patient_reported" }),
      ],
    });
    // The only home reading has nothing of its own kind to sit between.
    const f = cardFacts(data, "iop", "right");
    expect([f.position, f.unplaced]).toEqual([undefined, "only_of_its_way"]);
  });

  it("is empty, not zero, when nothing is recorded for that eye", () => {
    const f = cardFacts(anAllData({ measurements: [iop("2026-01-01", "18")] }), "iop", "left");
    expect(f.latest).toBeUndefined();
    expect(f.position).toBeUndefined();
  });
});

describe("treatment markers", () => {
  const data = anAllData({
    procedures: [
      aProcedure({ procedure_type: "vitrectomy", date: "2026-03-10", eye: "right" }),
      aProcedure({ procedure_type: "cataract surgery", date: "2026-05-01", eye: "left" }),
    ],
    medications: [
      aMedication({ name: "Aflibercept", eye: "both", start_date: "2026-01-15", pattern: "injection_series", cycle_number: 4, last_given: "2026-06-02" }),
      aMedication({ name: "Drops", eye: "right", start_date: "2026-03-11", kind: "self_care", source_type: "patient_reported" }),
    ],
  });

  it("collects one eye's procedures and medicines, oldest first, with their source", () => {
    const m = treatmentMarkers(data, "right");
    expect(m.map((x) => [x.date, x.text])).toEqual([
      ["2026-01-15", "Aflibercept started"],
      ["2026-03-10", "Vitrectomy"],
      ["2026-03-11", "Drops started"],
      ["2026-06-02", "Aflibercept (injection 4)"],
    ]);
    expect(m.find((x) => x.text === "Drops started")?.source).toBe("patient_reported");
    expect(treatmentMarkers(data, "left").map((x) => x.text)).toContain("Cataract surgery");
  });

  it("keeps only the markers inside a chart's dates", () => {
    const within = markersWithin(treatmentMarkers(data, "right"), "2026-03-10", "2026-04-01");
    expect(within.map((x) => x.text)).toEqual(["Vitrectomy", "Drops started"]);
  });

  it("marks when a medicine stopped, and names an 'other' procedure", () => {
    const m = treatmentMarkers(
      anAllData({
        procedures: [aProcedure({ procedure_type: "other", date: "2026-02-01", eye: "right" })],
        medications: [aMedication({ name: "Pred Forte", eye: "right", start_date: "2026-01-01", end_date: "2026-03-01" })],
      }),
      "right",
    );
    expect(m.map((x) => x.text)).toEqual(["Pred Forte started", "Other procedure", "Pred Forte stopped"]);
  });
});
