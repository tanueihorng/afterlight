import { useMemo, useState } from "react";
import { EyeBadge, PageHeader } from "../components/ui";
import TestConditionsForm from "../components/tests/TestConditionsForm";
import ScreenCalibration from "../components/tests/ScreenCalibration";
import AmslerGrid from "../components/tests/AmslerGrid";
import AcuityCheck, { ACUITY_STEPS } from "../components/tests/AcuityCheck";
import ContrastCheck, { CONTRAST_STEPS } from "../components/tests/ContrastCheck";
import { newRecord, useStore } from "../lib/store";
import {
  SELF_TEST_LABELS,
  conditionsComplete,
  type DrawingMark,
  type SelfTestKind,
  type SelfTestResult,
  type TestConditions,
  type VisualFieldDrawing,
} from "../lib/models";
import {
  SELF_TEST_BOUNDARY,
  comparability,
  COMPARABILITY_NOTE,
  conditionsSummary,
  describeSeries,
  homeAcuityNotation,
  seriesFor,
  type Calibration,
} from "../lib/selftest";
import { formatDate, isoToDateOnly, nowISO } from "../lib/util";
import { describeDrawing } from "../lib/describe";

const KINDS: SelfTestKind[] = ["amsler", "home_acuity", "contrast"];

export default function SelfTests() {
  const [running, setRunning] = useState<SelfTestKind | null>(null);

  return (
    <>
      <PageHeader
        title="Checks you can do yourself"
        sub="Repeatable checks that give you something concrete to compare between appointments. They are not measurements of your vision."
      />

      <p className="selftest-boundary">{SELF_TEST_BOUNDARY}</p>

      {running ? (
        <RunTest kind={running} onDone={() => setRunning(null)} />
      ) : (
        <>
          <div className="grid-2">
            {KINDS.map((kind) => (
              <section className="card" key={kind}>
                <h2 className="card-title">{SELF_TEST_LABELS[kind]}</h2>
                <p style={{ color: "var(--text-2)", marginTop: 0 }}>{DESCRIPTIONS[kind]}</p>
                <button className="btn primary" onClick={() => setRunning(kind)}>
                  Start this check
                </button>
              </section>
            ))}
          </div>

          <History />
        </>
      )}
    </>
  );
}

const DESCRIPTIONS: Record<SelfTestKind, string> = {
  amsler:
    "A grid of straight lines with a dot in the middle. You mark anywhere the lines look bent, blurred or missing, one eye at a time.",
  home_acuity:
    "Rows of letters that get smaller. You note the smallest row you can read, at a distance you record so you can repeat it.",
  contrast:
    "A shape that gets fainter each step. You note the faintest one you can still see.",
  colour: "A short colour check, compared only with your own earlier attempts.",
};

/* ------------------------------------------------------------ running one */

