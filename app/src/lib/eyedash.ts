// The facts behind the My Eyes dashboard: one card per thing measured, and the treatments that
// sit on the same dates as a chart.
//
// Every position here is against the person's own readings, never a reference range. Nothing says
// whether a reading is good, expected or concerning, and no colour carries that meaning either.

import type { AllData } from "./db";
import { MEASUREMENT_LABELS, type MeasurementKind, type SourceType } from "./models";
import { seriesFor, type Series, type SeriesPoint } from "./trends";
import { isoToDateOnly } from "./util";

export type Side = "right" | "left";

/** Eye measurements only: HbA1c and blood pressure belong to the person, not to one eye. */
const EYE_KINDS = (Object.keys(MEASUREMENT_LABELS) as MeasurementKind[]).filter(
  (k) => k !== "hba1c" && k !== "blood_pressure",
);

/**
 * The measurements this person tracks, in a stable order: any kind with a reading for either eye.
 * A kind recorded for one eye still gets a card for the other, which then says "Not recorded".
 */
export function trackedKinds(data: AllData): MeasurementKind[] {
  const present = new Set(
    data.measurements
      .filter((m) => m.eye === "right" || m.eye === "left" || m.eye === "both")
      .map((m) => m.kind),
  );
  return EYE_KINDS.filter((k) => present.has(k));
}

export interface CardFacts {
  series: Series;
  /** The most recent entry, plotted or not ("CF" is still the latest thing written down). */
  latest?: SeriesPoint;
  /**
   * Where the latest sits between the person's own other readings of the same kind (clinic with
   * clinic, home with home), 0 at the left end and 1 at the right. Undefined with fewer than two
   * different numbers, because one value has nothing to sit between.
   */
  position?: number;
  /** The readings written at the two ends of the bar, as they were recorded. */
  leftEnd?: SeriesPoint;
  rightEnd?: SeriesPoint;
  /**
   * Values read out of a document and not yet checked against it. They are kept off the chart,
   * but a card with nothing else must not say "Not recorded" when a value is waiting.
   */
  unchecked: number;
  /** Why there is no position, so the card can say what is true rather than "nothing". */
  unplaced?: "none" | "single" | "not_numeric" | "all_same" | "only_of_its_way";
}

export function cardFacts(data: AllData, kind: MeasurementKind, eye: Side): CardFacts {
  const series = seriesFor(data, kind, eye);
  const latest = series.points[series.points.length - 1];
  const unchecked = data.measurements.filter(
    (m) =>
      m.kind === kind &&
      (m.eye === eye || m.eye === "both") &&
      m.source_type === "document_extracted" &&
      m.confirmed !== true,
  ).length;
  if (!latest) return { series, unchecked, unplaced: "none" };
  if (series.points.length === 1) return { series, latest, unchecked, unplaced: "single" };
  if (!latest.numeric) return { series, latest, unchecked, unplaced: "not_numeric" };

  const same = series.points.filter((p) => p.numeric && p.provenance === latest.provenance);
  if (same.length === 1) return { series, latest, unchecked, unplaced: "only_of_its_way" };
  // logMAR runs the opposite way to how acuity reads; the bar follows the chart, which flips it.
  const shown = (p: SeriesPoint) => (series.invertForDisplay ? -p.value : p.value);
  const left = same.reduce((a, b) => (shown(b) < shown(a) ? b : a));
  const right = same.reduce((a, b) => (shown(b) > shown(a) ? b : a));
  const span = shown(right) - shown(left);
  if (span === 0) return { series, latest, unchecked, unplaced: "all_same" };
  return {
    series,
    latest,
    unchecked,
    position: (shown(latest) - shown(left)) / span,
    leftEnd: left,
    rightEnd: right,
  };
}

export interface TreatmentMarker {
  date: string;
  /** What happened, in the record's own words. */
  text: string;
  kind: "procedure" | "medication";
  source: SourceType;
}

/**
 * Procedures and medicines for one eye (or both), dated, oldest first. A medicine marks the day it
 * started and, for an injection series, the most recent injection recorded.
 */
export function treatmentMarkers(data: AllData, eye: Side): TreatmentMarker[] {
  const forEye = (e: string) => e === eye || e === "both";
  const out: TreatmentMarker[] = [];
  for (const p of data.procedures) {
    if (!forEye(p.eye)) continue;
    const name = p.procedure_type.trim().toLowerCase() === "other" ? "Other procedure" : p.procedure_type;
    out.push({ date: isoToDateOnly(p.date), text: capitalise(name), kind: "procedure", source: p.source_type });
  }
  for (const m of data.medications) {
    if (!forEye(m.eye)) continue;
    const start = isoToDateOnly(m.start_date);
    out.push({ date: start, text: `${m.name} started`, kind: "medication", source: m.source_type });
    if (m.pattern === "injection_series" && m.last_given) {
      const last = isoToDateOnly(m.last_given);
      if (last !== start) {
        const n = m.cycle_number ? ` (injection ${m.cycle_number})` : "";
        out.push({ date: last, text: `${m.name}${n}`, kind: "medication", source: m.source_type });
      }
    }
    // An ended treatment must not look ongoing.
    if (m.end_date) {
      out.push({ date: isoToDateOnly(m.end_date), text: `${m.name} stopped`, kind: "medication", source: m.source_type });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.text.localeCompare(b.text));
}

function capitalise(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** The markers that fall within a chart's dates, inclusive. */
export function markersWithin(markers: TreatmentMarker[], from: string, to: string) {
  return markers.filter((m) => m.date >= from && m.date <= to);
}
