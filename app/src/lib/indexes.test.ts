import { describe, expect, it } from "vitest";
import { buildIndexes, indexesOf, timelineOf } from "./indexes";
import { anAllData, aDrawing, anImaging, aSymptom } from "../test/factories";

describe("buildIndexes", () => {
  const data = anAllData({
    symptoms: [
      aSymptom({ eye: "left", symptom_type: "glare", date_time: "2026-08-22T20:00:00" }),
      aSymptom({ eye: "left", symptom_type: "glare", date_time: "2026-09-01T20:00:00" }),
      aSymptom({ eye: "right", symptom_type: "floaters", date_time: "2026-07-01T09:00:00" }),
    ],
    drawings: [aDrawing({ date_time: "2026-08-22T21:00:00" })],
    imaging: [anImaging({ date: "2026-08-24", modality: "OCT" })],
  });

  it("groups events by day, newest day first", () => {
    const { days, byDay } = buildIndexes(data);
    expect(days[0]).toBe("2026-09-01");
    expect(byDay.get("2026-08-22")).toHaveLength(2);
  });

  it("indexes symptoms by eye and by type without mixing them", () => {
    const { symptomsByEye, symptomsByType } = buildIndexes(data);
    expect(symptomsByEye.get("left")).toHaveLength(2);
    expect(symptomsByEye.get("right")).toHaveLength(1);
    expect(symptomsByType.get("glare")).toHaveLength(2);
  });

  it("records the earliest occurrence of each symptom for each eye", () => {
    const { firstSeen } = buildIndexes(data);
    expect(firstSeen.get("glare|left")).toBe("2026-08-22T20:00:00");
    expect(firstSeen.get("floaters|right")).toBe("2026-07-01T09:00:00");
  });

  it("counts every record", () => {
    expect(buildIndexes(data).totalRecords).toBe(5);
  });

  it("produces empty indexes for an empty record rather than throwing", () => {
    const empty = buildIndexes(anAllData());
    expect(empty.timeline).toEqual([]);
    expect(empty.days).toEqual([]);
    expect(empty.totalRecords).toBe(0);
  });
});

describe("caching", () => {
  it("returns the same indexes for the same data object", () => {
    const data = anAllData({ symptoms: [aSymptom()] });
    expect(indexesOf(data)).toBe(indexesOf(data));
    expect(timelineOf(data)).toBe(indexesOf(data).timeline);
  });

  it("rebuilds when the data object is replaced", () => {
    const a = anAllData({ symptoms: [aSymptom()] });
    const b = anAllData({ symptoms: [aSymptom(), aSymptom()] });
    expect(indexesOf(a)).not.toBe(indexesOf(b));
    expect(indexesOf(b).totalRecords).toBe(2);
  });
});
