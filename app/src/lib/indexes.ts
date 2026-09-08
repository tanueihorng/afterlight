// Derived indexes over the record.
//
// Everything that reads the whole history — the timeline, search, ask, the brief — used to scan
// every array on every render. That is fine at two hundred records and unusable at twenty
// thousand, which is what a decade of daily entries looks like. These indexes are built once per
// data change and shared by all of them.

import type { AllData } from "./db";
import type { ImagingModality, SymptomEntry, TimelineEvent } from "./models";
import { buildTimeline } from "./store";
import { isoToDateOnly } from "./util";

export interface RecordIndexes {
  /** Newest first, the single chronology every view reads. */
  timeline: TimelineEvent[];
  /** Events grouped by calendar day, newest day first. */
  byDay: Map<string, TimelineEvent[]>;
  /** Days that have any event, newest first. */
  days: string[];
  symptomsByEye: Map<string, SymptomEntry[]>;
  symptomsByType: Map<string, SymptomEntry[]>;
  imagingByModality: Map<ImagingModality, AllData["imaging"]>;
  /** First time each symptom type was recorded for an eye, keyed `type|eye`. */
  firstSeen: Map<string, string>;
  totalRecords: number;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function buildIndexes(data: AllData): RecordIndexes {
  const timeline = buildTimeline(data);

  const byDay = new Map<string, TimelineEvent[]>();
  for (const event of timeline) push(byDay, isoToDateOnly(event.date_time), event);

  const symptomsByEye = new Map<string, SymptomEntry[]>();
  const symptomsByType = new Map<string, SymptomEntry[]>();
  const firstSeen = new Map<string, string>();
  for (const s of data.symptoms) {
    push(symptomsByEye, s.eye, s);
    push(symptomsByType, s.symptom_type, s);
    const key = `${s.symptom_type}|${s.eye}`;
    const current = firstSeen.get(key);
    if (!current || s.date_time < current) firstSeen.set(key, s.date_time);
  }

  const imagingByModality = new Map<ImagingModality, AllData["imaging"]>();
  for (const i of data.imaging) push(imagingByModality, i.modality, i);

  let totalRecords = 0;
  for (const list of Object.values(data)) if (Array.isArray(list)) totalRecords += list.length;

  return {
    timeline,
    byDay,
    days: [...byDay.keys()],
    symptomsByEye,
    symptomsByType,
    imagingByModality,
    firstSeen,
    totalRecords,
  };
}

/**
 * Cache keyed by the identity of the data object. The store replaces that object only on a write,
 * so a render that changes nothing reuses the indexes instead of rebuilding them.
 */
const cache = new WeakMap<AllData, RecordIndexes>();

export function indexesOf(data: AllData): RecordIndexes {
  const hit = cache.get(data);
  if (hit) return hit;
  const built = buildIndexes(data);
  cache.set(data, built);
  return built;
}

export function timelineOf(data: AllData): TimelineEvent[] {
  return indexesOf(data).timeline;
}
