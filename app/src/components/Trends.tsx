import { useMemo } from "react";
import Chart from "./Chart";
import {
  allPrescriptionSeries,
  allSeries,
  describe,
  mixesCylinderForms,
  type Series,
} from "../lib/trends";
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
  const data = useMemo(() => toAllData(store), [store]);
  const series = useMemo(() => allSeries(data), [data]);
  const rx = useMemo(() => allPrescriptionSeries(data), [data]);

  // An empty record still gets the section, so someone looking for their charts finds where they
  // will be rather than nothing at all.
  if (series.length === 0 && rx.length === 0) {
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
      {series.length > 0 && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Values as they were recorded, with how each was taken. Afterlight does not interpret
            these or say whether a change matters — that is for your clinician.
          </p>
          {series.map((s) => (
            <SeriesBlock key={`${s.kind}-${s.eye}`} series={s} />
          ))}
        </>
      )}

      {rx.length > 0 && (
        <>
          <h3 style={{ marginBottom: 4 }}>{t("charts.rx_title")}</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            {t("charts.rx_intro")}
          </p>
          {rx.map((s) => (
            <SeriesBlock key={`${s.kind}-${s.eye}`} series={s} />
          ))}
        </>
      )}
    </section>
  );
}

function SeriesBlock({ series }: { series: Series }) {
  const described = describe(series);
  return (
    <div className="selftest-series">
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <strong>{series.label}</strong>
        <EyeBadge eye={series.eye} />
      </div>
      <p style={{ color: "var(--text-2)", margin: "6px 0" }}>{described.summary}</p>
      <Chart series={series} />
      {described.notes.map((note, i) => (
        <p key={i} className="muted" style={{ fontSize: "var(--fs-sm)", margin: "4px 0" }}>
          {note}
        </p>
      ))}
      {mixesCylinderForms(series) && (
        <p className="muted" style={{ fontSize: "var(--fs-sm)", margin: "4px 0" }}>
          {t("charts.rx_mixed_cylinder")}
        </p>
      )}
    </div>
  );
}
