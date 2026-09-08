import { useEffect, useMemo, useRef, useState } from "react";
import { askRecords, EXAMPLE_QUESTIONS, type AskAnswer } from "../lib/ask";
import { searchRecords, type SearchHit } from "../lib/search";
import { toAllData, useStore } from "../lib/store";
import type { Route } from "../lib/router";
import { formatDate } from "../lib/util";
import { DemoBadge, EyeBadge, ProvenanceBadge } from "./ui";

type Mode = "search" | "ask";

const ROUTE_LABELS: Record<Route, string> = {
  today: "Today",
  "what-i-see": "What I See",
  timeline: "Timeline",
  "my-eyes": "My Eyes",
  imaging: "Imaging & Documents",
  appointments: "Appointments",
  visualize: "Visualize",
  settings: "Settings",
};

export default function CommandPalette({
  onClose,
  onNavigate,
  initialMode = "search",
}: {
  onClose: () => void;
  onNavigate: (r: Route) => void;
  initialMode?: Mode;
}) {
  const store = useStore();
  const data = useMemo(() => toAllData(store), [store]);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState<{ question: string; answer: AskAnswer } | null>(null);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits: SearchHit[] = useMemo(
    () => (mode === "search" && q.trim().length > 1 ? searchRecords(data, q) : []),
    [mode, q, data],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  useEffect(() => setCursor(0), [q, mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (mode === "search" && hits.length) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setCursor((c) => Math.min(c + 1, hits.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setCursor((c) => Math.max(c - 1, 0));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, mode, hits.length]);

  const go = (r: Route) => {
    onNavigate(r);
    onClose();
  };

  const submitAsk = () => {
    const question = q.trim();
    if (!question) return;
    setAsked({ question, answer: askRecords(data, question) });
  };

  return (
    <div className="modal-backdrop palette-backdrop">
      {/* Mouse convenience only — keyboard users close with Escape. */}
      <button
        type="button"
        className="backdrop-dismiss"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "search" ? "Search my records" : "Ask my records"}
      >
        <div className="palette-tabs">
          {(["search", "ask"] as Mode[]).map((m) => (
            <button
              key={m}
              className={`palette-tab ${mode === m ? "active" : ""}`}
              onClick={() => {
                setMode(m);
                setAsked(null);
                setQ("");
              }}
              aria-pressed={mode === m}
            >
              {m === "search" ? "Search records" : "Ask my records"}
            </button>
          ))}
          <span className="palette-hint">esc to close</span>
        </div>

        <form
          className="palette-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "ask") submitAsk();
            else if (hits[cursor]) go(hits[cursor].route);
          }}
        >
          <span className="palette-icon" aria-hidden>
            {mode === "search" ? "⌕" : "?"}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              mode === "search"
                ? 'Try "floaters", "vitrectomy", "Aug 2026", "left eye", "glare"…'
                : "When did glare in my left eye first appear?"
            }
            aria-label={mode === "search" ? "Search query" : "Question about your records"}
          />
          {mode === "ask" && (
            <button className="btn primary" style={{ minHeight: "var(--target)" }} type="submit">
              Ask
            </button>
          )}
        </form>

        <p className="visually-hidden" role="status" aria-live="polite">
          {mode === "search"
            ? q.trim().length < 2
              ? ""
              : `${hits.length} record${hits.length === 1 ? "" : "s"} match ${q}`
            : asked
              ? asked.answer.found
                ? `Answered, with ${asked.answer.citations.length} source${asked.answer.citations.length === 1 ? "" : "s"}`
                : "Nothing found in your records"
              : ""}
        </p>

        <div className="palette-body">
          {mode === "search" ? (
            <SearchResults hits={hits} q={q} cursor={cursor} onGo={go} />
          ) : (
            <AskPanel asked={asked} onExample={(t) => { setQ(t); setAsked({ question: t, answer: askRecords(data, t) }); }} onGo={go} />
          )}
        </div>

        <div className="palette-foot">
          Searches only your own locally stored records. Nothing is sent anywhere.
        </div>
      </div>
    </div>
  );
}

function SearchResults({
  hits,
  q,
  cursor,
  onGo,
}: {
  hits: SearchHit[];
  q: string;
  cursor: number;
  onGo: (r: Route) => void;
}) {
  if (q.trim().length < 2) {
    return (
      <p className="muted palette-empty">
        Search across symptoms, dates, diagnoses, doctors, clinics, documents, procedures, imaging
        and notes.
      </p>
    );
  }
  if (!hits.length) {
    return <p className="muted palette-empty">No records match “{q}”.</p>;
  }
  return (
    <ul className="palette-results" role="listbox">
      {hits.map((h, i) => (
        <li key={h.id}>
          <button
            className={`palette-result ${i === cursor ? "active" : ""}`}
            onClick={() => onGo(h.route)}
            role="option"
            aria-selected={i === cursor}
          >
            <span className="palette-result-main">
              <span className="palette-result-title">{h.title}</span>
              {h.snippet && <span className="palette-result-snippet">{h.snippet}</span>}
            </span>
            <span className="palette-result-meta">
              <span className="badge">{h.kind}</span>
              {h.eye !== "not_applicable" && <EyeBadge eye={h.eye} />}
              <ProvenanceBadge source={h.source_type} />
              <DemoBadge demo={h.demo} />
              <span className="muted">{formatDate(h.date)}</span>
              <span className="muted">→ {ROUTE_LABELS[h.route]}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function AskPanel({
  asked,
  onExample,
  onGo,
}: {
  asked: { question: string; answer: AskAnswer } | null;
  onExample: (t: string) => void;
  onGo: (r: Route) => void;
}) {
  if (!asked) {
    return (
      <div className="palette-empty">
        <p className="muted" style={{ marginBottom: 10 }}>
          Questions are answered only from your stored records, with the source shown. Afterlight
          does not interpret or diagnose.
        </p>
        <div className="btn-row" style={{ flexWrap: "wrap" }}>
          {EXAMPLE_QUESTIONS.map((t) => (
            <button
              key={t}
              className="btn subtle"
              style={{ minHeight: "var(--target)", fontSize: "var(--fs-sm)" }}
              onClick={() => onExample(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    );
  }
  const { answer } = asked;
  return (
    <div className="ask-answer">
      <div className="ask-question">{asked.question}</div>
      {answer.interpretation && (
        <div className="muted ask-interpretation">Read as: {answer.interpretation}</div>
      )}
      {answer.lines.map((l, i) => (
        <p key={i} className={answer.found ? "ask-line" : "ask-line muted"}>
          {l}
        </p>
      ))}
      {answer.citations.length > 0 && (
        <div className="ask-citations">
          <div className="ask-citations-title">Source</div>
          {answer.citations.map((c, i) => (
            <button key={i} className="ask-citation" onClick={() => onGo(c.route)}>
              {c.label} <span aria-hidden>→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
