import { describe, expect, it } from "vitest";
import { buildIndexes, indexesOf } from "./indexes";
import { generateBrief } from "./brief";
import { searchRecords, searchIndexOf } from "./search";
import { askRecords } from "./ask";
import { anAllData } from "../test/factories";
import type { AllData } from "./db";
import type { SymptomEntry, VisualFieldDrawing, ImagingRecord } from "./models";

/**
 * A decade of daily entries. These budgets are generous for CI hardware but tight enough that a
 * quadratic scan reintroduced anywhere will trip them.
 */
const YEARS = 10;
const SYMPTOMS = 20_000;
const DRAWINGS = 500;
const IMAGING = 200;

function bigRecord(): AllData {
  const symptoms: SymptomEntry[] = [];
  const types = ["floaters", "flashes", "glare", "blur", "dryness", "distortion"];
  for (let i = 0; i < SYMPTOMS; i++) {
    const day = new Date(2016, 0, 1 + Math.floor((i / SYMPTOMS) * 365 * YEARS));
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    symptoms.push({
      id: `s${i}`,
      date_time: `${iso}T09:00:00`,
      eye: i % 3 === 0 ? "right" : i % 3 === 1 ? "left" : "both",
      symptom_type: types[i % types.length],
      status: i % 7 === 0 ? "worse" : "same",
      severity: i % 10,
      description: `entry ${i}`,
      source_type: "patient_reported",
      created_at: `${iso}T09:00:00`,
      updated_at: `${iso}T09:00:00`,
    });
  }

  const drawings: VisualFieldDrawing[] = Array.from({ length: DRAWINGS }, (_, i) => ({
    id: `d${i}`,
    date_time: `2024-01-01T09:00:00`,
    eye: "left",
    canvas_data: { marks: [] },
    linked_symptoms: [],
    source_type: "patient_drawn",
    created_at: "2024-01-01T09:00:00",
    updated_at: "2024-01-01T09:00:00",
  }));

  const imaging: ImagingRecord[] = Array.from({ length: IMAGING }, (_, i) => ({
    id: `i${i}`,
    modality: "OCT",
    date: "2024-06-01",
    eye: "right",
    file_ids: [],
    source_type: "device_measurement",
    confirmed: true,
    created_at: "2024-06-01T09:00:00",
    updated_at: "2024-06-01T09:00:00",
  }));

  return anAllData({ symptoms, drawings, imaging });
}

function ms(fn: () => unknown): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

describe(`a ten-year record (${SYMPTOMS} symptoms, ${DRAWINGS} drawings, ${IMAGING} scans)`, () => {
  const data = bigRecord();

  it("builds the timeline and indexes in under 1500ms", () => {
    const elapsed = ms(() => buildIndexes(data));
    console.log(`  index build: ${elapsed.toFixed(0)}ms`);
    expect(elapsed).toBeLessThan(1500);
  });

  it("reuses the indexes on the second read", () => {
    indexesOf(data);
    const elapsed = ms(() => indexesOf(data));
    console.log(`  cached index read: ${elapsed.toFixed(3)}ms`);
    expect(elapsed).toBeLessThan(1);
  });

  it("searches in under 400ms cold and under 150ms warm", () => {
    const cold = ms(() => searchRecords(data, "glare left eye"));
    searchIndexOf(data);
    const warm = ms(() => searchRecords(data, "floaters"));
    console.log(`  search cold: ${cold.toFixed(0)}ms, warm: ${warm.toFixed(0)}ms`);
    expect(cold).toBeLessThan(400);
    expect(warm).toBeLessThan(150);
  });

  it("generates a brief in under 300ms", () => {
    const elapsed = ms(() =>
      generateBrief(data, { range_start: "2025-01-01", range_end: "2026-01-01" }),
    );
    console.log(`  brief: ${elapsed.toFixed(0)}ms`);
    expect(elapsed).toBeLessThan(300);
  });

  it("answers a question in under 300ms", () => {
    const elapsed = ms(() => askRecords(data, "When did glare in my left eye first appear?"));
    console.log(`  ask: ${elapsed.toFixed(0)}ms`);
    expect(elapsed).toBeLessThan(300);
  });

  it("keeps every symptom in the timeline — no silent truncation", () => {
    const { timeline, totalRecords } = buildIndexes(data);
    expect(totalRecords).toBe(SYMPTOMS + DRAWINGS + IMAGING);
    expect(timeline.length).toBe(SYMPTOMS + DRAWINGS + IMAGING);
  });
});
