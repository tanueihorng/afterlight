import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { EMPTY_DATA, dbDelete, dbPatch, dbPut, loadMigrated, type AllData } from "./db";
import { indexesOf, type RecordIndexes } from "./indexes";
import type { AppMeta, EyeBaseline, StoredFile, SymptomEntry, TimelineEvent } from "./models";
import { SELF_TEST_LABELS } from "./models";
import { isoToDateOnly, nowISO, todayLocal } from "./util";

export type EntityLists = AllData;

export interface EntityOps<T> {
  put: (v: T) => Promise<void>;
  del: (id: string) => Promise<void>;
}

type EntityProps = {
  [K in keyof EntityLists]: EntityOps<EntityLists[K][number]> & { list: EntityLists[K] };
};

export interface StoreShape extends EntityProps {
  ready: boolean;
  meta?: AppMeta;
  /** The entity lists as one stable object; replaced only when something is written. */
  data: AllData;
  /** Descriptions of any schema migrations applied when this session loaded. */
  migrationNotes: string[];
  putFile: (v: StoredFile) => Promise<void>;
  setMeta: (patch: Partial<AppMeta>) => Promise<void>;
  clearAll: () => Promise<void>;
}

const StoreCtx = createContext<StoreShape | null>(null);

type EntityKey = keyof EntityLists;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<EntityLists>(EMPTY_DATA);
  const [meta, setMetaState] = useState<AppMeta | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [migrationNotes, setMigrationNotes] = useState<string[]>([]);
  /** Latest meta, readable synchronously so successive patches compose. */
  const metaRef = useRef<AppMeta | undefined>(undefined);
  /** Serialises meta writes so they reach storage in the order they were made. */
  const metaWrites = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    loadMigrated().then(({ meta: m, migrated, ...lists }) => {
      setData(lists as EntityLists);
      metaRef.current = m;
      setMetaState(m);
      setMigrationNotes(migrated ?? []);
      setReady(true);
    });
  }, []);

  const put = useCallback((key: EntityKey, value: unknown) => {
    setData((d) => {
      const list = d[key] as unknown[];
      const idx = list.findIndex(
        (x) => (x as { id: string }).id === (value as { id: string }).id
      );
      const next = [...list];
      if (idx >= 0) next[idx] = value;
      else next.push(value);
      return { ...d, [key]: next };
    });
    return dbPut(key, value).then(() => undefined);
  }, []);

  const remove = useCallback((key: EntityKey, id: string) => {
    setData((d) => ({
      ...d,
      [key]: (d[key] as unknown[]).filter((x) => (x as { id: string }).id !== id),
    }));
    return dbDelete(key, id).then(() => undefined);
  }, []);

  const store = useMemo<StoreShape>(() => {
    function ops<K extends EntityKey>(key: K): EntityProps[K] {
      return {
        list: data[key],
        put: (v) => put(key, v),
        del: (id: string) => remove(key, id),
      } as EntityProps[K];
    }
    return {
      ready,
      meta,
      data,
      migrationNotes,
      symptoms: ops("symptoms"),
      dailyLogs: ops("dailyLogs"),
      floaters: ops("floaters"),
      drawings: ops("drawings"),
      appointments: ops("appointments"),
      questions: ops("questions"),
      diagnoses: ops("diagnoses"),
      procedures: ops("procedures"),
      medications: ops("medications"),
      prescriptions: ops("prescriptions"),
      measurements: ops("measurements"),
      selfTests: ops("selfTests"),
      imaging: ops("imaging"),
      documents: ops("documents"),
      baselines: ops("baselines"),
      briefs: ops("briefs"),
      putFile: (v) => dbPut("files", v).then(() => undefined),
      setMeta: (patch) => {
        // Writes are serialised through one chain and performed outside the state updater.
        // Firing them from inside meant two quick changes — picking a theme and then a text size —
        // could reach IndexedDB out of order and persist the older value.
        const next = {
          id: "meta" as const,
          onboarded: false,
          theme: "dark" as const,
          demo_seeded: false,
          ...metaRef.current,
          ...patch,
        };
        metaRef.current = next;
        setMetaState(next);
        metaWrites.current = metaWrites.current
          .then(() => dbPatch<AppMeta>("meta", "meta", patch))
          .then(() => undefined);
        return metaWrites.current;
      },
      clearAll: () => {
        setData(EMPTY_DATA);
        metaRef.current = undefined;
        setMetaState(undefined);
        return Promise.resolve();
      },
    };
  }, [data, meta, ready, migrationNotes, put, remove]);

  return <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreShape {
  const s = useContext(StoreCtx);
  if (!s) throw new Error("useStore must be used within StoreProvider");
  return s;
}

