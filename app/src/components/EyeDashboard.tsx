import { useId, useMemo, useRef, useState, type RefObject } from "react";
import Chart from "./Chart";
import { EyeBadge, ProvenanceBadge } from "./ui";
import { toAllData, useStore } from "../lib/store";
import {
  cardFacts,
  markersWithin,
  trackedKinds,
  treatmentMarkers,
  type CardFacts,
  type Side,
} from "../lib/eyedash";
import type { SeriesPoint } from "../lib/trends";
import type { MeasurementKind } from "../lib/models";
import { formatDate } from "../lib/util";

/** "20/25", "0.3 logMAR", "18 mmHg": a Snellen fraction already says what it is. */
function written(p: SeriesPoint) {
  return p.unit && !p.unit.startsWith("Snellen") ? `${p.raw} ${p.unit}` : p.raw;
}

/**
 * The top of My Eyes, in the dashboard layout: a card for each thing measured, and the chosen one
 * over time with the treatments on the same dates.
 *
 * Each bar places the latest reading between the person's own other readings — never against a
 * reference range, never with a word or a colour that grades it.
 */
export default function EyeDashboard() {
  const store = useStore();
  const data = useMemo(() => toAllData(store), [store]);
  const kinds = useMemo(() => trackedKinds(data), [data]);
  const [eye, setEye] = useState<Side>("right");
  const [picked, setPicked] = useState<MeasurementKind | null>(null);
  const [said, setSaid] = useState("");
  const detailId = useId();
  const heading = useRef<HTMLHeadingElement>(null);

  const cards = useMemo(() => kinds.map((k) => cardFacts(data, k, eye)), [data, kinds, eye]);
  const markers = useMemo(() => treatmentMarkers(data, eye), [data, eye]);

  if (kinds.length === 0) return null;

  const selected =
    cards.find((c) => c.series.kind === picked) ??
    cards.find((c) => c.latest) ??
    cards[0];

  return (
    <section className="card eyedash" aria-labelledby="eyedash-title">
      <div className="eyedash-head">
        <h2 className="card-title" id="eyedash-title">
          Measurements in your record
        </h2>
        <div className="seg" role="group" aria-label="Which eye">
          {(["right", "left"] as const).map((side) => (
            <button
              key={side}
              type="button"
              aria-pressed={eye === side}
              onClick={() => setEye(side)}
            >
              {side === "right" ? "Right eye" : "Left eye"}
            </button>
          ))}
        </div>
      </div>

      <div className="eyedash-grid">
        {/* role="list": Safari drops the list role from a list styled without bullets. */}
        <ul className="eyedash-cards" role="list" aria-label={`Measurements, ${eye} eye`}>
          {cards.map((c) => (
            <li key={c.series.kind}>
              <MeasureCard
                facts={c}
                selected={c === selected}
                controls={detailId}
                onSelect={() => {
                  setPicked(c.series.kind as MeasurementKind);
                  setSaid(`Showing ${c.series.label}, ${eye} eye.`);
                  // In one column the chart is far below the cards: take the person to it, or
                  // pressing a card changes nothing they can see.
                  if (window.matchMedia?.("(max-width: 900px)").matches) {
                    requestAnimationFrame(() => {
                      heading.current?.focus();
                      heading.current?.scrollIntoView?.({ block: "start" });
                    });
                  }
                }}
              />
            </li>
          ))}
        </ul>

        <Detail facts={selected} eye={eye} markers={markers} id={detailId} heading={heading} />
        <p className="visually-hidden" aria-live="polite">
          {said}
        </p>
      </div>

      <p className="eyedash-fine">
        Each bar runs between your own lowest and highest readings of that measurement, taken the
        same way (clinic with clinic, home with home). The mark is the latest. The ends are your own
        readings, not limits of normal, and the bar is not a scale of good or bad.
      </p>
    </section>
  );
}

