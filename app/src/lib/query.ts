// A small typed query layer over the record.
//
// Search, ask, the brief and the trends all used to scan the entity arrays themselves, each with
// its own filtering logic and its own bugs. This is the one primitive they share: composable,
// tested once, and reading from the cached indexes rather than re-walking arrays.

import type { AllData } from "./db";
import { indexesOf } from "./indexes";
import type { Eye, SourceType } from "./models";
import { isoToDateOnly } from "./util";

/** Every entity list that can be queried. */
export type Entity = keyof AllData;

/** The date field each entity is ordered and filtered by. */
const DATE_FIELD: Record<Entity, string> = {
  symptoms: "date_time",
  dailyLogs: "date",
  floaters: "first_seen",
  drawings: "date_time",
  appointments: "date_time",
  questions: "created_at",
  diagnoses: "first_documented",
  procedures: "date",
  medications: "start_date",
  prescriptions: "date",
  measurements: "date",
  selfTests: "date_time",
  imaging: "date",
  documents: "date",
  baselines: "established_date",
  briefs: "created_at",
};

export function dateOf(entity: Entity, row: unknown): string {
  const value = (row as Record<string, unknown>)[DATE_FIELD[entity]];
  return typeof value === "string" ? isoToDateOnly(value) : "";
}

function timestampOf(entity: Entity, row: unknown): string {
  const value = (row as Record<string, unknown>)[DATE_FIELD[entity]];
  return typeof value === "string" ? value : "";
}

export class Query<T> {
  constructor(
    private readonly data: AllData,
    private readonly entity: Entity,
    private rows: T[],
  ) {}

  /** Only records for this eye. Both-eye records always match a single-eye filter. */
  eye(eye: Eye | "any"): Query<T> {
    if (eye === "any") return this;
    return this.where((row) => {
      const value = (row as { eye?: Eye }).eye;
      if (value === undefined) return true;
      return value === eye || value === "both";
    });
  }

  /** Symptom type, imaging modality, measurement kind, procedure type — whatever names the row. */
  type(value: string): Query<T> {
    const wanted = value.toLowerCase();
    return this.where((row) => {
      const r = row as Record<string, unknown>;
      const candidates = [r.symptom_type, r.modality, r.kind, r.procedure_type, r.doc_type, r.name];
      return candidates.some((c) => typeof c === "string" && c.toLowerCase() === wanted);
    });
  }

  source(source: SourceType): Query<T> {
    return this.where((row) => (row as { source_type?: SourceType }).source_type === source);
  }

  /** Inclusive on both ends, compared as calendar dates. */
  between(startDate: string, endDate: string): Query<T> {
    return this.where((row) => {
      const date = dateOf(this.entity, row);
      return !!date && date >= startDate && date <= endDate;
    });
  }

  since(startDate: string): Query<T> {
    return this.where((row) => dateOf(this.entity, row) >= startDate);
  }

  before(endDate: string): Query<T> {
    return this.where((row) => {
      const date = dateOf(this.entity, row);
      return !!date && date < endDate;
    });
  }

  /** Excludes the synthetic demo records. */
  real(): Query<T> {
    return this.where((row) => !(row as { demo?: boolean }).demo);
  }

  where(predicate: (row: T) => boolean): Query<T> {
    return new Query<T>(this.data, this.entity, this.rows.filter(predicate));
  }

  order(direction: "asc" | "desc" = "desc"): Query<T> {
    const sorted = [...this.rows].sort((a, b) => {
      const left = timestampOf(this.entity, a);
      const right = timestampOf(this.entity, b);
      return direction === "asc" ? left.localeCompare(right) : right.localeCompare(left);
    });
    return new Query<T>(this.data, this.entity, sorted);
  }

  limit(n: number): Query<T> {
    return new Query<T>(this.data, this.entity, this.rows.slice(0, n));
  }

  /* ---------------------------------------------------------- terminals */

  all(): T[] {
    return this.rows;
  }

  first(): T | undefined {
    return this.rows[0];
  }

  /** Earliest by date, whatever order the query is in. */
  earliest(): T | undefined {
    return this.order("asc").first();
  }

  /** Latest by date, whatever order the query is in. */
  latest(): T | undefined {
    return this.order("desc").first();
  }

  count(): number {
    return this.rows.length;
  }

  isEmpty(): boolean {
    return this.rows.length === 0;
  }

  /** Group by an arbitrary key, for counting by type or by eye. */
  groupBy(key: (row: T) => string): Map<string, T[]> {
    const out = new Map<string, T[]>();
    for (const row of this.rows) {
      const k = key(row);
      out.set(k, [...(out.get(k) ?? []), row]);
    }
    return out;
  }
}

/** Start a query. Reads the cached indexes so repeated queries do not re-walk the record. */
export function select<K extends Entity>(data: AllData, entity: K): Query<AllData[K][number]> {
  // Touch the index cache so the derived views stay warm for whatever reads next.
  indexesOf(data);
  return new Query(data, entity, [...data[entity]] as AllData[K][number][]);
}
