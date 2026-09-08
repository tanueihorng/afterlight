import { useMemo, useState } from "react";
import RetinaDiagram from "../components/RetinaDiagram";
import { EyeBadge, EmptyState, PageHeader, SafetyNotice } from "../components/ui";
import {
  CONDITION_EXPLAINERS,
  PROCEDURE_EXPLAINERS,
  RETINA_STATES,
  conditionFor,
  explainerFor,
  type ProcedureExplainer,
  type RetinaState,
} from "../lib/education";
import { useStore } from "../lib/store";
import EyeStudio from "../components/EyeStudio";
import { formatDate } from "../lib/util";

type Tab = "eye" | "explorer" | "retina" | "procedures" | "conditions";

const TABS: { id: Tab; label: string }[] = [
  { id: "eye", label: "The eye" },
  { id: "explorer", label: "3D explorer" },
  { id: "retina", label: "Retina states" },
  { id: "procedures", label: "Procedures" },
  { id: "conditions", label: "Conditions" },
];

export default function Visualize() {
  const [tab, setTab] = useState<Tab>("eye");

  return (
    <>
      <PageHeader
        title="Visualize"
        sub="Generic, educational illustrations of eye anatomy, retinal conditions and the procedures used to treat them — to help you follow what your clinician describes."
      />

      <div className="btn-row no-print" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`btn ${tab === t.id ? "primary" : "subtle"}`}
            style={{ minHeight: "var(--target)" }}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "eye" && <EyeStudio />}

      {tab === "explorer" && (
        <div className="card" style={{ padding: 10 }}>
          <iframe
            src="./EyeExplorer.html"
            title="Eye anatomy and condition explorer"
            style={{
              width: "100%",
              height: "72vh",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: "#05070c",
            }}
          />
        </div>
      )}

      {tab === "retina" && <RetinaStates />}
      {tab === "procedures" && <Procedures />}
      {tab === "conditions" && <Conditions />}

      <div style={{ marginTop: 16 }}>
        <SafetyNotice>
          These visualisations are generic and educational. They are not a reconstruction of your
          own retina and do not reflect your imaging, your measurements or your diagnosis. For your
          actual anatomy, rely on your clinician and your own scans.
        </SafetyNotice>
      </div>
    </>
  );
}

/* ---------------- retina state visualizer ---------------- */

