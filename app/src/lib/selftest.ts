// Home self-tests: comparison, not measurement.
//
// The purpose of these is narrow and worth stating plainly. They turn "I think it's worse" into
// a dated, repeatable observation the person made the same way each time. They are NOT a
// measurement of vision, they are not comparable with a clinic's chart, and a change in one is
// not evidence of anything on its own.
//
// The whole design follows from that: results are only ever compared with the same person's
// earlier attempts under the same conditions, nothing is scored, nothing passes or fails, and a
// result taken under different conditions is shown as not comparable rather than plotted anyway.

import type { SelfTestKind, SelfTestResult, TestConditions } from "./models";
import { conditionsComplete } from "./models";
import { formatDate, isoToDateOnly } from "./util";

/** A credit card is 85.60 mm wide, which makes it a ruler almost everyone has. */
export const CARD_WIDTH_MM = 85.6;

export interface Calibration {
  px_per_mm: number;
}

export function calibrationFromCardWidth(cardWidthPx: number): Calibration | null {
  if (!Number.isFinite(cardWidthPx) || cardWidthPx <= 0) return null;
  return { px_per_mm: cardWidthPx / CARD_WIDTH_MM };
}

/**
 * The height in millimetres a letter must be to subtend a given logMAR at a given distance.
 * A Snellen letter is five minutes of arc at the reference size.
 */
export function letterHeightMm(logmar: number, distanceCm: number): number {
  const distanceMm = distanceCm * 10;
  const arcMinutes = 5 * 10 ** logmar;
  return 2 * distanceMm * Math.tan((arcMinutes / 60 / 2) * (Math.PI / 180));
}

export function letterHeightPx(logmar: number, distanceCm: number, calibration: Calibration): number {
  return letterHeightMm(logmar, distanceCm) * calibration.px_per_mm;
}

/** Whether a test is usable at all on this screen at this distance. */
export function stepIsRenderable(
  logmar: number,
  distanceCm: number,
  calibration: Calibration,
  minPx = 6,
): boolean {
  return letterHeightPx(logmar, distanceCm, calibration) >= minPx;
}

/* ------------------------------------------------------------- comparison */

export type Comparability = "comparable" | "conditions_differ" | "conditions_missing";

/**
 * Whether two attempts can be put side by side. Deliberately strict: a difference produced by
 * standing closer or turning the brightness up would be indistinguishable from a change in vision,
 * and presenting it as the latter would be the worst thing this app could do.
 */
export function comparability(a: SelfTestResult, b: SelfTestResult): Comparability {
  if (!conditionsComplete(a.conditions) || !conditionsComplete(b.conditions)) {
    return "conditions_missing";
  }
  const sameDistance =
    a.conditions.distance_cm !== undefined &&
    b.conditions.distance_cm !== undefined &&
    Math.abs(a.conditions.distance_cm - b.conditions.distance_cm) <= 5;

  const same =
    sameDistance &&
    a.conditions.brightness === b.conditions.brightness &&
    a.conditions.ambient === b.conditions.ambient &&
    a.conditions.correction === b.conditions.correction;

  return same ? "comparable" : "conditions_differ";
}

export const COMPARABILITY_NOTE: Record<Comparability, string> = {
  comparable: "Taken the same way as the earlier attempt.",
  conditions_differ:
    "Taken under different conditions from the earlier attempt, so the two cannot be compared.",
  conditions_missing:
    "The conditions of one of these attempts were not recorded, so they cannot be compared.",
};

export interface SelfTestSeries {
  kind: SelfTestKind;
  eye: "right" | "left";
  results: SelfTestResult[];
  /** Results that can be compared with the most recent one, most recent first. */
  comparable: SelfTestResult[];
}

export function seriesFor(
  results: SelfTestResult[],
  kind: SelfTestKind,
  eye: "right" | "left",
): SelfTestSeries {
  const ordered = results
    .filter((r) => r.kind === kind && r.eye === eye)
    .sort((a, b) => b.date_time.localeCompare(a.date_time));
  const latest = ordered[0];
  return {
    kind,
    eye,
    results: ordered,
    comparable: latest
      ? ordered.filter((r) => r.id === latest.id || comparability(latest, r) === "comparable")
      : [],
  };
}

/**
 * A factual sentence about a series. No trend, no direction, no judgement — the numbers and the
 * dates, and an explicit statement when they are not comparable.
 */
export function describeSeries(series: SelfTestSeries): string {
  if (series.results.length === 0) return "No attempts recorded.";
  const latest = series.results[0];
  const date = formatDate(isoToDateOnly(latest.date_time));

  if (series.results.length === 1) {
    return `One attempt, on ${date}. A single attempt has nothing to compare against yet.`;
  }

  const previous = series.results[1];
  const status = comparability(latest, previous);
  if (status !== "comparable") {
    return `${series.results.length} attempts, most recently ${date}. ${COMPARABILITY_NOTE[status]}`;
  }
  return `${series.results.length} attempts, most recently ${date}, ${series.comparable.length} of them taken the same way.`;
}

/** The wording every self-test screen must carry, in one place so it cannot drift. */
export const SELF_TEST_BOUNDARY =
  "This is a check you do yourself, to compare with your own earlier attempts. It is not a measurement of your vision and it cannot be compared with a test done at a clinic.";

export function homeAcuityNotation(logmar: number): string {
  const denominator = 6 * 10 ** logmar;
  const rounded = denominator >= 5 ? Math.round(denominator) : Math.round(denominator * 10) / 10;
  // Always carrying the qualifier: this string must never be readable as a clinical acuity.
  return `about 6/${rounded} on a home screen check`;
}

export function conditionsSummary(c: TestConditions): string {
  const parts: string[] = [];
  if (c.distance_cm) parts.push(`${c.distance_cm} cm away`);
  if (c.correction) {
    parts.push(
      c.correction === "none" ? "without glasses" : c.correction === "glasses" ? "with glasses" : "with contact lenses",
    );
  }
  if (c.brightness) parts.push(`screen brightness ${c.brightness}`);
  if (c.ambient) parts.push(`${c.ambient} room`);
  return parts.join(", ");
}
