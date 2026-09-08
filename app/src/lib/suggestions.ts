// Quick entries built from what this person has actually recorded before.
//
// Never a generic symptom list: suggesting symptoms someone has not reported risks putting words
// in a patient's mouth, and a record of prompted answers is worth less to a clinician than a
// record of volunteered ones.

import type { AllData } from "./db";
import type { BaselineComparison, SymptomEntry } from "./models";
import { isoToDateOnly } from "./util";

export interface QuickEntry {
  symptom_type: string;
  eye: "right" | "left";
  /** Their most recent comparison for this symptom and eye, offered as the starting point. */
  comparison: BaselineComparison;
  /** How many times they have recorded this, used only for ordering. */
  count: number;
  label: string;
}

const COMPARISON_WORDS: Record<BaselineComparison, string> = {
  same_as_usual: "same as usual",
  slightly_more: "slightly more",
  much_more: "much more",
  fewer: "fewer",
  different_appearance: "different",
  new: "new",
};

/**
 * The handful of entries this person is most likely to make again, most recent and most frequent
 * first. Returns nothing for a new record — there is nothing to repeat yet.
 */
export function quickEntries(data: AllData, today: string, limit = 6): QuickEntry[] {
  const groups = new Map<string, { rows: SymptomEntry[]; latest: string }>();

  for (const s of data.symptoms) {
    if (s.eye !== "right" && s.eye !== "left") continue;
    // Today's own entries are already on screen.
    if (isoToDateOnly(s.date_time) === today) continue;
    const key = `${s.symptom_type}|${s.eye}`;
    const group = groups.get(key);
    if (group) {
      group.rows.push(s);
      if (s.date_time > group.latest) group.latest = s.date_time;
    } else {
      groups.set(key, { rows: [s], latest: s.date_time });
    }
  }

  const entries: QuickEntry[] = [];
  for (const [key, group] of groups) {
    const [symptom_type, eye] = key.split("|") as [string, "right" | "left"];
    const mostRecent = group.rows.reduce((a, b) => (a.date_time > b.date_time ? a : b));
    const comparison = mostRecent.baseline_comparison ?? "same_as_usual";
    entries.push({
      symptom_type,
      eye,
      comparison,
      count: group.rows.length,
      label: `${symptom_type}, ${eye === "right" ? "right" : "left"} — ${COMPARISON_WORDS[comparison]}`,
    });
  }

  // Frequency first, then recency: what they log often and logged lately.
  entries.sort((a, b) => b.count - a.count);
  return entries.slice(0, limit);
}

/** Everything recorded on the most recent day before today that has any entry. */
export function yesterdaysEntries(data: AllData, today: string): SymptomEntry[] {
  const before = data.symptoms.filter((s) => isoToDateOnly(s.date_time) < today);
  if (before.length === 0) return [];
  const lastDay = before.reduce((a, b) => (a.date_time > b.date_time ? a : b));
  const day = isoToDateOnly(lastDay.date_time);
  return before.filter((s) => isoToDateOnly(s.date_time) === day);
}
