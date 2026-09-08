import { useEffect, useMemo, useState } from "react";
import { useStore, useTimeline } from "../lib/store";
import type { TimelineEvent } from "../lib/models";
import { EYE_SHORT, SOURCE_LABELS } from "../lib/models";
import { DemoBadge, EmptyState, EyeBadge, Modal, PageHeader, ProvenanceBadge } from "../components/ui";
import { formatDate, formatTime, isoToDateOnly, todayLocal, daysAgoISO } from "../lib/util";

const CATEGORIES = [
  { id: "daily_log", label: "Daily logs" },
  { id: "symptom", label: "Symptoms" },
  { id: "floater", label: "Floaters" },
  { id: "drawing", label: "Drawings" },
  { id: "imaging", label: "Imaging" },
  { id: "appointment", label: "Appointments" },
  { id: "diagnosis", label: "Diagnoses" },
  { id: "procedure", label: "Procedures" },
  { id: "medication", label: "Medications" },
  { id: "prescription", label: "Prescriptions" },
  { id: "measurement", label: "Measurements" },
  { id: "document", label: "Documents" },
] as const;

const RANGES = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "3m", label: "3 months" },
  { id: "1y", label: "1 year" },
  { id: "since_appt", label: "Since last appointment" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom" },
] as const;

/** Days rendered at once; the rest load on request. */
const DAY_PAGE = 60;

