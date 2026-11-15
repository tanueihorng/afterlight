import { useId, useLayoutEffect, useRef, useState } from "react";
import type { Series } from "../lib/trends";
import { formatDate } from "../lib/util";
import { EYE_LABELS } from "../lib/models";

/**
 * A small series chart, and the same data as a table.
 *
 * The table is not a fallback: it is rendered for screen readers and available to everyone,
 * because for a lot of the people using this app the numbers are more legible than the picture.
 *
 * Clinic measurements and home checks are drawn as different marks and never joined into one
 * line — they are not the same kind of measurement, and a line implies they are.
 */
export default function Chart({
  series,
  height: minHeight = 160,
}: {
  series: Series;
  height?: number;
}) {
  const id = useId();
  const points = series.points.filter((p) => p.numeric);
  // The drawing is laid out at the width it is actually shown at, one unit per CSS pixel, so it
  // is never scaled: labels stay at the text size the person chose (they used to shrink to ~6px
  // on a phone), and the marks stay the size they were drawn at.
  const box = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState({ width: 520, font: 14 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => {
      const font = parseFloat(getComputedStyle(el).fontSize) || 14;
      setMeasured((m) =>
        m.width === (el.clientWidth || 520) && m.font === font
          ? m
          : { width: el.clientWidth || 520, font },
      );
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (points.length === 0) {
    return (
      <p className="muted">
        {series.label}: nothing that can be plotted.{" "}
        {series.points.length > 0 && "The recorded values are not numbers."}
      </p>
    );
  }

  const { width, font } = measured;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const firstLabel = formatDate(points[0].date);
  const lastLabel = formatDate(points[points.length - 1].date);
  // An estimate of the text width is enough here: it only decides between one row and two.
  const stackDates = (firstLabel.length + lastLabel.length) * font * 0.58 + 24 > width;
  const valueLabels = (min === max ? [min] : [min, max]).map(
    (value) => points.find((p) => p.value === value)?.raw ?? String(value),
  );
  const longest = Math.max(...valueLabels.map((l) => l.length));
  // Room for the labels at their real size: values down the left, the two dates along the foot.
  const pad = {
    top: Math.ceil(font * 0.7) + 4,
    right: 12,
    // Two date rows when the first and last dates cannot sit side by side without colliding.
    bottom: Math.ceil(font * 1.6) + (stackDates ? Math.ceil(font * 1.3) : 0),
    left: Math.ceil(longest * font * 0.62) + 10,
  };
  const height =
    Math.max(minHeight, Math.ceil(font * 8)) + (stackDates ? Math.ceil(font * 1.3) : 0);
  const dates = points.map((p) => new Date(p.date).getTime());
  const firstDate = Math.min(...dates);
  const lastDate = Math.max(...dates);
  const dateSpan = lastDate - firstDate || 1;

  const x = (p: (typeof points)[number]) =>
    pad.left +
    ((new Date(p.date).getTime() - firstDate) / dateSpan) * (width - pad.left - pad.right);
  const y = (p: (typeof points)[number]) => {
    const t = (p.value - min) / span;
    // logMAR runs the opposite way to how acuity reads, so the axis flips for display only.
    const norm = series.invertForDisplay ? t : 1 - t;
    return pad.top + norm * (height - pad.top - pad.bottom);
  };

  const clinic = points.filter((p) => p.provenance === "clinic");
  const home = points.filter((p) => p.provenance === "home");

  return (
    <figure style={{ margin: "12px 0" }}>
      <div ref={box} className="chart-box">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-table`}
        >
          <title id={`${id}-title`}>
            {series.label}, {EYE_LABELS[series.eye]}, {series.points.length}{" "}
            {series.noun?.many ?? "readings"} from {formatDate(points[0].date)} to{" "}
            {formatDate(points[points.length - 1].date)}
          </title>

          {/* Two gridlines only: the extremes, labelled. Anything more is noise.
            Labelled with the value as it was written — "20/200", not the logMAR the axis uses,
            which means nothing to the person whose record this is. */}
          {(min === max ? [min] : [min, max]).map((value, i) => {
            const yy =
              pad.top + (series.invertForDisplay === (i === 0) ? 0 : height - pad.top - pad.bottom);
            const label = points.find((p) => p.value === value)?.raw ?? String(value);
            return (
              <g key={i}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={yy}
                  y2={yy}
                  stroke="var(--border-soft)"
                />
                <text x={4} y={yy + font * 0.35} fontSize={font} fill="var(--text-3)">
                  {label}
                </text>
              </g>
            );
          })}

          {/* Clinic readings joined; home checks left as separate marks. */}
          {clinic.length > 1 && (
            <polyline
              points={clinic.map((p) => `${x(p)},${y(p)}`).join(" ")}
              fill="none"
              stroke="var(--accent-strong)"
              strokeWidth="2"
            />
          )}
          {clinic.map((p, i) => (
            <circle key={`c${i}`} cx={x(p)} cy={y(p)} r="4" fill="var(--accent-strong)" />
          ))}
          {home.map((p, i) => (
            // A different shape, not just a different colour.
            <rect
              key={`h${i}`}
              x={x(p) - 4}
              y={y(p) - 4}
              width="8"
              height="8"
              transform={`rotate(45 ${x(p)} ${y(p)})`}
              fill="none"
              stroke="var(--text-2)"
              strokeWidth="2"
            />
          ))}

          <text
            x={stackDates ? 4 : pad.left}
            y={height - font * 0.35 - (stackDates ? Math.ceil(font * 1.3) : 0)}
            fontSize={font}
            fill="var(--text-3)"
          >
            {firstLabel}
          </text>
          <text
            x={width - pad.right}
            y={height - font * 0.35}
            fontSize={font}
            fill="var(--text-3)"
            textAnchor="end"
          >
            {lastLabel}
          </text>
        </svg>
      </div>

      <details>
        <summary className="muted" style={{ cursor: "pointer", fontSize: "var(--fs-sm)" }}>
          The same readings as a table
        </summary>
        <table className="table" id={`${id}-table`}>
          <caption className="visually-hidden">
            {series.label}, {EYE_LABELS[series.eye]}: the date, value and how each was taken
          </caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Value</th>
              <th scope="col">How it was taken</th>
            </tr>
          </thead>
          <tbody>
            {series.points.map((p, i) => (
              <tr key={i}>
                <td>{formatDate(p.date)}</td>
                <td>{p.unit ? `${p.raw} ${p.unit}` : p.raw}</td>
                <td>
                  {p.howLabel ??
                    (p.provenance === "home" ? "Check done at home" : "Measured at a clinic")}
                  {p.method ? ` — ${p.method}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      {home.length > 0 && clinic.length > 0 && (
        <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>
          Diamonds are checks you did yourself and circles are clinic measurements. They are not the
          same kind of measurement, so they are not joined into one line.
        </p>
      )}
    </figure>
  );
}