function MeasureCard({
  facts,
  selected,
  controls,
  onSelect,
}: {
  facts: CardFacts;
  selected: boolean;
  controls: string;
  onSelect: () => void;
}) {
  const { series, latest, unchecked } = facts;
  const id = useId();
  if (!latest) {
    // Nothing to open: a plain card, so it is not a control that does nothing.
    return (
      <div className="measure missing">
        <span className="measure-title">{series.label}</span>
        <span className="measure-value muted">
          {unchecked > 0 ? "Read from a document, not checked yet" : "Not recorded"}
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="measure"
      aria-current={selected ? "true" : undefined}
      aria-controls={controls}
      aria-labelledby={`${id}-t ${id}-v ${id}-d`}
      aria-describedby={`${id}-r`}
      onClick={onSelect}
    >
      <span className="measure-top">
        <span className="measure-title" id={`${id}-t`}>
          {series.label}
        </span>
        {/* Selection said in words, so it is never only the outline focus also uses. */}
        {selected ? (
          <span className="measure-showing">Showing</span>
        ) : (
          <span className="measure-chev" aria-hidden="true">
            ›
          </span>
        )}
      </span>
      <span className="measure-value" id={`${id}-v`}>
        {written(latest)}
      </span>
      {latest.provenance === "home" && (
        // A home check under a clinical heading would read as a clinical measurement.
        <span className="measure-how">{latest.method ?? "Home check"}</span>
      )}
      <span className="measure-meta">
        <span id={`${id}-d`}>{formatDate(latest.date)}</span>
        <ProvenanceBadge source={latest.source} />
      </span>
      <Unchecked n={unchecked} />
      <RangeBar facts={facts} id={`${id}-r`} />
    </button>
  );
}

function RangeBar({ facts, id }: { facts: CardFacts; id: string }) {
  const { position, leftEnd, rightEnd, series, latest, unplaced } = facts;
  if (position === undefined || !leftEnd || !rightEnd || !latest) {
    const n = series.points.length;
    const way = latest?.provenance === "home" ? "home checks" : "clinic readings";
    const why: Record<NonNullable<CardFacts["unplaced"]>, string> = {
      none: "Not recorded",
      single: "One reading so far",
      not_numeric: "Latest is written in a form the bar cannot place",
      all_same: `All ${n} readings are the same value`,
      only_of_its_way: `No other ${way} to place it between`,
    };
    return (
      <span className="range range-none" id={id}>
        <span className="range-track" aria-hidden="true" />
        <span className="range-ends">{why[unplaced ?? "none"]}</span>
      </span>
    );
  }
  return (
    <span
      className="range"
      id={id}
      role="img"
      aria-label={`Latest ${written(latest)}. The bar's ends are your own readings ${written(leftEnd)} on the left and ${written(rightEnd)} on the right.`}
    >
      <span className="range-track" aria-hidden="true">
        <span className="range-mark" style={{ left: `${position * 100}%` }} />
      </span>
      <span className="range-ends" aria-hidden="true">
        <span>{written(leftEnd)}</span>
        <span>{written(rightEnd)}</span>
      </span>
    </span>
  );
}

function Detail({
  facts,
  eye,
  markers,
  id,
  heading,
}: {
  facts: CardFacts;
  eye: Side;
  markers: ReturnType<typeof treatmentMarkers>;
  id: string;
  heading: RefObject<HTMLHeadingElement>;
}) {
  const { series, unchecked } = facts;
  const points = series.points;
  if (points.length === 0) {
    return (
      <div className="eyedash-detail" id={id} role="region" aria-labelledby={`${id}-h`}>
        <h3 className="eyedash-detail-title" id={`${id}-h`} ref={heading} tabIndex={-1}>
          {series.label} <EyeBadge eye={eye} />
        </h3>
        <p className="muted">
          {unchecked > 0
            ? `${unchecked} ${unchecked === 1 ? "value" : "values"} read from a document, not checked yet. They appear here once checked.`
            : "Not recorded for this eye."}
        </p>
      </div>
    );
  }

  const first = points[0];
  const latest = points[points.length - 1];
  // The chart spans its plotted readings only; a "CF" before the first number is listed in the
  // table but has no place on the axis, so its date must not widen the list of marked events.
  const plotted = points.filter((p) => p.numeric);
  const within =
    plotted.length > 1
      ? markersWithin(markers, plotted[0].date, plotted[plotted.length - 1].date)
      : [];
  const numbered = within.map((m, i) => ({ ...m, n: i + 1 }));

  return (
    <div className="eyedash-detail" id={id} role="region" aria-labelledby={`${id}-h`}>
      <div className="eyedash-detail-head">
        <h3 className="eyedash-detail-title" id={`${id}-h`} ref={heading} tabIndex={-1}>
          {series.label} <EyeBadge eye={eye} />
        </h3>
        <span className="date-chip">
          {points.length === 1
            ? `1 reading · ${formatDate(first.date)}`
            : `${points.length} readings · ${formatDate(first.date)} – ${formatDate(latest.date)}`}
        </span>
      </div>

      <dl className="pair">
        <div>
          <dt>{points.length === 1 ? "Only reading" : "Earliest in your record"}</dt>
          <dd>
            <span className="pair-value">{written(first)}</span>
            <span className="muted">{formatDate(first.date)}</span>
            <ProvenanceBadge source={first.source} />
          </dd>
        </div>
        {points.length > 1 && (
          <div>
            <dt>Latest</dt>
            <dd>
              <span className="pair-value">{written(latest)}</span>
              <span className="muted">{formatDate(latest.date)}</span>
              <ProvenanceBadge source={latest.source} />
              <Unchecked n={unchecked} />
            </dd>
          </div>
        )}
      </dl>

      <Chart series={series} markers={numbered} />

      {numbered.length > 0 && points.length > 1 && (
        <div className="eyedash-events">
          <h4>Treatment dates in this period</h4>
          <ol role="list">
            {numbered.map((m) => (
              <li key={m.n}>
                <span className="event-n" aria-hidden="true">
                  {m.n}
                </span>
                <span className="event-text">
                  <strong>{m.text}</strong>
                  <span className="muted">{formatDate(m.date)}</span>
                  <ProvenanceBadge source={m.source} />
                </span>
              </li>
            ))}
          </ol>
          <p className="eyedash-fine">
            The numbered lines mark these dates. The chart shows when things happened, not why a
            reading changed. Only start and stop dates, procedures and the most recent injection
            are marked; a treatment that began before the first reading is not listed here.
          </p>
        </div>
      )}
    </div>
  );
}

/** Values waiting to be checked against their document are off the chart, but never unmentioned. */
function Unchecked({ n }: { n: number }) {
  if (n === 0) return null;
  return <span className="measure-how">Also {n} read from a document, not checked yet</span>;
}
