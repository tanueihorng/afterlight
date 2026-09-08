import { describe, expect, it } from "vitest";
import { quickEntries, yesterdaysEntries } from "./suggestions";
import { anAllData, aSymptom } from "../test/factories";

describe("quickEntries", () => {
  it("offers nothing for a record with no history", () => {
    expect(quickEntries(anAllData(), "2026-09-08")).toEqual([]);
  });

  it("only ever offers symptoms this person has recorded", () => {
    const data = anAllData({
      symptoms: [aSymptom({ symptom_type: "glare", eye: "left", date_time: "2026-09-01T09:00:00" })],
    });
    const entries = quickEntries(data, "2026-09-08");
    expect(entries).toHaveLength(1);
    expect(entries[0].symptom_type).toBe("glare");
    expect(entries.some((e) => e.symptom_type === "flashes")).toBe(false);
  });

  it("keeps each eye separate", () => {
    const data = anAllData({
      symptoms: [
        aSymptom({ symptom_type: "floaters", eye: "left", date_time: "2026-09-01T09:00:00" }),
        aSymptom({ symptom_type: "floaters", eye: "right", date_time: "2026-09-01T09:00:00" }),
      ],
    });
    const entries = quickEntries(data, "2026-09-08");
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map((e) => e.eye))).toEqual(new Set(["left", "right"]));
  });

  it("carries their most recent comparison forward as the starting point", () => {
    const data = anAllData({
      symptoms: [
        aSymptom({
          symptom_type: "floaters",
          eye: "left",
          date_time: "2026-09-01T09:00:00",
          baseline_comparison: "same_as_usual",
        }),
        aSymptom({
          symptom_type: "floaters",
          eye: "left",
          date_time: "2026-09-05T09:00:00",
          baseline_comparison: "slightly_more",
        }),
      ],
    });
    expect(quickEntries(data, "2026-09-08")[0].comparison).toBe("slightly_more");
  });

  it("orders by how often they record it", () => {
    const data = anAllData({
      symptoms: [
        aSymptom({ symptom_type: "glare", eye: "left", date_time: "2026-09-01T09:00:00" }),
        aSymptom({ symptom_type: "floaters", eye: "left", date_time: "2026-09-02T09:00:00" }),
        aSymptom({ symptom_type: "floaters", eye: "left", date_time: "2026-09-03T09:00:00" }),
      ],
    });
    expect(quickEntries(data, "2026-09-08")[0].symptom_type).toBe("floaters");
  });

  it("excludes today's own entries, which are already on screen", () => {
    const data = anAllData({
      symptoms: [aSymptom({ symptom_type: "glare", eye: "left", date_time: "2026-09-08T09:00:00" })],
    });
    expect(quickEntries(data, "2026-09-08")).toEqual([]);
  });

  it("labels an entry in plain words", () => {
    const data = anAllData({
      symptoms: [
        aSymptom({
          symptom_type: "floaters",
          eye: "left",
          date_time: "2026-09-01T09:00:00",
          baseline_comparison: "same_as_usual",
        }),
      ],
    });
    expect(quickEntries(data, "2026-09-08")[0].label).toBe("floaters, left — same as usual");
  });
});

describe("yesterdaysEntries", () => {
  it("returns the most recent recorded day before today, whenever that was", () => {
    const data = anAllData({
      symptoms: [
        aSymptom({ id: "a", date_time: "2026-09-05T09:00:00" }),
        aSymptom({ id: "b", date_time: "2026-09-05T20:00:00" }),
        aSymptom({ id: "c", date_time: "2026-08-01T09:00:00" }),
      ],
    });
    const entries = yesterdaysEntries(data, "2026-09-08");
    expect(entries.map((e) => e.id).sort()).toEqual(["a", "b"]);
  });

  it("returns nothing when there is no history", () => {
    expect(yesterdaysEntries(anAllData(), "2026-09-08")).toEqual([]);
  });
});
