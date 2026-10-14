import { describe, expect, it } from "vitest";
import {
  allPrescriptionSeries,
  describe as describeSeries,
  prescriptionSeries,
  signedDioptres,
} from "./trends";
import { anAllData, aPrescription } from "../test/factories";

const history = [
  aPrescription({ date: "2024-03-01", right_eye: { sphere: -1.5, cylinder: -0.5, axis: 175 }, left_eye: { sphere: -1.25 } }),
  aPrescription({ date: "2019-05-12", right_eye: { sphere: -0.75, cylinder: -0.25, axis: 5 }, left_eye: {} }),
  aPrescription({ date: "2026-08-20", right_eye: { sphere: 0.5 }, left_eye: { sphere: -2 } }),
];

describe("prescription series", () => {
  it("charts each eye separately, oldest first, signed as written", () => {
    const right = prescriptionSeries(anAllData({ prescriptions: history }), "sphere", "right");
    expect(right.points.map((p) => [p.date, p.raw])).toEqual([
      ["2019-05-12", "-0.75"],
      ["2024-03-01", "-1.50"],
      ["2026-08-20", "+0.50"],
    ]);
    const left = prescriptionSeries(anAllData({ prescriptions: history }), "sphere", "left");
    expect(left.points.map((p) => p.value)).toEqual([-1.25, -2]);
    expect(left.eye).toBe("left");
  });

  it("leaves out what was not written, rather than plotting it as zero", () => {
    const cyl = prescriptionSeries(anAllData({ prescriptions: history }), "cylinder", "left");
    expect(cyl.points).toEqual([]);
    const kinds = allPrescriptionSeries(anAllData({ prescriptions: history })).map(
      (s) => `${s.kind}-${s.eye}`,
    );
    expect(kinds).toEqual(["rx_sphere-right", "rx_sphere-left", "rx_cylinder-right"]);
  });

  it("never charts axis", () => {
    const all = allPrescriptionSeries(anAllData({ prescriptions: history }));
    expect(all.some((s) => /axis/i.test(s.label) || /axis/.test(s.kind))).toBe(false);
  });

  it("is described in numbers only", () => {
    const right = prescriptionSeries(anAllData({ prescriptions: history }), "sphere", "right");
    const text = [describeSeries(right).summary, ...describeSeries(right).notes].join(" ");
    expect(text).toMatch(/3 entries from/);
    expect(text).not.toMatch(/worse|better|improv|declin|stable|normal/i);
  });

  it("does not report a change between plus- and minus-cylinder forms of one lens", () => {
    // -1.00 / -1.00 x 90 and -2.00 / +1.00 x 180 are the same lens written two ways.
    const mixed = anAllData({
      prescriptions: [
        aPrescription({ date: "2020-01-01", right_eye: { sphere: -1, cylinder: -1, axis: 90 } }),
        aPrescription({ date: "2022-01-01", right_eye: { sphere: -2, cylinder: 1, axis: 180 } }),
      ],
    });
    for (const component of ["sphere", "cylinder"] as const) {
      const series = prescriptionSeries(mixed, component, "right");
      expect(series.mixedCylinderForms).toBe(true);
      const notes = describeSeries(series).notes.join(" ");
      expect(notes).not.toMatch(/higher|lower|vary/);
    }
    expect(prescriptionSeries(mixed, "sphere", "left").mixedCylinderForms).toBe(false);
  });

  it("says the person copied it, never that a clinic measured it", () => {
    const right = prescriptionSeries(anAllData({ prescriptions: history }), "sphere", "right");
    for (const p of right.points) {
      expect(p.source).toBe("patient_reported");
      expect(p.howLabel).toMatch(/copied by you/i);
    }
    expect(right.label).not.toMatch(/glasses|contact/i);
  });

  it("signs dioptres the way a prescription does", () => {
    expect(signedDioptres(1.25)).toBe("+1.25");
    expect(signedDioptres(-0.5)).toBe("-0.50");
    expect(signedDioptres(0)).toBe("0.00");
  });
});
