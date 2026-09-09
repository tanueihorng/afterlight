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
docs/clinical-review.md   the review register; its status line blocks a release
docs/boundaries.md        what the app refuses to do, and why
docs/guide.md             the user guide · keeping-it-safe.md · translating.md
site/                     the landing page — static, no third-party requests at all
CHANGELOG.md              generated from app/src/lib/changelog.ts; do not edit by hand
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
      pdf.ts              deterministic PDF writer — pure, no clock, no randomness
      briefpdf.ts         brief → printable document model (ordering, provenance split)
      briefexport.ts      the browser half: rasterising drawings, downloads, Web Share
      qr.ts               byte-mode QR encoder, versions 1–20, levels L and M
      share.ts            range-scoped, encrypted extracts of part of the record
      ingest.ts           filenames, PDF headers, DICOM, and the OCR seam
      i18n.ts             translation lookup; locales/en.ts is the source catalogue
      changelog.ts        VERSION and the patient-facing changelog (one source of truth)
    components/           UI primitives, retina diagram, command palette
    pages/                Today · WhatISee · Timeline · MyEyes · Imaging ·
                          Appointments · Visualize · Settings
    print.css             the printed page; loaded after styles.css so it wins
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
npm run bundle       # initial-download budget (120 KB JS gzip, 20 KB CSS)
npm run verify       # the gate: types + lint + guard + tests + build + bundle
npm run e2e          # Playwright: desktop and phone, including offline
npm run build        # production build
npm run build:standalone   # single-file offline explorer (EyeExplorer-engine.html)
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
stored entities. Do not persist a second copy of the truth. Read them through `lib/query.ts`
(`select(data, "symptoms").eye("left").between(a, b)`), which sits on the cached indexes — do not
scan the entity arrays directly in a component or a lib.

**Numbers are described, never judged.** `lib/trends.ts` may state counts, dates, values and
arithmetic differences. It may not use a threshold, a direction word that carries a verdict
("worsening", "stable"), a prediction, or a colour that means good or bad. Clinic measurements and
home checks are never plotted as one line. The guard fails the build on verdict language.

**The atlas and the simulator.** A condition is a parameter delta over the normal eye, never its
own artwork. The atlas is a reference someone navigates: it is never surfaced from their symptoms
and never ranked against their record. In the simulator, field loss fades and is never black, and
retinal locations invert to field locations — both enforced by tests and by the guard.

**The renderer.** Anatomy comes from `engine/anatomy/dimensions.ts` in millimetres — never a
number that looked right. Anything that varies between people or conditions is a parameter, not a
baked asset. Every view carries `GENERIC_MODEL_BOUNDARY`; the more convincing the render, the more
that matters. See `docs/engine.md` and `docs/asset-pipeline.md`.

**What leaves the device.** Three paths, and only three: print, a generated PDF, and an encrypted
extract. All of them are produced locally, and all of them carry `PATIENT_GENERATED_FOOTER` — the
document says what it is on every page, because a page that gets separated from the rest must
still say it is not a clinical record.

`lib/pdf.ts` is pure and deterministic: no clock, no locale, no randomness, so the same brief
always produces the same bytes and "has this changed?" is answerable by comparing two files. The
guard fails the build on `new Date`, `Math.random` or locale formatting anywhere in it. Fonts are
the PDF base-14, so nothing is embedded and nothing is fetched.

**Sharing is scoped, and the scope is stated.** `defaultScope` carries the person's own entries
and their questions — never imaging, documents, diagnoses or original files unless they are asked
for, which the guard enforces. Counts of what is included *and what is left out* are computed and
shown before a file exists. A share bundle is an ordinary archive plus a descriptor, so it imports
through the code that is already tested. The QR card is plain text and says so.