function RunTest({ kind, onDone }: { kind: SelfTestKind; onDone: () => void }) {
  const store = useStore();
  const [eye, setEye] = useState<"right" | "left">("right");
  const [conditions, setConditions] = useState<TestConditions>({
    correction: "glasses",
    distance_cm: kind === "amsler" ? 33 : 40,
  });
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [marks, setMarks] = useState<DrawingMark[]>([]);
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<SelfTestResult["result"] | null>(null);
  const [saved, setSaved] = useState(false);

  const ready = conditionsComplete(conditions);
  const needsCalibration = kind === "home_acuity";

  const save = async () => {
    let drawingId: string | undefined;
    if (kind === "amsler" && marks.length > 0) {
      const drawing: VisualFieldDrawing = newRecord({
        date_time: nowISO(),
        eye,
        canvas_data: { marks },
        description: `Amsler grid — ${describeDrawing(marks, eye)}`,
        linked_symptoms: [],
        source_type: "patient_drawn" as const,
      });
      await store.drawings.put(drawing);
      drawingId = drawing.id;
    }

    const result: SelfTestResult = newRecord({
      kind,
      date_time: nowISO(),
      eye,
      result: kind === "amsler" ? { marks: marks.length } : (outcome ?? {}),
      drawing_id: drawingId,
      conditions: { ...conditions, px_per_mm: calibration?.px_per_mm },
      note: note || undefined,
      source_type: "patient_reported" as const,
    });
    await store.selfTests.put(result);
    setSaved(true);
  };

  if (saved) {
    return (
      <div className="card">
        <h2 className="card-title">Recorded</h2>
        <p style={{ color: "var(--text-2)" }}>
          Saved as a check you did yourself, with the conditions you did it under. It will appear on
          your timeline and can be compared with your next attempt taken the same way.
        </p>
        <button className="btn primary" onClick={onDone}>
          Done
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <h2 className="card-title">{SELF_TEST_LABELS[kind]}</h2>
        <fieldset className="pref-group">
          <legend className="field-label">Which eye are you testing?</legend>
          <div className="btn-row">
            {(["right", "left"] as const).map((e) => (
              <button
                key={e}
                className={`btn ${eye === e ? "primary" : "subtle"}`}
                aria-pressed={eye === e}
                onClick={() => setEye(e)}
              >
                {e === "right" ? "Right eye (OD)" : "Left eye (OS)"}
              </button>
            ))}
          </div>
          <p className="muted pref-hint">Cover the other eye completely. Test one, then the other.</p>
        </fieldset>

        <TestConditionsForm value={conditions} onChange={setConditions} />

        {!ready && (
          <p className="muted">
            Fill in all four before starting. Without them this attempt could not be compared with
            any other, which is the only thing it is for.
          </p>
        )}
      </div>

      {needsCalibration && ready && (
        <ScreenCalibration calibration={calibration} onChange={setCalibration} />
      )}

      {ready && kind === "amsler" && (
        <div className="card">
          <h3 className="card-title">Look only at the dot in the middle</h3>
          <p style={{ color: "var(--text-2)", marginTop: 0 }}>
            Keeping your eye on the centre dot, mark any area where the lines look wavy, blurred,
            faded or missing. Draw straight onto the grid.
          </p>
          <AmslerGrid marks={marks} onChange={setMarks} eye={eye} />
        </div>
      )}

      {ready && kind === "home_acuity" && calibration && (
        <AcuityCheck
          calibration={calibration}
          distanceCm={conditions.distance_cm ?? 40}
          onResult={(index, logmar) =>
            setOutcome({
              smallest_step: index,
              notation: homeAcuityNotation(ACUITY_STEPS[Math.max(0, index - 1)] ?? logmar),
            })
          }
        />
      )}

      {ready && kind === "contrast" && (
        <ContrastCheck
          onResult={(index) =>
            setOutcome({ contrast_step: index, notation: `step ${index + 1} of ${CONTRAST_STEPS.length}` })
          }
        />
      )}

      {(outcome || (kind === "amsler" && ready)) && (
        <div className="card">
          <h3 className="card-title">Anything to add?</h3>
          {outcome?.notation && (
            <p style={{ color: "var(--text-2)" }}>
              You stopped at {outcome.notation}. This is a home check under the conditions you
              recorded — not a clinical result.
            </p>
          )}
          <label className="field">
            <span className="field-label">Note (optional)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="btn-row">
            <button className="btn subtle" onClick={onDone}>
              Cancel
            </button>
            <button className="btn primary" onClick={save} disabled={!ready}>
              Save this check
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- history */

function History() {
  const store = useStore();
  const results = store.selfTests.list;

  const series = useMemo(
    () =>
      KINDS.flatMap((kind) =>
        (["right", "left"] as const).map((eye) => seriesFor(results, kind, eye)),
      ).filter((s) => s.results.length > 0),
    [results],
  );

  if (series.length === 0) return null;

  return (
    <div className="card">
      <h2 className="card-title">Your previous checks</h2>
      {series.map((s) => {
        const latest = s.results[0];
        const previous = s.results[1];
        const status = previous ? comparability(latest, previous) : null;
        return (
          <div key={`${s.kind}-${s.eye}`} className="selftest-series">
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <strong>{SELF_TEST_LABELS[s.kind]}</strong>
              <EyeBadge eye={s.eye} />
              <span className="badge">Patient performed</span>
            </div>
            <p style={{ color: "var(--text-2)", margin: "6px 0" }}>{describeSeries(s)}</p>
            {status && status !== "comparable" && (
              <p className="muted">{COMPARABILITY_NOTE[status]}</p>
            )}
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {s.results.slice(0, 5).map((r) => (
                <li key={r.id} style={{ fontSize: "var(--fs-sm)", color: "var(--text-2)" }}>
                  {formatDate(isoToDateOnly(r.date_time))} —{" "}
                  {r.result.notation ??
                    (r.result.marks !== undefined
                      ? `${r.result.marks} area${r.result.marks === 1 ? "" : "s"} marked`
                      : "recorded")}
                  {" · "}
                  {conditionsSummary(r.conditions)}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