function RetinaStates() {
  const [state, setState] = useState<RetinaState>("healthy");
  const [eye, setEye] = useState<"right" | "left">("right");
  const [labels, setLabels] = useState(true);
  const info = RETINA_STATES.find((s) => s.id === state)!;

  return (
    <div className="card">
      <div className="card-title">Retinal detachment visualizer</div>
      <div className="btn-row" style={{ flexWrap: "wrap", marginBottom: 14 }}>
        {RETINA_STATES.map((s) => (
          <button
            key={s.id}
            className={`btn ${state === s.id ? "primary" : "subtle"}`}
            style={{ minHeight: "var(--target)", fontSize: "var(--fs-sm)" }}
            onClick={() => setState(s.id)}
            aria-pressed={state === s.id}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div>
          <RetinaDiagram state={state} eye={eye} labels={labels} />
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button
              className="btn subtle"
              style={{ minHeight: "var(--target)", fontSize: "var(--fs-sm)" }}
              onClick={() => setEye(eye === "right" ? "left" : "right")}
            >
              Show {eye === "right" ? "left (OS)" : "right (OD)"} eye
            </button>
            <button
              className="btn subtle"
              style={{ minHeight: "var(--target)", fontSize: "var(--fs-sm)" }}
              onClick={() => setLabels((l) => !l)}
              aria-pressed={labels}
            >
              {labels ? "Hide" : "Show"} anatomy labels
            </button>
          </div>
        </div>
        <div>
          <div className="card-title" style={{ marginBottom: 6 }}>{info.label}</div>
          <p style={{ fontSize: "var(--fs-base)", color: "var(--text-2)", lineHeight: 1.6 }}>{info.blurb}</p>
          <p className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: 12 }}>
            Whether any of this applies to you is determined by examination and imaging, not by this
            illustration or by your symptom log.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- procedures ---------------- */

function Procedures() {
  const store = useStore();
  const mine = store.procedures.list;
  const [open, setOpen] = useState<string | null>(null);

  const linked = useMemo(
    () =>
      mine
        .map((p) => ({ procedure: p, explainer: explainerFor(p.procedure_type) }))
        .sort((a, b) => b.procedure.date.localeCompare(a.procedure.date)),
    [mine],
  );

  return (
    <>
      <div className="card">
        <div className="card-title">Procedures in your record</div>
        {linked.length === 0 ? (
          <EmptyState title="No procedures recorded">
            When you add a procedure under My Eyes, its explainer will appear here alongside the
            general library below.
          </EmptyState>
        ) : (
          linked.map(({ procedure, explainer }) => (
            <div key={procedure.id} style={{ borderTop: "1px solid var(--border-soft)", padding: "10px 0" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "var(--fs-base)" }}>{procedure.procedure_type}</strong>
                <EyeBadge eye={procedure.eye} />
                <span className="muted">{formatDate(procedure.date)}</span>
                {procedure.surgeon && <span className="muted">· {procedure.surgeon}</span>}
                <button
                  className="btn subtle"
                  style={{ minHeight: "var(--target)", fontSize: "var(--fs-sm)", marginLeft: "auto" }}
                  onClick={() => setOpen(open === procedure.id ? null : procedure.id)}
                >
                  {open === procedure.id ? "Hide explainer" : explainer ? "What this involved" : "No explainer"}
                </button>
              </div>
              {open === procedure.id &&
                (explainer ? (
                  <ExplainerBlock e={explainer} />
                ) : (
                  <p className="muted" style={{ marginTop: 8 }}>
                    Afterlight does not have a generic explainer for “{procedure.procedure_type}”. Your
                    operative note and your surgeon remain the source of truth for what was done.
                  </p>
                ))}
            </div>
          ))
        )}
      </div>

      <div className="card">
        <div className="card-title">General procedure library</div>
        <p className="muted" style={{ marginBottom: 10 }}>
          Generic descriptions of common retinal procedures. They describe what these operations
          usually involve — not what was done in your case.
        </p>
        {PROCEDURE_EXPLAINERS.map((e) => (
          <details key={e.title} style={{ borderTop: "1px solid var(--border-soft)", padding: "9px 0" }}>
            <summary style={{ cursor: "pointer", fontSize: "var(--fs-base)" }}>{e.title}</summary>
            <ExplainerBlock e={e} />
          </details>
        ))}
      </div>
    </>
  );
}

function ExplainerBlock({ e }: { e: ProcedureExplainer }) {
  const [step, setStep] = useState(0);
  const state = e.states[Math.min(step, e.states.length - 1)];
  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: "var(--fs-base)", color: "var(--text-2)", marginBottom: 12 }}>{e.summary}</p>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div>
          <RetinaDiagram state={state} labels={false} width={360} />
          <p className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: 6 }}>
            Illustration of the general stage described — schematic, not to scale.
          </p>
        </div>
        <div>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {e.steps.map((s, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <button
                  onClick={() => setStep(i)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    textAlign: "left",
                    font: "inherit",
                    cursor: "pointer",
                    color: i === step ? "var(--text)" : "var(--text-2)",
                    fontSize: "var(--fs-base)",
                    lineHeight: 1.55,
                  }}
                >
                  {s}
                </button>
              </li>
            ))}
          </ol>
          {e.afterwards.length > 0 && (
            <>
              <div
                style={{
                  fontSize: "var(--fs-xs)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--accent-strong)",
                  fontWeight: 700,
                  margin: "14px 0 4px",
                }}
              >
                Commonly afterwards
              </div>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {e.afterwards.map((a, i) => (
                  <li key={i} style={{ fontSize: "var(--fs-sm)", color: "var(--text-2)", marginBottom: 4 }}>
                    {a}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- conditions ---------------- */

function Conditions() {
  const store = useStore();
  const mine = store.diagnoses.list;

  const matched = useMemo(
    () =>
      mine
        .map((d) => ({ diagnosis: d, explainer: conditionFor(d.name) }))
        .filter((x) => x.explainer)
        .sort((a, b) => b.diagnosis.first_documented.localeCompare(a.diagnosis.first_documented)),
    [mine],
  );

  return (
    <>
      {matched.length > 0 && (
        <div className="card">
          <div className="card-title">Conditions documented in your record</div>
          {matched.map(({ diagnosis, explainer }) => (
            <div key={diagnosis.id} style={{ borderTop: "1px solid var(--border-soft)", padding: "10px 0" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "var(--fs-base)" }}>{diagnosis.name}</strong>
                <EyeBadge eye={diagnosis.eye} />
                <span className="muted">documented {formatDate(diagnosis.first_documented)}</span>
              </div>
              <p style={{ fontSize: "var(--fs-base)", color: "var(--text-2)", marginTop: 6 }}>
                {explainer!.what} {explainer!.why}
              </p>
              <div className="btn-row" style={{ marginTop: 8, flexWrap: "wrap" }}>
                {explainer!.states.map((s) => (
                  <figure key={s} style={{ margin: 0, textAlign: "center" }}>
                    <RetinaDiagram state={s} eye={diagnosis.eye === "left" ? "left" : "right"} labels={false} width={190} />
                    <figcaption className="muted" style={{ fontSize: "var(--fs-xs)" }}>
                      {RETINA_STATES.find((r) => r.id === s)?.label}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ))}
          <p className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: 10 }}>
            Matched to your recorded diagnosis name only. The illustration is generic and shows the
            concept, not your eye.
          </p>
        </div>
      )}

      <div className="card">
        <div className="card-title">Condition library</div>
        {CONDITION_EXPLAINERS.map((c) => (
          <details key={c.title} style={{ borderTop: "1px solid var(--border-soft)", padding: "9px 0" }}>
            <summary style={{ cursor: "pointer", fontSize: "var(--fs-base)" }}>{c.title}</summary>
            <div className="grid-2" style={{ alignItems: "start", marginTop: 10 }}>
              <div>
                <RetinaDiagram state={c.states[c.states.length - 1]} labels width={340} />
              </div>
              <div>
                <p style={{ fontSize: "var(--fs-base)", color: "var(--text-2)", marginBottom: 6 }}>{c.what}</p>
                <p style={{ fontSize: "var(--fs-base)", color: "var(--text-2)" }}>{c.why}</p>
              </div>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