export default function TimelinePage() {
  const store = useStore();
  const timeline = useTimeline();
  const [eyeFilter, setEyeFilter] = useState<"all" | "right" | "left" | "both">("all");
  const [cats, setCats] = useState<Set<string>>(new Set(CATEGORIES.map((c) => c.id)));
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("30d");
  const [customStart, setCustomStart] = useState(daysAgoISO(30));
  const [customEnd, setCustomEnd] = useState(todayLocal());
  const [detail, setDetail] = useState<TimelineEvent | null>(null);

  const rangeStart = useMemo(() => {
    switch (range) {
      case "7d":
        return daysAgoISO(7);
      case "30d":
        return daysAgoISO(30);
      case "3m":
        return daysAgoISO(90);
      case "1y":
        return daysAgoISO(365);
      case "since_appt": {
        const past = store.appointments.list
          .filter((a) => a.date_time <= new Date().toISOString())
          .sort((a, b) => (a.date_time < b.date_time ? 1 : -1));
        return past[0] ? isoToDateOnly(past[0].date_time) : daysAgoISO(30);
      }
      case "custom":
        return customStart;
      default:
        return "0000-01-01";
    }
  }, [range, customStart, store.appointments]);

  const filtered = timeline.filter((e) => {
    const d = isoToDateOnly(e.date_time);
    if (d < rangeStart || d > (range === "custom" ? customEnd : todayLocal())) return false;
    if (eyeFilter !== "all" && e.eye !== "not_applicable") {
      // whole-record events (appointments, documents…) stay visible; eye-specific rows must match
      if (e.eye !== eyeFilter && e.eye !== "both") return false;
    }
    if (!cats.has(e.event_type)) return false;
    return true;
  });

  const byDay = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const e of filtered) {
      const d = isoToDateOnly(e.date_time);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  // Render a window of days and extend it as the reader reaches the end. A decade of daily
  // entries is thousands of days; mounting them all is what makes a long history feel broken.
  const [visibleDays, setVisibleDays] = useState(DAY_PAGE);
  useEffect(() => setVisibleDays(DAY_PAGE), [range, eyeFilter, cats, customStart, customEnd]);
  const shownDays = byDay.slice(0, visibleDays);
  const moreDays = byDay.length - shownDays.length;

  return (
    <>
      <PageHeader
        title="Timeline"
        sub="What happened first, what changed, what has remained stable — symptoms, drawings, scans and clinical events on one continuous record."
      />

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="btn-row" style={{ marginBottom: 10 }}>
          <span className="muted" style={{ minWidth: 48 }}>Range:</span>
          {RANGES.map((r) => (
            <button
              key={r.id}
              className={`btn subtle ${range === r.id ? "primary" : ""}`}
              style={{ minHeight: "var(--target)", padding: "3px 12px", fontSize: "var(--fs-sm)" }}
              onClick={() => setRange(r.id)}
              aria-pressed={range === r.id}
            >
              {r.label}
            </button>
          ))}
        </div>
        {range === "custom" && (
          <div className="btn-row" style={{ marginBottom: 10 }}>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} aria-label="Start date" style={{ width: 160 }} />
            <span className="muted">→</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} aria-label="End date" style={{ width: 160 }} />
          </div>
        )}
        <div className="btn-row" style={{ marginBottom: 10 }}>
          <span className="muted" style={{ minWidth: 48 }}>Eye:</span>
          {(["all", "right", "left", "both"] as const).map((e) => (
            <button
              key={e}
              className={`btn subtle ${eyeFilter === e ? "primary" : ""}`}
              style={{ minHeight: "var(--target)", padding: "3px 12px", fontSize: "var(--fs-sm)" }}
              onClick={() => setEyeFilter(e)}
              aria-pressed={eyeFilter === e}
            >
              {e === "all" ? "All" : EYE_SHORT[e]}
            </button>
          ))}
        </div>
        <div className="btn-row">
          <span className="muted" style={{ minWidth: 48 }}>Show:</span>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`btn subtle ${cats.has(c.id) ? "primary" : ""}`}
              style={{ minHeight: "var(--target)", padding: "2px 10px", fontSize: "var(--fs-sm)" }}
              onClick={() =>
                setCats((prev) => {
                  const next = new Set(prev);
                  if (next.has(c.id)) next.delete(c.id);
                  else next.add(c.id);
                  return next;
                })
              }
              aria-pressed={cats.has(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {byDay.length === 0 ? (
        <EmptyState title="Nothing on the timeline for this view.">
          Widen the date range or filters. Every daily log, symptom, drawing, scan, appointment and
          treatment appears here on one continuous record.
        </EmptyState>
      ) : (
        <div className="timeline">
          {byDay.map(([date, events]) => (
            <div className="tl-day" key={date}>
              <div className="tl-day-date">{formatDate(date)}</div>
              {events.map((e) => (
                <button
                  key={e.id}
                  className="tl-event"
                  onClick={() => setDetail(e)}
                  style={{ width: "100%", cursor: "pointer", textAlign: "left", color: "inherit", font: "inherit" }}
                >
                  <span className="tl-icon" aria-hidden>
                    {e.icon}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span className="tl-title">{e.title}</span>
                    {e.summary && (
                      <>
                        <br />
                        <span className="tl-summary">{e.summary}</span>
                      </>
                    )}
                  </span>
                  <span className="tl-meta">
                    <EyeBadge eye={e.eye} />
                    {/* The timeline is where patient-reported and clinician-documented entries sit
                        side by side, so the source has to be visible on the row itself. */}
                    <ProvenanceBadge source={e.source_type} />
                    <DemoBadge demo={e.demo} />
                    <span className="muted" style={{ fontSize: "var(--fs-sm)" }}>
                      {e.date_time.length > 10 ? formatTime(e.date_time) : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {moreDays > 0 && (
        <div className="btn-row" style={{ justifyContent: "center", marginTop: 16 }}>
          <button className="btn" onClick={() => setVisibleDays((n) => n + DAY_PAGE)}>
            Show earlier entries ({moreDays} more {moreDays === 1 ? "day" : "days"})
          </button>
          <button className="btn subtle" onClick={() => setVisibleDays(byDay.length)}>
            Show all
          </button>
        </div>
      )}

      {detail && <EventDetail event={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function EventDetail({ event, onClose }: { event: TimelineEvent; onClose: () => void }) {
  const store = useStore();
  const body = (() => {
    switch (event.event_type) {
      case "symptom": {
        const s = store.symptoms.list.find((x) => x.id === event.entity_id);
        if (!s) return <p className="muted">This entry no longer exists.</p>;
        return (
          <dl className="kv">
            <dt>Symptom</dt>
            <dd>{s.symptom_type}</dd>
            <dt>Compared with usual</dt>
            <dd>{s.baseline_comparison?.replace(/_/g, " ") ?? "not recorded"}</dd>
            {s.severity != null && (
              <>
                <dt>Severity</dt>
                <dd>{s.severity}/10</dd>
              </>
            )}
            <dt>Description</dt>
            <dd>{s.description ?? "—"}</dd>
            <dt>Recorded</dt>
            <dd>
              {formatDate(isoToDateOnly(s.date_time))} {formatTime(s.date_time)}
            </dd>
          </dl>
        );
      }
      case "imaging": {
        const i = store.imaging.list.find((x) => x.id === event.entity_id);
        if (!i) return <p className="muted">This record no longer exists.</p>;
        return (
          <dl className="kv">
            <dt>Modality</dt>
            <dd>{i.modality.toUpperCase()}</dd>
            <dt>Clinic</dt>
            <dd>{i.clinic ?? "Not recorded"}</dd>
            <dt>Device</dt>
            <dd>{i.device ?? "Not recorded"}</dd>
            <dt>Findings</dt>
            <dd>{i.findings ?? "Not recorded"}</dd>
          </dl>
        );
      }
      default:
        return (
          <dl className="kv">
            <dt>Summary</dt>
            <dd>{event.summary ?? "—"}</dd>
            <dt>Recorded</dt>
            <dd>
              {formatDate(isoToDateOnly(event.date_time))}
              {event.date_time.length > 10 ? ` ${formatTime(event.date_time)}` : ""}
            </dd>
          </dl>
        );
    }
  })();

  return (
    <Modal title={event.title} onClose={onClose}>
      <div className="btn-row" style={{ marginBottom: 14 }}>
        <EyeBadge eye={event.eye} />
        <ProvenanceBadge source={event.source_type} />
        <DemoBadge demo={event.demo} />
      </div>
      {body}
      <p className="muted" style={{ marginTop: 14 }}>Source: {SOURCE_LABELS[event.source_type]}</p>
    </Modal>
  );
}