**Nothing read out of a file is a fact.** A date from a filename, a laterality from `_OD`, a line
of recognised text: all `source_type: "document_extracted"`, `confirmed: false`, and **excluded
from the appointment brief** until a person confirms them. `PERSON_CONFIRMED` is the only place
`true` is written, and the guard fails the build on a bare `confirmed: true` in the ingestion path.
An ambiguous date (`04-09-2026`) is returned as both readings and never resolved by guessing a
locale. A file that cannot be read is stored intact with a plain sentence saying so — never
dropped, never failed. Text recognition is not bundled; see `docs/ocr.md` for why and how to add
one.

**Weight.** Pages other than Today and Timeline are lazy-loaded and must stay that way; the bundle
check enforces it. Object URLs for stored files are created with `storedFileURL` and must be
released with `releaseFileURL`, because each one pins a whole scan in memory.

**Copy.** Plain language, British-leaning spelling as used in the existing strings, no exclamation
marks, no marketing voice, no false comfort. Write as if the reader is anxious and tired, because
they are.

**The daily loop.** `Today` is a decision before it is a form: two large targets, then only the
fields the answer requires. Suggestions come from the person's own history and never from a
generic list — prompting symptoms someone has not reported puts words in a patient's mouth.
Entries are dated by when the change started, not when the form was filled in.

**Accessibility.** Enforced by tests, and treated as a product requirement rather than advice.
Sizes come from the `--fs-*` tokens (never literal `rem`), colours from the theme tokens (a new
colour must pass `contrast.test.ts` in all four themes), targets are ≥ 44px, focus is never
removed, and meaning is never carried by colour alone. Canvas and image content needs a real text
equivalent — see `lib/describe.ts`. `npm run test` runs axe over every page, dialog, theme and the
largest type scale, plus a keyboard-only journey. See `docs/accessibility.md`.

**Demo data.** Every demo record sets `demo: true` and must remain removable in one action.
Keep the demo story clinically coherent — it is how new users judge the app.

**Nothing is fetched, and it is checked twice.** `npm run guard` reads the source; `npm run
nonetwork` reads the *built* files and `site/`, and fails on anything a browser would load from a
third party — a `src`, a `<link href>`, a `url()`, an `@import`, a worker, a fetch. A URL in a
string is listed but allowed, because a link someone chooses to follow is not a request.

**Words a person reads go through `t()`.** New user-facing strings belong in
`lib/locales/en.ts`, not inline. The exceptions are the boundary statements and the ask layer's
not-found sentence: those stay next to their own code, where the guard checks them by name, and a
translator collects them with `npm run clinical-pack`. Do not move them into the catalogue — it
disarms the checks and drags the PDF writer into the initial chunk. See `docs/translating.md`.

**The version is one number in one place.** `lib/changelog.ts` carries `VERSION` and the
patient-facing list; `CHANGELOG.md` is generated from it and `npm run changelog:check` fails the
build if they drift. `package.json` must agree. Write entries the way you would tell a patient what
changed, not the way you would write a commit message.

---

## 5. What requires a human

An agent must **not** self-approve any of these. Prepare the work, flag it clearly in the PR, stop.

- **Clinical wording** that is not already in the repo — condition descriptions, symptom
  explanations, procedure steps, anything a patient could read as advice. Put new strings in
  `docs/atlas-review.md` with sources and mark the PR as needing sign-off.
- **Anything written for a clinician to read**, including `docs/clinician-note.md` and the wording
  on the printed brief. A patient will hand that page to a doctor; it needs the same sign-off as
  clinical copy.
- **Safety and emergency copy.** Never reword the urgent-assessment guidance on your own.
- **Anything that weakens a non-negotiable**, even temporarily, even behind a flag.
- **Deleting or migrating user data** in a way that is not reversible from an export.
- **Publishing** — deploys, releases, npm, or anything that puts the app in front of patients. The
  Pages workflow is `workflow_dispatch` only and `npm run release` neither pushes nor deploys.
- **Marking the clinical review done.** Only a human may change the status line in
  `docs/clinical-review.md`. An agent may prepare the pack (`npm run clinical-pack`), chase the
  reviewer, apply the corrections and update every other part of that file. It may not accept the
  review, and `npm run release` refuses to tag while the line says `NOT REVIEWED`.

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
