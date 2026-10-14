import { useMemo } from "react";
import Chart from "./Chart";
import { allSeries, describe } from "../lib/trends";
import { toAllData, useStore } from "../lib/store";
import { EyeBadge } from "./ui";
import { t } from "../lib/i18n";

/**
 * Recorded numbers over time, described and not judged.
 *
 * There is no threshold anywhere here, no colour that means good or bad, and no arrow. The values
 * and the dates are the content; what they mean is a clinician's judgement.
 */
export default function Trends() {
  const store = useStore();
  const series = useMemo(() => allSeries(toAllData(store)), [store]);

  // An empty record still gets the section, so someone looking for their charts finds where they
  // will be rather than nothing at all.
  if (series.length === 0) {
    return (
      <section className="card" id="trends" tabIndex={-1} aria-labelledby="trends-title">
        <h2 className="card-title" id="trends-title">
          {t("charts.title")}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {t("charts.empty")}
        </p>
      </section>
    );
  }

  return (
    <section className="card" id="trends" tabIndex={-1} aria-labelledby="trends-title">
      <h2 className="card-title" id="trends-title">
        {t("charts.title")}
      </h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Values as they were recorded, with how each was taken. Afterlight does not interpret these
        or say whether a change matters — that is for your clinician.
      </p>

      {series.map((s) => {
        const described = describe(s);
        return (
          <div key={`${s.kind}-${s.eye}`} className="selftest-series">
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <strong>{s.label}</strong>
              <EyeBadge eye={s.eye} />
            </div>
            <p style={{ color: "var(--text-2)", margin: "6px 0" }}>{described.summary}</p>
            <Chart series={s} />
            {described.notes.map((note, i) => (
              <p key={i} className="muted" style={{ fontSize: "var(--fs-sm)", margin: "4px 0" }}>
                {note}
              </p>
            ))}
          </div>
        );
      })}
    </section>
  );
}
