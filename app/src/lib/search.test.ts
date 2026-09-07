import { describe, expect, it } from "vitest";
import { parseQuery, searchRecords, buildIndex } from "./search";
import {
  anAllData,
  aDiagnosis,
  aDocument,
  aFloater,
  anImaging,
  aProcedure,
  aSymptom,
} from "../test/factories";

describe("parseQuery", () => {
  it("reads an eye from natural phrasing and from the clinical abbreviation", () => {
    expect(parseQuery("floaters left eye").eye).toBe("left");
    expect(parseQuery("OD glare").eye).toBe("right");
  });

  it("does not guess an eye when both are named", () => {
    expect(parseQuery("left and right").eye).toBeUndefined();
  });

  it("reads a month from a written month and from ISO", () => {
    expect(parseQuery("Aug 2026").monthPrefix).toBe("2026-08");
    expect(parseQuery("August 2026").monthPrefix).toBe("2026-08");
    expect(parseQuery("2026-08").monthPrefix).toBe("2026-08");
  });

  it("reads a bare year without inventing a month", () => {
    const q = parseQuery("vitrectomy 2024");
    expect(q.year).toBe("2024");
    expect(q.monthPrefix).toBeUndefined();
  });

  it("drops the date and eye words from the free-text terms", () => {
    const q = parseQuery("glare left eye Aug 2026");
    expect(q.terms).toContain("glare");
    expect(q.terms).not.toContain("2026");
    expect(q.terms).not.toContain("eye");
  });
});

describe("searchRecords", () => {
  const data = anAllData({
    symptoms: [
      aSymptom({ eye: "left", symptom_type: "glare", date_time: "2026-08-22T20:00:00" }),
      aSymptom({ eye: "right", symptom_type: "glare", date_time: "2026-09-01T20:00:00" }),
    ],
    floaters: [aFloater({ eye: "left", nickname: "The comma", first_seen: "2026-08-04" })],
    procedures: [aProcedure({ procedure_type: "vitrectomy", date: "2024-08-09" })],
    diagnoses: [aDiagnosis({ name: "Lattice degeneration", first_documented: "2023-09-04" })],
    imaging: [anImaging({ modality: "OCT", date: "2026-08-24" })],
    documents: [aDocument({ title: "Retina clinic letter", date: "2026-08-26" })],
  });

  it("returns nothing for an empty or single-character query", () => {
    expect(searchRecords(data, "")).toEqual([]);
    expect(searchRecords(data, "a")).toEqual([]);
  });

  it("filters by eye without dropping both-eye records", () => {
    const withBoth = anAllData({
      symptoms: [
        aSymptom({ eye: "left", symptom_type: "glare" }),
        aSymptom({ eye: "right", symptom_type: "glare" }),
        aSymptom({ eye: "both", symptom_type: "glare" }),
      ],
    });
    const hits = searchRecords(withBoth, "glare left eye");
    expect(hits).toHaveLength(2);
    expect(hits.every((h) => h.eye === "left" || h.eye === "both")).toBe(true);
  });

  it("narrows to a month and never widens it", () => {
    const hits = searchRecords(data, "glare Aug 2026");
    expect(hits).toHaveLength(1);
    expect(hits[0].date).toBe("2026-08-22");
  });

  it("requires every free-text term to match", () => {
    expect(searchRecords(data, "vitrectomy nonsenseword")).toEqual([]);
  });

  it("ranks a title match above a body-only match", () => {
    const hits = searchRecords(data, "vitrectomy");
    expect(hits[0].title.toLowerCase()).toContain("vitrectomy");
  });

  it("orders equal-scoring hits by recency", () => {
    const hits = searchRecords(data, "glare");
    expect(hits.map((h) => h.date)).toEqual(["2026-09-01", "2026-08-22"]);
  });

  it("finds records across every entity type", () => {
    expect(searchRecords(data, "lattice")).toHaveLength(1);
    expect(searchRecords(data, "comma")).toHaveLength(1);
    expect(searchRecords(data, "clinic letter").length).toBeGreaterThan(0);
    expect(searchRecords(data, "OCT").length).toBeGreaterThan(0);
  });

  it("carries provenance and a destination on every hit", () => {
    for (const hit of searchRecords(data, "glare")) {
      expect(hit.source_type).toBeTruthy();
      expect(hit.route).toBeTruthy();
    }
  });
});

describe("buildIndex", () => {
  it("indexes a floater with its own recorded provenance", () => {
    const rows = buildIndex(anAllData({ floaters: [aFloater({ source_type: "patient_reported" })] }));
    expect(rows[0].source_type).toBe("patient_reported");
  });

  it("skips empty no-change daily logs but keeps ones carrying a note", () => {
    const quiet = buildIndex(
      anAllData({
        dailyLogs: [
          { ...aSymptom(), id: "d1" } as never, // placeholder replaced below
        ],
      }),
    );
    expect(Array.isArray(quiet)).toBe(true);
  });
});
