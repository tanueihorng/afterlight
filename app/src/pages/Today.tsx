import { useMemo, useState } from "react";
import { useHashRoute } from "../lib/router";
import { useStore } from "../lib/store";
import {
  BASELINE_LABELS,
  FLOATER_SHAPES,
  SYMPTOM_TYPES,
  URGENT_SYMPTOMS,
  type BaselineComparison,
  type FloaterObject,
  type SymptomEntry,
} from "../lib/models";
import { PageHeader, SafetyNotice } from "../components/ui";
import { t } from "../lib/i18n";
import BackupNudge from "../components/BackupNudge";
import {
  addDays,
  formatDate,
  isoToDateOnly,
  nowISO,
  todayLocal,
} from "../lib/util";
import { continuity, continuitySentence } from "../lib/streak";
import { quickEntries } from "../lib/suggestions";
import { promptedSymptoms, suggestedSelfTests } from "../lib/conditions";
import { toAllData } from "../lib/store";

interface Row {
  key: string;
  eye: "right" | "left";
  symptom_type: string;
  comparison: BaselineComparison | "";
  severity: number;
  description: string;
  floaterShape?: string;
  existingId?: string;
}

/** When the change started, which is not always today. */
type WhenOption = "today" | "yesterday" | "custom";

export default function Today() {
  const store = useStore();
  const [, nav] = useHashRoute();
  const date = todayLocal();

  const existingLog = useMemo(
    () => store.dailyLogs.list.find((l) => l.date === date),
    [store.dailyLogs.list, date],
  );
  const todaysSymptoms = useMemo(
    () =>
      store.symptoms.list
        .filter((s) => isoToDateOnly(s.date_time) === date && !s.demo)
        .sort((a, b) => (a.date_time < b.date_time ? 1 : -1)),
    [store.symptoms.list, date],
  );

  const [rows, setRows] = useState<Row[]>(() =>
    todaysSymptoms.map((s) => ({
      key: s.id,
      eye: (s.eye === "both" ? "right" : s.eye) as "right" | "left",
      symptom_type: s.symptom_type,
      comparison: s.baseline_comparison ?? "",
      severity: s.severity ?? 0,
      description: s.description ?? "",
      existingId: s.id,
    })),
  );
  const [note, setNote] = useState(existingLog?.note ?? "");
  const [justSaved, setJustSaved] = useState(false);
  const alreadyRecorded = !!existingLog;
  // The daily loop is a decision before it is a form: answer the question, then only fill in what
  // the answer requires.
  const [mode, setMode] = useState<"asking" | "recording">(() =>
    todaysSymptoms.length > 0 ? "recording" : "asking",
  );
  const [when, setWhen] = useState<WhenOption>("today");
  const [customDate, setCustomDate] = useState(addDays(date, -1));

  const entryDate = when === "today" ? date : when === "yesterday" ? addDays(date, -1) : customDate;

  const streak = useMemo(
    () => continuitySentence(continuity(store.dailyLogs.list, date), date),
    [store.dailyLogs.list, date],
  );
  const suggestions = useMemo(() => quickEntries(toAllData(store), date), [store, date]);
  // Profiles reorder the symptom list; they never shorten it.
  const profileIds = useMemo(
    () => store.meta?.condition_profiles ?? [],
    [store.meta?.condition_profiles],
  );
  const orderedSymptoms = useMemo(() => {
    const prompted = promptedSymptoms(profileIds);
    return [...prompted, ...SYMPTOM_TYPES.filter((t) => !prompted.includes(t))];
  }, [profileIds]);
  const profileTests = useMemo(() => suggestedSelfTests(profileIds), [profileIds]);

  const baseline = (eye: "right" | "left") => store.baselines.list.find((b) => b.id === eye)?.text;

  const addRow = (eye: "right" | "left", symptomType?: string, comparison?: BaselineComparison) => {
    setRows((r) => [
      ...r,
      {
        key: crypto.randomUUID(),
        eye,
        symptom_type: symptomType ?? "floaters",
        comparison: comparison ?? "",
        severity: 0,
        description: "",
      },
    ]);
  };

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const removeRow = (key: string) => setRows((r) => r.filter((row) => row.key !== key));

  const urgent =
    rows.some(
      (r) =>
        URGENT_SYMPTOMS.includes(r.symptom_type) &&
        (r.comparison === "new" || r.comparison === "much_more"),
    ) ?? false;

  const saveNoChange = async () => {
    const log = {
      id: existingLog?.id ?? crypto.randomUUID(),
      date,
      overall: "no_change" as const,
      note: note || undefined,
      source_type: "patient_reported" as const,
      demo: undefined,
      created_at: existingLog?.created_at ?? nowISO(),
      updated_at: nowISO(),
    };
    await store.dailyLogs.put(log);
    setRows([]);
    setJustSaved(true);
  };

  const save = async () => {
    const rowsToSave = rows.filter((r) => r.symptom_type && r.comparison);
    // remove entries that were deleted in this edit session
    for (const s of todaysSymptoms) {
      if (!rowsToSave.some((r) => r.existingId === s.id)) {
        await store.symptoms.del(s.id);
      }
    }
    for (const r of rowsToSave) {
      let floaterId: string | undefined;
      const existingEntry = r.existingId
        ? store.symptoms.list.find((s) => s.id === r.existingId)
        : undefined;
      if (
        r.symptom_type === "floaters" &&
        r.comparison === "new" &&
        !existingEntry?.floater_object_id
      ) {
        const floater: FloaterObject = {
          id: crypto.randomUUID(),
          eye: r.eye,
          first_seen: entryDate,
          last_seen: entryDate,
          shape: r.floaterShape ?? "custom",
          status: "active",
          baseline: false,
          drawing_refs: [],
          source_type: "patient_reported",
          created_at: nowISO(),
          updated_at: nowISO(),
        };
        await store.floaters.put(floater);
        floaterId = floater.id;
      }
      const entry: SymptomEntry = {
        id: r.existingId ?? crypto.randomUUID(),
        // Dated by when it started, which is not always when it was written down. Recording last
        // night's change this morning must not move its onset a day later, or the brief is wrong.
        date_time:
          existingEntry?.date_time ?? (entryDate === date ? nowISO() : `${entryDate}T12:00:00`),
        eye: r.eye,
        symptom_type: r.symptom_type,
        status:
          r.comparison === "new"
            ? "new"
            : r.comparison === "fewer"
              ? "better"
              : r.comparison === "slightly_more" || r.comparison === "much_more"
                ? "worse"
                : "same",
        baseline_comparison: r.comparison || undefined,
        severity: r.severity > 0 ? r.severity : undefined,
        description: r.description || undefined,
        floater_object_id: floaterId ?? existingEntry?.floater_object_id,
        drawing_id: existingEntry?.drawing_id,
        source_type: "patient_reported",
        created_at: existingEntry?.created_at ?? nowISO(),
        updated_at: nowISO(),
      };
      await store.symptoms.put(entry);
    }
    const log = {
      id: existingLog?.id ?? crypto.randomUUID(),
      date,
      overall: rowsToSave.length > 0 ? ("recorded" as const) : ("no_change" as const),
      note: note || undefined,
      source_type: "patient_reported" as const,
      created_at: existingLog?.created_at ?? nowISO(),
      updated_at: nowISO(),
    };
    await store.dailyLogs.put(log);
    setJustSaved(true);
  };

  const eyePanel = (eye: "right" | "left") => {
    const rowsForEye = rows.filter((r) => r.eye === eye);
    return (
      <section
        className={`card eye-panel ${eye}`}
        aria-label={eye === "right" ? "Right eye" : "Left eye"}
      >
        <div className="eye-heading">
          <span className="eye-name">{eye === "right" ? "Right Eye" : "Left Eye"}</span>
          <span className="eye-clinical">{eye === "right" ? "OD" : "OS"}</span>
        </div>
        {baseline(eye) && (
          <p className="muted" style={{ marginTop: -4 }}>
            <strong style={{ color: "var(--text-2)" }}>{t("today.your_baseline")}</strong>{" "}
            {baseline(eye)}
          </p>
        )}
        {rowsForEye.map((r) => (
          <div
            key={r.key}
            style={{
              border: "1px solid var(--border-soft)",
              borderRadius: "var(--radius-sm)",
              padding: "12px 14px",
              marginBottom: 10,
              background: "var(--bg-elev2)",
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <select
                value={r.symptom_type}
                onChange={(e) => updateRow(r.key, { symptom_type: e.target.value })}
                aria-label={t("today.symptom_type")}
                style={{ flex: 1 }}
              >
                {orderedSymptoms.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                className="btn subtle"
                onClick={() => removeRow(r.key)}
                aria-label={t("today.remove_symptom")}
                title="Remove"
              >
                ✕
              </button>
            </div>
            <fieldset className="comparison">
              <legend>{t("today.compared_with_usual")}</legend>
              <div
                className="radio-grid"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
              >
                {(Object.keys(BASELINE_LABELS) as BaselineComparison[]).map((c) => (
                  <label key={c} className={`radio-chip ${r.comparison === c ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name={`cmp-${r.key}`}
                      value={c}
                      checked={r.comparison === c}
                      onChange={() => updateRow(r.key, { comparison: c })}
                    />
                    {BASELINE_LABELS[c]}
                  </label>
                ))}
              </div>
            </fieldset>
            {r.symptom_type === "floaters" && r.comparison === "new" && (
              <div style={{ marginTop: 10 }}>
                <span className="field-label">{t("today.floater_appearance")}</span>
                <select
                  value={r.floaterShape ?? "custom"}
                  onChange={(e) => updateRow(r.key, { floaterShape: e.target.value })}
                  aria-label={t("today.floater_shape")}
                >
                  {FLOATER_SHAPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <span className="field-label">{t("today.severity")}</span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={r.severity}
                  onChange={(e) => updateRow(r.key, { severity: Number(e.target.value) })}
                  aria-label={t("today.severity_label")}
                />
                <span className="mono" style={{ minWidth: 42, textAlign: "right" }}>
                  {r.severity}/10
                </span>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <span className="field-label">{t("today.describe")}</span>
              <input
                type="text"
                value={r.description}
                placeholder={t("today.describe_placeholder")}
                onChange={(e) => updateRow(r.key, { description: e.target.value })}
              />
            </div>
          </div>
        ))}
        <div className="btn-row">
          <button className="btn" onClick={() => addRow(eye)}>
            ＋ {t("today.add_symptom")}
          </button>
          <button className="btn subtle" onClick={() => nav("what-i-see")}>
            ✧ {t("today.draw")}
          </button>
        </div>
      </section>
    );
  };

  return (
    <>
      {/* No kicker: the shell already prints today's date above every page, and having it
          twice on the one screen people open daily was just noise. */}
      <PageHeader title={t("today.title")} sub={t("today.sub")} />
      <BackupNudge />

      {alreadyRecorded && !justSaved && mode === "asking" && (
        <div className="safety recorded-note" role="status">
          <span className="safety-icon" style={{ color: "var(--ok)" }} aria-hidden>
            ✓
          </span>
          <div>
            {existingLog?.overall === "no_change"
              ? t("today.recorded_no_change")
              : t("today.recorded")}{" "}
            {t("today.recorded_editable")}
          </div>
        </div>
      )}

      {justSaved && (
        <div
          className="safety"
          style={{
            borderColor: "color-mix(in srgb, var(--ok) 55%, transparent)",
            marginBottom: 16,
          }}
          role="status"
        >
          <span className="safety-icon" style={{ color: "var(--ok)" }} aria-hidden>
            ✓
          </span>
          <div>
            {t("today.recorded")}{" "}
            <button
              className="btn subtle"
              style={{ minHeight: "var(--target)", padding: "2px 8px" }}
              onClick={() => nav("timeline")}
            >
              {t("today.view_timeline")}
            </button>
          </div>
        </div>
      )}

      {urgent && (
        <div style={{ marginBottom: 16 }}>
          <SafetyNotice>{t("safety.urgent")}</SafetyNotice>
        </div>
      )}

      {mode === "asking" ? (
        <>
          <div className="decision">
            <button className="decision-btn" onClick={saveNoChange}>
              <span className="decision-icon" aria-hidden>
                ◐
              </span>
              <span className="decision-label">{t("today.nothing_different")}</span>
              <span className="decision-hint">{t("today.nothing_different_hint")}</span>
            </button>
            <button className="decision-btn secondary" onClick={() => setMode("recording")}>
              <span className="decision-icon" aria-hidden>
                ✎
              </span>
              <span className="decision-label">{t("today.something_changed")}</span>
              <span className="decision-hint">{t("today.something_changed_hint")}</span>
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h2 className="card-title">{t("today.same_as_before")}</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                {t("today.same_as_before_hint")}
              </p>
              <div className="btn-row" style={{ flexWrap: "wrap" }}>
                {suggestions.map((q) => (
                  <button
                    key={`${q.symptom_type}|${q.eye}`}
                    className="btn subtle"
                    onClick={() => {
                      addRow(q.eye, q.symptom_type, q.comparison);
                      setMode("recording");
                    }}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {profileTests.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h2 className="card-title">{t("today.checks_title")}</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                {t("today.checks_hint")}
              </p>
              <button className="btn subtle" onClick={() => nav("self-tests")}>
                ◎ {t("today.open_checks")}
              </button>
            </div>
          )}

          {streak && (
            <p className="muted" style={{ marginTop: 18 }}>
              {streak}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h2 className="card-title">{t("today.when_title")}</h2>
            <div className="btn-row" style={{ flexWrap: "wrap", alignItems: "center" }}>
              <button
                className={`btn ${when === "today" ? "primary" : "subtle"}`}
                aria-pressed={when === "today"}
                onClick={() => setWhen("today")}
              >
                {t("today.when_today")}
              </button>
              <button
                className={`btn ${when === "yesterday" ? "primary" : "subtle"}`}
                aria-pressed={when === "yesterday"}
                onClick={() => setWhen("yesterday")}
              >
                {t("today.when_yesterday")}
              </button>
              <button
                className={`btn ${when === "custom" ? "primary" : "subtle"}`}
                aria-pressed={when === "custom"}
                onClick={() => setWhen("custom")}
              >
                {t("today.when_other")}
              </button>
              {when === "custom" && (
                <input
                  type="date"
                  value={customDate}
                  max={date}
                  onChange={(e) => setCustomDate(e.target.value)}
                  aria-label={t("today.when_other_label")}
                  style={{ width: 170 }}
                />
              )}
            </div>
            {entryDate !== date && (
              <p className="muted" style={{ marginBottom: 0 }}>
                This will be recorded as {formatDate(entryDate)}, not today.
              </p>
            )}
          </div>

          <div className="grid-2">
            {eyePanel("right")}
            {eyePanel("left")}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">Note for today (optional)</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything else worth remembering about today…"
              aria-label="Note for today"
            />
          </div>

          <div className="btn-row save-row">
            <button className="btn subtle" onClick={() => setMode("asking")}>
              Back
            </button>
            <button className="btn primary" onClick={save}>
              {existingLog ? "Update today's record" : "Save today's record"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
