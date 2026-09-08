import { useEffect, useMemo, useState } from "react";
import FundusFigure from "./FundusFigure";
import VisionSim from "./VisionSim";
import RetinaDiagram from "./RetinaDiagram";
import { EyeBadge, Field, SafetyNotice } from "./ui";
import {
  ATLAS,
  REGION_LABELS,
  byRegion,
  conditionById,
  forProfiles,
  matchDiagnosis,
  searchAtlas,
  type ConditionEntry,
  type Region,
} from "../engine/conditions";
import { SIMULATION_LABELS } from "../engine/simulate/vision";
import { useStore } from "../lib/store";
import { formatDate } from "../lib/util";

const REGIONS: Region[] = ["surface", "anterior", "vitreoretina", "optic_nerve"];

/**
 * The atlas: a reference someone navigates deliberately.
 *
 * It is never surfaced from a person's own symptoms and never ranks conditions against their
 * record — showing someone forty diseases can plant symptoms that were not there. Searching by a
 * word is fine; being told what you might have is not.
 */
export default function Atlas({
  initialId,
  onDraftDrawing,
}: {
  initialId?: string;
  onDraftDrawing?: (condition: ConditionEntry) => void;
}) {
  const store = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);
  // A deep link has to work when it is followed, not only when the page happens to mount fresh.
  useEffect(() => {
    if (initialId) setSelectedId(initialId);
  }, [initialId]);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<Region | "all">("all");
  const [severity, setSeverity] = useState(0.6);
  const [eye, setEye] = useState<"right" | "left">("right");
  const [compare, setCompare] = useState(true);

  const selected = selectedId ? (conditionById(selectedId) ?? null) : null;
  const profileIds = useMemo(
    () => store.meta?.condition_profiles ?? [],
    [store.meta?.condition_profiles],
  );

  const list = useMemo(() => {
    if (query.trim().length >= 2) return searchAtlas(query);
    if (region === "all") return ATLAS;
    return byRegion(region);
  }, [query, region]);

  const mine = useMemo(() => forProfiles(profileIds), [profileIds]);

  const documented = useMemo(
    () =>
      store.diagnoses.list
        .map((d) => ({ diagnosis: d, entry: matchDiagnosis(d.name) }))
        .filter((x) => x.entry),
    [store.diagnoses.list],
  );

  if (selected) {
    return (
      <ConditionDetail
        condition={selected}
        severity={severity}
        setSeverity={setSeverity}
        eye={eye}
        setEye={setEye}
        compare={compare}
        setCompare={setCompare}
        onBack={() => setSelectedId(null)}
        onDraftDrawing={onDraftDrawing}
      />
    );
  }

  return (
    <>
      <div className="card">
        <h2 className="card-title">Look something up</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          A reference to read when you want to understand a word or a picture. Afterlight never
          suggests what you might have, and nothing here is matched against your own entries.
        </p>

        <Field label="Search by name, symptom word, or a term from a letter">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. distortion, drusen, buckle, macula-off"
          />
        </Field>

        <div className="btn-row" style={{ flexWrap: "wrap" }}>
          <button
            className={`btn ${region === "all" ? "primary" : "subtle"}`}
            aria-pressed={region === "all"}
            onClick={() => setRegion("all")}
          >
            All ({ATLAS.length})
          </button>
          {REGIONS.map((r) => (
            <button
              key={r}
              className={`btn ${region === r ? "primary" : "subtle"}`}
              aria-pressed={region === r}
              onClick={() => setRegion(r)}
            >
              {REGION_LABELS[r]} ({byRegion(r).length})
            </button>
          ))}
        </div>
      </div>

      {documented.length > 0 && (
        <div className="card">
          <h2 className="card-title">Documented in your record</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Matched to the name your clinician documented. The illustration is generic and shows the
            concept, not your eye.
          </p>
          {documented.map(({ diagnosis, entry }) => (
            <button key={diagnosis.id} className="atlas-row" onClick={() => setSelectedId(entry!.id)}>
              <span>
                <strong>{diagnosis.name}</strong>
                <span className="muted"> — documented {formatDate(diagnosis.first_documented)}</span>
              </span>
              <span className="tl-meta">
                <EyeBadge eye={diagnosis.eye} />
                <span className="muted">Read about {entry!.name} →</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {mine.length > 0 && query.trim().length < 2 && (
        <div className="card">
          <h2 className="card-title">Related to what you are tracking</h2>
          <div className="atlas-grid">
            {mine.map((c) => (
              <AtlasCard key={c.id} condition={c} onOpen={() => setSelectedId(c.id)} />
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="card-title">
          {query.trim().length >= 2 ? `${list.length} matching` : "The whole atlas"}
        </h2>
        {list.length === 0 ? (
          <p className="muted">Nothing matches “{query}”.</p>
        ) : (
          <div className="atlas-grid">
            {list.map((c) => (
              <AtlasCard key={c.id} condition={c} onOpen={() => setSelectedId(c.id)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function AtlasCard({ condition, onOpen }: { condition: ConditionEntry; onOpen: () => void }) {
  return (
    <button className="atlas-card" onClick={onOpen}>
      <span className="atlas-card-name">{condition.name}</span>
      <span className="atlas-card-region">{REGION_LABELS[condition.region]}</span>
      <span className="atlas-card-desc">{condition.description}</span>
    </button>
  );
}

function ConditionDetail({
  condition,
  severity,
  setSeverity,
  eye,
  setEye,
  compare,
  setCompare,
  onBack,
  onDraftDrawing,
}: {
  condition: ConditionEntry;
  severity: number;
  setSeverity: (v: number) => void;
  eye: "right" | "left";
  setEye: (e: "right" | "left") => void;
  compare: boolean;
  setCompare: (v: boolean) => void;
  onBack: () => void;
  onDraftDrawing?: (condition: ConditionEntry) => void;
}) {
  return (
    <>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button className="btn subtle" onClick={onBack}>
          ← All conditions
        </button>
        <a className="btn subtle" href={`#/visualize/atlas/${condition.id}`}>
          Link to this entry
        </a>
      </div>

      <div className="card">
        <h2 className="card-title">{condition.name}</h2>
        <span className="badge">{REGION_LABELS[condition.region]}</span>

        <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>{condition.description}</p>

        <h3 className="card-title" style={{ marginTop: 16 }}>
          What people notice
        </h3>
        <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>{condition.experience}</p>

        <h3 className="card-title" style={{ marginTop: 16 }}>
          What a clinician is looking at
        </h3>
        <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>{condition.clinical}</p>
        {condition.imaging && (
          <p className="muted">Usually documented with: {condition.imaging}</p>
        )}

        {condition.vocabulary.length > 0 && (
          <p className="muted">
            Words you may see in a letter: {condition.vocabulary.join(", ")}.
          </p>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">Inside the eye</h3>
        {condition.view === "cross_section" ? (
          <div className="grid-2">
            <RetinaDiagram state="healthy" eye={eye} labels width={340} />
            <div>
              <p className="muted">
                This one is best understood in cross-section. The retina states and procedure
                explainers on this page show the same anatomy.
              </p>
            </div>
          </div>
        ) : compare ? (
          <div className="grid-2">
            <FundusFigure condition={null} severity={0} eye={eye} caption="Without this condition" />
            <FundusFigure
              condition={condition}
              severity={severity}
              eye={eye}
              caption={`${condition.name}, as described at this stage`}
            />
          </div>
        ) : (
          <FundusFigure condition={condition} severity={severity} eye={eye} />
        )}

        {condition.gradable && (
          <>
            <Field label={`How it is described as it progresses (${Math.round(severity * 100)}%)`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
              />
            </Field>
            <p className="muted">
              This shows how the condition is described at different stages. It is not a prediction
              about you, and it says nothing about where anyone is heading.
            </p>
          </>
        )}

        <div className="btn-row">
          <button className="btn subtle" onClick={() => setCompare(!compare)} aria-pressed={compare}>
            {compare ? "Show one view" : "Compare with unaffected"}
          </button>
          <button className="btn subtle" onClick={() => setEye(eye === "right" ? "left" : "right")}>
            Show {eye === "right" ? "left (OS)" : "right (OD)"} eye
          </button>
        </div>

        {condition.annotations && condition.annotations.length > 0 && (
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            {condition.annotations.map((a, i) => (
              <li key={i} style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
                {a.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      {condition.simulation && (
        <div className="card">
          <h3 className="card-title">What this looks like from inside</h3>
          <p style={{ color: "var(--text-2)", marginTop: 0 }}>
            {SIMULATION_LABELS[condition.simulation.kind]}.
          </p>
          <VisionSim
            kind={condition.simulation.kind}
            severity={severity}
            retinalQuadrant={condition.simulation.retinalQuadrant}
            eye={eye}
            onAskIfLikeThis={onDraftDrawing ? () => onDraftDrawing(condition) : undefined}
          />
        </div>
      )}

      <SafetyNotice>
        This is a reference, not an assessment. Whether any of it applies to you is determined by
        examination and imaging — not by an illustration, and not by your symptom log.
      </SafetyNotice>
    </>
  );
}