/** Factory for new records: id + timestamps first, caller patches the rest. */
export function newRecord<T extends object>(
  patch: T
): T & { id: string; created_at: string; updated_at: string } {
  return {
    id: crypto.randomUUID(),
    created_at: nowISO(),
    updated_at: nowISO(),
    ...patch,
  };
}

/** Generic timeline view derived from all stored entities. */
export function buildTimeline(s: AllData): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const push = (e: TimelineEvent) => events.push(e);

  for (const l of s.dailyLogs) {
    push({
      id: `log-${l.id}`,
      event_type: "daily_log",
      entity_id: l.id,
      date_time: l.date,
      eye: "both",
      title: l.overall === "no_change" ? "No change today" : "Daily log",
      summary: l.note || undefined,
      source_type: l.source_type,
      demo: l.demo,
      icon: "◐",
    });
  }
  for (const x of s.symptoms) {
    const tag =
      x.status === "new"
        ? "New"
        : x.status === "worse"
          ? "Worse"
          : x.status === "better"
            ? "Better"
            : x.status === "resolved"
              ? "Resolved"
              : "Unchanged";
    push({
      id: `sym-${x.id}`,
      event_type: "symptom",
      entity_id: x.id,
      date_time: x.date_time,
      eye: x.eye,
      title: `${tag} — ${x.symptom_type}`,
      summary:
        x.description ||
        (x.severity != null && x.severity > 0 ? `Severity ${x.severity}/10` : undefined),
      source_type: x.source_type,
      demo: x.demo,
      icon: "•",
    });
  }
  for (const d of s.drawings) {
    push({
      id: `drw-${d.id}`,
      event_type: "drawing",
      entity_id: d.id,
      date_time: d.date_time,
      eye: d.eye,
      title: "Visual field drawing",
      summary: d.description || undefined,
      source_type: d.source_type,
      demo: d.demo,
      icon: "✧",
    });
  }
  for (const f of s.floaters) {
    if (f.baseline) continue;
    push({
      id: `flt-${f.id}`,
      event_type: "floater",
      entity_id: f.id,
      date_time: f.first_seen,
      eye: f.eye,
      title: `Floater first recorded — ${f.nickname || f.shape}`,
      summary: f.appearance,
      source_type: "patient_reported",
      demo: f.demo,
      icon: "·",
    });
  }
  for (const a of s.appointments) {
    push({
      id: `apt-${a.id}`,
      event_type: "appointment",
      entity_id: a.id,
      date_time: a.date_time,
      eye: "not_applicable",
      title: a.reason || "Appointment",
      summary: [a.clinic, a.clinician].filter(Boolean).join(" · ") || undefined,
      source_type: "clinician_reported",
      demo: a.demo,
      icon: "✚",
    });
  }
  for (const d of s.diagnoses) {
    push({
      id: `dx-${d.id}`,
      event_type: "diagnosis",
      entity_id: d.id,
      date_time: d.first_documented,
      eye: d.eye,
      title: `Diagnosis — ${d.name}`,
      summary: d.status,
      source_type: d.source_type,
      demo: d.demo,
      icon: "❖",
    });
  }
  for (const p of s.procedures) {
    push({
      id: `prc-${p.id}`,
      event_type: "procedure",
      entity_id: p.id,
      date_time: p.date,
      eye: p.eye,
      title: p.procedure_type,
      summary: p.surgeon || p.facility,
      source_type: "clinician_reported",
      demo: p.demo,
      icon: "⚕",
    });
  }
  for (const m of s.medications) {
    push({
      id: `med-${m.id}`,
      event_type: "medication",
      entity_id: m.id,
      date_time: m.start_date,
      eye: m.eye,
      title: `${m.kind === "prescription" ? "Medication" : "Self-care"} — ${m.name}`,
      summary: [m.dose, m.frequency].filter(Boolean).join(" · ") || undefined,
      source_type: m.kind === "prescription" ? "clinician_reported" : "patient_reported",
      demo: m.demo,
      icon: "℞",
    });
  }
  for (const p of s.prescriptions) {
    push({
      id: `rx-${p.id}`,
      event_type: "prescription",
      entity_id: p.id,
      date_time: p.date,
      eye: "both",
      title: "Glasses / contact prescription",
      summary: p.provider,
      source_type: "clinician_reported",
      demo: p.demo,
      icon: "℞",
    });
  }
  for (const m of s.measurements) {
    push({
      id: `mea-${m.id}`,
      event_type: "measurement",
      entity_id: m.id,
      date_time: m.date,
      eye: m.eye,
      title: `Measurement — ${m.kind}: ${m.value}${m.unit ?? ""}`,
      summary: m.note,
      source_type: m.source_type,
      demo: m.demo,
      icon: "≡",
    });
  }
  for (const i of s.imaging) {
    push({
      id: `img-${i.id}`,
      event_type: "imaging",
      entity_id: i.id,
      date_time: i.date,
      eye: i.eye,
      title: `${i.modality.toUpperCase()} imaging`,
      summary: i.clinic || i.findings,
      source_type: i.source_type,
      demo: i.demo,
      icon: "▣",
    });
  }
  for (const t of s.selfTests) {
    push({
      id: `selftest-${t.id}`,
      event_type: "self_test",
      entity_id: t.id,
      date_time: t.date_time,
      eye: t.eye,
      title: `${SELF_TEST_LABELS[t.kind]} — check you did yourself`,
      summary:
        t.result.notation ??
        (t.result.marks !== undefined
          ? `${t.result.marks} area${t.result.marks === 1 ? "" : "s"} marked`
          : undefined),
      source_type: t.source_type,
      demo: t.demo,
      icon: "◎",
    });
  }
  for (const d of s.documents) {
    push({
      id: `doc-${d.id}`,
      event_type: "document",
      entity_id: d.id,
      date_time: d.date,
      eye: d.eye,
      title: `Document — ${d.title}`,
      summary: d.doc_type,
      source_type: d.source_type,
      demo: d.demo,
      icon: "▤",
    });
  }

  events.sort((a, b) => (a.date_time < b.date_time ? 1 : a.date_time > b.date_time ? -1 : 0));
  return events;
}

export function useTimeline(): TimelineEvent[] {
  const data = useStore().data;
  return useMemo(() => indexesOf(data).timeline, [data]);
}

/** The derived indexes for the current record. Cheap: cached on the data object's identity. */
export function useIndexes(): RecordIndexes {
  const data = useStore().data;
  return useMemo(() => indexesOf(data), [data]);
}

/**
 * The entity lists, for the pure functions (brief, search, ask) that work over the whole record.
 *
 * The store keeps one stable `data` object and replaces it only when something is written, so this
 * is a field read rather than a fresh allocation on every render — which is what makes the
 * derivation caches below effective.
 */
export function toAllData(s: StoreShape): AllData {
  return s.data;
}

export function baselineFor(s: AllData, eye: "right" | "left"): EyeBaseline | undefined {
  return s.baselines.find((b) => b.id === eye);
}

export function symptomsOnDate(s: AllData, date: string): SymptomEntry[] {
  return s.symptoms.filter((x) => isoToDateOnly(x.date_time) === date);
}

export const TODAY = todayLocal;
