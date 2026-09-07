# Phase 08 — Records intelligence

> **Goal:** turn ten months of small entries into the two or three sentences that matter today.

## Why it matters

The daily loop produces a lot of small, true facts. The clinical value is in the derived question —
what changed, when did it start, is this the same thing as last time — and today that work is split
between a good brief engine, a keyword search, and a deterministic ask layer with eight hand-written
intents. All three are useful and none of them scale to the breadth Phase 05 just added.

## Preconditions

Phase 01 (schema), Phase 02 (indexes), Phase 05 (metrics and self-tests to reason over).

## Scope

```
app/src/lib/query.ts            new — a small structured query language over the record
app/src/lib/ask.ts              rebuilt on query.ts
app/src/lib/search.ts           ranking, synonyms, field filters
app/src/lib/trends.ts           new — series extraction and change detection
app/src/lib/brief.ts            extended sections
app/src/components/Chart.tsx    new — accessible, minimal series chart
app/src/pages/MyEyes.tsx        trend panels
```

## Tasks

1. **A real query layer.** `query.ts` exposes a typed, composable API over the indexes —
   `select('symptoms').eye('left').type('glare').between(a, b).order('asc')` — with every
   entity as a source. Search, ask, brief and trends all become thin callers. This replaces
   eight bespoke array-scans with one tested primitive.

2. **Ask, rebuilt.** Keep the deterministic, no-model, always-cited design; replace hand-written
   intents with an intent grammar over `query.ts`: entity × filter (eye, type, date, source) ×
   aggregation (first, last, count, trend, compare) × framing. Support at minimum:
   first/last occurrence, counts over a period, between-two-appointments windows, comparisons of
   two dated things (prescriptions, measurements, self-tests, drawings), treatment cycles,
   clinician-documented mentions of a term, and "what changed since X". Unresolvable questions must
   still return exactly the existing not-found sentence — never a guess, never a paraphrase of the
   question.

3. **Search v2.** Field-scoped queries (`eye:left type:floaters after:2026-06`), a clinical synonym
   table (floaters/muscae, IOP/pressure/tension, OCT/tomography, injection/anti-VEGF/aflibercept,
   detachment/RD, oedema/edema), typo tolerance on long tokens only, snippet highlighting of the
   matched term, and result grouping by record type. Ranking must stay explainable — a debug view in
   dev mode showing the score breakdown.

4. **Trends.** `trends.ts` extracts numeric series (IOP, acuity, CST, severity by symptom type,
   self-test scores) and detects **descriptive** changes only: level shifts, sustained direction over
   N points, and variability increases, each with the dates and values that produced them. Output is
   phrased factually — "IOP recorded 5 times since 12 Mar; values 18, 19, 22, 24, 23 mmHg" — with no
   clinical judgement and no thresholds. Never colour a value as good or bad.

5. **Accessible charts.** `Chart.tsx`: small multiples, per-eye series, no gridline noise, direct
   labels rather than legends, and a full table alternative rendered for screen readers with the
   same data. Points carry provenance (clinic-measured vs home self-test) as distinct marks — never
   plotted as one indistinguishable line. Honour the Phase 03 themes and contrast requirements.

6. **Brief v2 sections.** Add to the appointment brief, each optional and each clearly badged:
   measurement trends since last visit, treatment adherence and cycle position, self-test comparison,
   and a drawing strip that now spans the full period rather than the most recent eight. Keep the
   one-page default — extra sections are opt-in per brief.

7. **"Is this the same as last time?"** A dedicated comparison flow: pick a symptom or a drawing,
   see every prior instance of it side by side with dates, and mark the current one as
   *same as / different from* a specific earlier instance. This is the question clinicians actually
   ask, and it is currently unanswerable in one step.

## Acceptance criteria

- [ ] Ask handles ≥ 25 question shapes, each with citations, verified by tests; every one returns
      the exact not-found sentence against an empty record.
- [ ] Property test: for randomly generated records, ask and search never return a string that does
      not appear in, or derive numerically from, the passed data.
- [ ] Field-scoped search syntax works and is documented in the palette's empty state.
- [ ] Trend statements are purely descriptive — a review of every generated string in the PR
      confirms no threshold, judgement or prediction language.
- [ ] Charts render an equivalent data table for screen readers; clinic and home values are visually
      and semantically distinct.
- [ ] Brief v2 stays one page by default and prints correctly.
- [ ] Query layer is covered by unit tests; search/ask/brief/trends contain no direct array scans.

## Risks & non-goals

- **No model, ever, in the answer path.** Determinism is the trust property. If a natural-language
  layer is ever added, it must sit strictly above a deterministic retrieval that it cannot
  contradict, and that decision is not in this phase.
- Trend detection is the easiest place in the app to accidentally imply prognosis. When in doubt,
  state the numbers and stop.
- Do not plot home self-tests and clinic measurements on the same axis without visible distinction.

## Agent brief

> Execute `docs/plan/phase-08-records-intelligence.md`. Build a typed query layer over the Phase 02
> indexes, rebuild ask on an intent grammar (deterministic, cited, same not-found sentence), upgrade
> search with field scoping, clinical synonyms and explainable ranking, add descriptive-only trend
> extraction, build an accessible chart with a screen-reader table and provenance-distinct marks,
> extend the brief with opt-in sections, and add a "same as last time?" comparison flow. Include a
> property test asserting no generated string is unsupported by the input data.
