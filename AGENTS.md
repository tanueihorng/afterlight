# AGENTS.md — working agreement for agents in this repo

This file is the canonical instruction set for any AI agent working on Afterlight.
Read it before your first edit. It applies to every task, not only to plan phases.

Afterlight is a **medical diary for people with eye disease**. Its users are frightened, their
vision is impaired, and they will make decisions with a clinician based on what this app shows
them. That raises the bar on correctness, on honesty, and on restraint. When a trade-off appears
between "impressive" and "trustworthy", trustworthy wins every time.

---

## 1. The seven non-negotiables

These are invariants. Breaking one is a defect, no matter how good the feature is.
`npm run guard` enforces what can be enforced mechanically; the rest is on you.

1. **Local-first, no backend.** No account, no telemetry, no analytics, no third-party requests,
   no CDN assets at runtime. Data leaves only by explicit user export, print or share.
   Adding `fetch()` to a remote host is a design failure, not an optimisation.
2. **Provenance is never lost.** Every record carries `eye` and `source_type`. Patient-reported,
   patient-drawn, clinician-documented, device-measured and document-extracted content stays
   visually and semantically distinguishable — in the UI, in briefs, in print, in exports.
3. **No diagnosis, no risk scores, no prognosis, no reassurance.** The app organises and compares;
   it never interprets. No probabilities, no "your vision is declining", no "this looks normal".
   Emergency guidance is one restrained sentence pointing at a real clinician.
4. **Missing data is shown as missing.** "Not recorded" is never rendered as a normal result.
   A quiet log is never presented as a healthy eye.
5. **Nothing generic is ever presented as the patient's own anatomy.** Every visualization carries
   an unmissable "generic, educational, not your eye" boundary. The more realistic the render,
   the louder that boundary must be.
6. **Calm.** No alarm colour as decoration, no streaks, no guilt, no notifications that would
   frighten someone at 2am. Restraint is a feature.
7. **The daily loop stays under 30 seconds.** Anything added to `Today` must remove equal friction
   elsewhere or be optional.

---

## 2. Repo map

```
EyeExplorer.html          self-contained 3D explorer (Three.js inlined, works offline)
docs/plan/                the build plan — one self-contained brief per phase
docs/plan/STATUS.md       phase ledger; update it when you start and finish a phase
docs/                     product context, accessibility, contributing, review records
app/
  scripts/                build helpers (explorer sync, invariant guard)
  src/
    lib/                  the logic that matters — test it
      models.ts           every record type; each carries eye + source_type
      db.ts               IndexedDB persistence, export/import
      store.tsx           single store; the timeline is DERIVED, never stored twice
      brief.ts            the "what changed?" engine behind the appointment brief
      search.ts           global search across every record type
      ask.ts              deterministic Q&A over the record, always cited, no model
      render.ts           visual-field drawing renderer
      education.ts        generic procedure / condition explainers
    components/           UI primitives, retina diagram, command palette
    pages/                Today · WhatISee · Timeline · MyEyes · Imaging ·
                          Appointments · Visualize · Settings
```

---

## 3. Commands

Run everything from `app/`.

```bash
npm install
npm run dev          # vite dev server
npm run lint         # eslint — accessibility rules are errors, not warnings
npm run test         # vitest
npm run guard        # invariant checks (network calls, banned clinical copy, deps)
npm run verify       # the gate: types + lint + guard + tests + build
npm run build        # production build
npm run format       # prettier
npm run build:standalone   # (from Phase 06) single-file offline explorer
```

**The gate is `npm run verify`.** Do not report a task complete without a clean run.

---

## 4. Conventions

**Style.** Match the surrounding code — it has a voice. Two-space indent, double quotes, ~100
columns, named exports, `type` imports separated. Comments explain *why*, not *what*, and only
where the reason isn't obvious from the code. Do not add file-header comments or JSDoc noise.

**Dependencies.** The app is React 18 + TypeScript + Vite and nothing else. The renderer may add
`three`. Any other runtime dependency needs justification in the PR. Never add a package for
something a dozen lines can do.

**Data model.** New record types belong in `models.ts` and must carry `id`, `created_at`,
`updated_at`, `eye`, `source_type`, and optional `demo`. Anything schema-changing needs a migration
in `lib/migrations.ts` with `SCHEMA_VERSION` bumped — never a silent shape change. Migrations are
pure functions over a snapshot, run once inside a transaction after a pre-migration backup.

**Stored files.** Uploads live in the `files` store as `ArrayBuffer` bytes, never as `Blob`s —
Blob support in IndexedDB is uneven and untestable. Use `saveStoredFile` (which reports quota
failures), and `storedFileToBlob` / `storedFileURL` to display them.

**Derived, not duplicated.** The timeline, indexes, briefs and search results are computed from
stored entities. Do not persist a second copy of the truth.

**Copy.** Plain language, British-leaning spelling as used in the existing strings, no exclamation
marks, no marketing voice, no false comfort. Write as if the reader is anxious and tired, because
they are.

**Accessibility.** From Phase 03 this is enforced by tests; before then, still: label every
control, keep focus visible, never carry meaning in colour alone, keep targets ≥ 44 px.

**Demo data.** Every demo record sets `demo: true` and must remain removable in one action.
Keep the demo story clinically coherent — it is how new users judge the app.

---

## 5. What requires a human

An agent must **not** self-approve any of these. Prepare the work, flag it clearly in the PR, stop.

- **Clinical wording** that is not already in the repo — condition descriptions, symptom
  explanations, procedure steps, anything a patient could read as advice. Put new strings in
  `docs/atlas-review.md` with sources and mark the PR as needing sign-off.
- **Safety and emergency copy.** Never reword the urgent-assessment guidance on your own.
- **Anything that weakens a non-negotiable**, even temporarily, even behind a flag.
- **Deleting or migrating user data** in a way that is not reversible from an export.
- **Publishing** — deploys, releases, npm, or anything that puts the app in front of patients.

---

## 6. Working on a plan phase

1. Read `docs/plan/phase-NN-*.md` end to end, then the files in its **Scope**.
2. Mark the phase `in progress` in `docs/plan/STATUS.md` with the date and branch.
3. Work the **Tasks** in order — they are dependency-ordered.
4. Verify every **Acceptance criterion** by running something, not by opinion.
5. `npm run verify` clean.
6. Commit as `phase-NN: <what changed>`; branch `phase-NN-<slug>`.
7. Update `STATUS.md` to `done`, with what you did **not** do and why.

**Scope discipline.** Do not fix things outside the phase Scope — note them in the PR instead.
If a task turns out to be wrong, stop and say so. A phase brief is a plan, not a contract with
reality.

**Reporting.** State plainly what passed, what failed, and what you skipped. Never report a
partially-done phase as done. If tests fail, include the output.

---

## 7. Definition of done

- `npm run verify` passes clean.
- New behaviour has a test that would fail if the behaviour regressed.
- Keyboard and screen-reader paths work for anything new.
- No non-negotiable regressed — check explicitly, do not assume.
- The demo dataset still loads and still looks coherent.
- Docs updated where a user or a future agent would need to know.
