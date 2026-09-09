# Phase ledger

The single place that says what has actually been built. Agents update this when they **start** and
when they **finish** a phase. Keep it honest — a phase marked done that isn't is worse than one
marked blocked.

**States:** `not started` · `in progress` · `blocked` · `done` · `partial (see notes)`

| # | Phase | State | Branch | Updated | Notes |
|---|---|---|---|---|---|
| 00 | Foundations & guardrails | done | phase-00-foundations | 2026-09-08 | 96 tests; `verify` = types + lint + guard + tests + build; CI green |
| 01 | Data integrity & portability | done | phase-01-data-integrity | 2026-09-08 | archive v2 + migrations + encryption + merge; files now stored as bytes |
| 02 | Performance & scale | done | phase-02-performance | 2026-09-08 | indexes, windowed timeline, code splitting, worker thumbnails, PWA (offline unverified) |
| 03 | Accessibility for low vision | done | phase-03-low-vision-access | 2026-09-08 | 4 themes, scalable type, axe + keyboard tests, drawings described in words |
| 04 | Daily loop & mobile | done | phase-04-daily-loop-mobile | 2026-09-08 | bottom nav, sheets, two-target Today, Playwright on desktop + iPhone; offline now verified |
| 05 | Clinical breadth & self-tests | done, pending clinical review | phase-05-clinical-breadth | 2026-09-08 | 13 profiles, self-checks, unit-aware metrics; **all new clinical copy needs sign-off** |
| 06 | Visualization I — render engine | done, procedural only | phase-06-render-engine | 2026-09-08 | engine + standalone build shipped; **Blender bake track unrun — Blender not installed** |
| 07 | Visualization II — disease atlas | done, pending clinical review | phase-07-disease-atlas | 2026-09-08 | 50 conditions, severity, compare, patient-view simulator; **all atlas copy needs sign-off** |
| 08 | Records intelligence | done | phase-08-records-intelligence | 2026-09-08 | query layer, ask grammar, search v2, descriptive trends, accessible charts |
| 09 | Clinician handoff & sharing | done, pending clinical review | phase-09-clinician-handoff | 2026-09-09 | deterministic PDF, print, encrypted range shares, QR, ingestion; **`docs/clinician-note.md` and the printed wording need sign-off**; OCR engine not bundled |
| 10 | Release & clinical review | done, blocked on clinical review | phase-10-release | 2026-09-09 | landing page, guide, backup story, i18n layer, issue templates, versioning; **release script refuses to tag while `docs/clinical-review.md` says NOT REVIEWED** |

## Log

Newest first. One line per meaningful event: phase started, phase finished, invariant changed,
scope cut, or a decision a future agent would otherwise have to re-derive.

- **2026-09-09** — **Phase 10 done; the release itself is blocked, deliberately.** Everything a
  first-time visitor needs exists: a static landing page written for a patient rather than a
  developer, `docs/guide.md`, `docs/boundaries.md` setting out what the app refuses to do, and
  `docs/keeping-it-safe.md` — the backup story, which is now a first-run step of its own as well as
  a section in Settings, because a cleared browser is how people actually lose four years of
  entries.
  **The privacy claim is now checked against what ships, not the source.** `npm run nonetwork`
  reads `app/dist` and `site/` and fails on anything a browser would fetch from a third party — a
  `src`, a `<link href>`, a `url()`, an `@import`, a worker, a socket. An anchor someone chooses to
  follow is listed but allowed; a link tag is not. Verified end to end by loading the assembled site
  in a real browser and counting requests: **zero external requests**, from the landing page through
  to the daily loop.
  **Versioning has one source.** `lib/changelog.ts` holds `VERSION` and the patient-facing list;
  `CHANGELOG.md` is generated from it, `npm run changelog:check` fails the build on drift, and the
  same list is shown in Settings → About. The version is **0.10.0, not 1.0.0**: a 1.0 on a tool
  that touches eye care would claim the clinical wording had been reviewed, and it has not.
  **The clinical review is now a constraint rather than a note.** `docs/clinical-review.md` carries
  a status line only a human may change; `npm run release` refuses to tag while it says
  `NOT REVIEWED`; and a new guard rule fails the build if the app and the landing page stop saying
  so. `npm run clinical-pack` generates `docs/clinical-pack.md` from the source — 93 strings across
  safety wording, boundary statements, condition profiles, all 50 atlas "what people notice" lines
  and the home-check instructions, each with the question it needs answering. That is the document
  to send. The first version of that extractor returned identifiers and half-sentences, which is
  worse than useless in something a clinician is asked to read carefully; it now takes string
  literals and JSX text only, and keeps what reads like a sentence.
  **i18n exists and is honest about its coverage.** `lib/i18n.ts` plus `lib/locales/en.ts`: the app
  shell, the whole daily loop, provenance and eye labels, and the safety and boundary copy in
  Settings. The pages beyond that are not extracted, and `docs/translating.md` says so rather than
  implying a finished job. Boundary statements deliberately stay beside their own code — moving them
  into the catalogue would disarm the guard rules that check them by name, and would have dragged
  the PDF writer into the initial chunk to render a nav bar.
  Also: PNG icons at 192/512 and an `apple-touch-icon`, because an SVG-only manifest looks correct
  in review and silently never offers installation on Android, and iOS would have used a screenshot
  of the page. Issue templates for a bug, an **accessibility barrier** (prioritised) and a
  **clinical accuracy concern** (labelled `needs-human-review`, never closed by an agent), plus a
  contact link that sends anyone with a sudden change to a real doctor before the tracker.
  `SECURITY.md` names the threats that actually exist here — data integrity first, since a record is
  not recoverable from anywhere — and `CODE_OF_CONDUCT.md` is written for a project whose users are
  patients, including a rule against giving medical advice in issues.
  One real bug found on the way: `.modal` was unpositioned, so the fixed `.backdrop-dismiss` layer
  painted above every dialog in the app and swallowed clicks meant for its own controls. That was
  Phase 09's find, and this phase confirmed the fix holds across both projects.
  **Not done, and needing a human:** the clinical review itself; the hosted deploy (the Pages
  workflow is `workflow_dispatch` only and asks for a typed confirmation); the physical print check
  on A4 and Letter; the clinician-reader test; and installing the PWA on a real iPhone and Android
  handset. The first four were already outstanding; the last is new and is the only acceptance
  criterion this phase could not verify in software.
  542 unit tests, 49 E2E.
- **2026-09-09** — **Phase 09 done, pending clinical review.** The brief now survives contact with
  a clinic. `lib/pdf.ts` is a small deterministic PDF writer written here rather than installed:
  the artefact that leaves the device has to be byte-stable, work with the network off, and never
  carry a dependency that could fetch a font. No clock, no locale, no randomness — the same brief
  produces byte-identical output, which is what makes "has this changed?" answerable by comparing
  two files, and the guard fails the build on `new Date`, `Math.random` or locale formatting
  anywhere in it. Fonts are the PDF base-14, so nothing is embedded and nothing is fetched; that is
  a deliberate trade against PDF/A, recorded in `docs/clinician-note.md`.
  The brief is reordered for a sixty-second read: what changed in each eye and what the patient
  wants to ask are above the fold, everything else is context below. Inside an eye panel the
  patient's own reports and anything copied from a clinic document are separately headed and never
  share a list of bullets — blending them is the specific failure this document exists to prevent.
  A real `print.css` prints the page you are looking at rather than a second copy built for the
  printer: chrome hidden, black on white whatever the theme, sections kept whole across page
  breaks, truncation expanded, and provenance badges rendered as bracketed words because colour
  chips vanish on a mono printer.
  `lib/share.ts` produces a range-scoped, encrypted extract. The default carries the person's own
  entries and their questions and nothing else — never imaging, documents, diagnoses or original
  files unless asked for, enforced by a new guard rule — and the counts of what is included *and
  what is left out* are computed and shown before a file exists. A bundle is an ordinary archive
  plus a descriptor, so it imports through the code that is already tested. `lib/qr.ts` is a
  byte-mode QR encoder (versions 1–20, levels L and M) written for the same reason as the PDF
  writer; its output was verified against Apple's own decoder, including a byte-exact round trip,
  and four decoder-verified symbols are pinned as golden fixtures.
  Present mode pages one section at a time by keyboard and swipe, in the audited high-contrast
  light palette, holding a wake lock and restoring the person's own theme on exit.
  Ingestion reads what a clinic actually exports: filenames, PDF headers, and DICOM study date,
  modality, laterality, institution and encapsulated JPEG. **An ambiguous date (`04-09-2026`) comes
  back as both readings and is never resolved by guessing a locale**, and a file that cannot be
  read is stored intact with a plain sentence saying so. Everything derived is
  `document_extracted` / `confirmed: false`, and **unconfirmed extractions are now excluded from
  the appointment brief** — the UI promised that before the code did it, which is exactly the kind
  of sentence this app must not write.
  Four real defects found by looking at the output rather than at the tests: the patient's drawings
  printed as **solid black squares** (a white fill drawn before `renderDrawing`'s `clearRect`, and
  JPEG has no alpha); the QR card trimmed off the *new* symptom because it dropped lines by
  position rather than importance; the handoff card cut its own "not a clinical record" line off to
  fit; and `.backdrop-dismiss` painted above every modal in the app, swallowing clicks meant for
  the dialog's own controls — that one has been there since the modal was written.
  **Deviations:** text recognition is not bundled. Fetching Tesseract at runtime breaks
  non-negotiable #1 and bundling it costs about ten megabytes, so the pipeline, the confirm-before-
  it-counts rule and the tests all exist behind a registered-recogniser seam, and the app says it
  is not installed — which is true. PDF *page thumbnails* and page-range selection are also not
  here; they need a PDF renderer, and page count plus metadata is what can be read honestly without
  one. Both recorded in `docs/ocr.md`.
  **`docs/clinician-note.md` is unreviewed.** It is written for a doctor to read at a desk, so it
  needs the same sign-off as clinical copy; AGENTS.md §5 now says so explicitly.
  **Not yet done: the physical print check and the clinician-reader test.** Both need a human — a
  real printer on A4 and Letter, and someone unfamiliar with the app reading the brief against a
  clock. They are the remaining acceptance criteria.
  531 unit tests, 37 E2E (9 skipped: the known WebKit offline reload and the mobile engine cases).
- **2026-09-08** — **Phase 08 done.** `lib/query.ts` is now the one primitive the derived engines
  share — `select(data, "symptoms").eye("left").between(a, b).order("asc")` — reading from the
  Phase 02 indexes rather than re-walking arrays, with each entity's own date field known in one
  place. Ask keeps its deterministic, always-cited design and gains an intent grammar over that
  layer: counts over a named window ("this year", "the last 30 days", "since my last appointment"),
  most-recent-of-anything, and measurement trends, on top of the existing hand-written intents.
  Thirty-plus question shapes answered, and a property test asserts no answer states a number the
  record does not support.
  Search v2: field scoping (`eye:left type:floaters after:2026-06`), a **symmetric** clinical
  synonym table, typo tolerance on long words only, and a `why` on every hit so ranking can be
  explained rather than trusted. Two real gaps found while testing — synonyms worked only one way
  (`oct`→`tomography`, not back, which is the direction a patient reading a letter actually needs),
  and a fields-only query returned nothing at all.
  `lib/trends.ts` extracts numeric series with acuity converted to logMAR so a mixed record reads as
  one line, keeps non-numeric acuities (CF, HM, LP) as carried-but-not-plotted, and describes a
  series in words that are pure arithmetic. A new guard rule fails the build if trend copy uses
  verdict language, and a test asserts the same. Clinic and home values are marked distinctly and
  never joined into one line.
  `Chart.tsx` renders the picture and the same readings as a table — not a fallback, since for many
  of these users the numbers are more legible than the graph — with different mark shapes for
  clinic and home, and axis labels in the notation the value was recorded in rather than the
  logMAR the axis uses.
  Also: opt-in brief sections (recorded numbers, home checks) that keep the default to one page,
  and "Is this the same as last time?" — every earlier instance of a symptom side by side, with the
  answer recorded in the patient's own words rather than inferred.
  462 tests.
- **2026-09-08** — **Phase 07 done, pending clinical review.** Fifty conditions across all four
  regions — ocular surface, anterior segment, vitreoretina and optic nerve — each a parameter delta
  over the Phase 06 engine rather than its own picture, which is what makes severity a slider
  instead of a set of images. Composable lesion layers (dot-blot and flame haemorrhages, exudates,
  cotton-wool spots, drusen, atrophy, subretinal bleed, neovascular fronds, laser scars, PRP, bone
  spicules, detachment, tear, macular hole, membrane, haze) so combinations like proliferative
  retinopathy with oedema after laser render correctly together.
  The patient-view simulator is the flagship: central scotoma, metamorphopsia as a real distortion
  field rather than blur, arcuate and peripheral loss, curtain, floaters, glare, haloes, contrast
  and colour loss, diplopia, photophobia. Two properties are enforced by tests — **field loss fades
  rather than ending at an edge, and is never painted black** (the tunnel-with-black-walls picture
  is the most misleading image in this subject), and **retina inverts to field**, so a superior
  detachment shows as a shadow rising from below. Getting that backwards would teach a patient the
  opposite of what to report.
  Compare mode with locked views, deep links (`#/visualize/atlas/<id>`), documented diagnoses
  linked to their entries, and "is this like what you see?" which drafts a description into the
  drawing page and writes nothing until the person saves.
  Three real bugs found by looking at the output: the curtain washed from the wrong edge and was
  barely visible; detachment rendered as a hard-edged pie slice rather than a billowing dome with a
  soft boundary; and **deep links only worked on first mount** — `useHashRoute` stored just the base
  route, so `#/visualize/atlas/pdr` never re-rendered anything. The router now tracks the whole hash.
  Two new guard rules: the atlas may never rank conditions against someone's symptoms, and the
  simulator may never paint field loss black.
  **All fifty entries are unreviewed and listed in full in `docs/atlas-review.md`**, with the
  specific questions a clinician should answer — chiefly whether any "what people notice" line is
  wrong, since that is what a patient will match themselves against.
  **Deviation from the plan:** procedure animations were to be authored in Blender. Blender is not
  installed here, so procedures remain the Phase 05 schematic explainers, now scrubbable with a
  step slider. Recorded in the review doc.
- **2026-09-08** — **Phase 06 done, procedural only.** A framework-agnostic Three.js engine under
  `app/src/engine/`, built from real ocular dimensions: the sclera's corneal aperture, the corneal
  cap and the limbus meet where the arithmetic puts them. The first attempt rendered a featureless
  white ball because the iris was sealed inside an opaque sphere — the anterior geometry is now
  derived rather than eyeballed. A refractive cornea (IOR 1.376) over a procedural iris (stromal
  fibres, collarette, crypts, furrows, pupillary ruff, limbal ring, relief from the same painting)
  and a pupil that eases 2–8 mm on a nonlinear light response.
  The fundus is grown, not drawn: four arcades from the disc, arteries paler and narrower than
  their veins at roughly 3:2, tapering along their length, never entering the avascular zone
  (asserted), with the disc nasal to the fovea and mirrored between eyes. Three rounds of
  correction there — uniform-width vessels, a sunburst of choroidal lines radiating from centre,
  and spoke-like striations across the whole image — each of which made it read as drawn rather
  than photographed.
  Personalisation is cosmetic and bounded: iris colour from one melanin model rather than four
  textures, limbal ring, scleral vessels, fundus pigmentation. `GENERIC_MODEL_BOUNDARY` is
  exported from one place and carried by every view including the canvas's accessible name.
  Three.js sits entirely in the lazy Visualize chunk: initial JS is unchanged at 73.9 KB.
  `npm run build:standalone` emits `EyeExplorer-engine.html` — 0.47 MB against a 5 MB budget,
  verified rendering from `file://` with the network off and zero external references. **The
  original `EyeExplorer.html` is untouched**: it still carries disease scenarios and a diagnose
  flow the engine does not have, and replacing it is a human decision once Phase 07 reaches parity.
  I overwrote it once during this phase and restored it from git; the build script now writes
  alongside it deliberately.
  **The Blender bake track is written but has never been run — Blender is not installed here.**
  `assets-src/build-eye.py`, `ASSETS.md`, `verify-assets.mjs` (in CI) and `docs/asset-pipeline.md`
  all exist; the engine is fully procedural in the meantime, which is a working state rather than
  a placeholder. Baking is the first task for whoever has Blender 4.x.
  Also fixed: two tests were time-dependent — an appointment dated "today at 10:00" is upcoming
  before 10am and past after it, so they passed in the morning and failed in the afternoon.
- **2026-09-08** — **Phase 05 done, pending clinical review.** 13 condition profiles beyond the
  retina (glaucoma, AMD, diabetic eye, vein occlusion, uveitis, cornea, dry eye, cataract, macular
  surface, inherited retinal, optic nerve) that shape prompts only: they reorder the symptom list
  and offer relevant metrics and checks, never shorten anything, and never appear as a diagnosis —
  asserted by a test and by a new guard rule that fails the build on a blurb reading "you have".
  Metrics are unit- and method-aware: an IOP carries how it was taken, acuity converts exactly
  between Snellen 6m/20ft, logMAR and decimal (verified against the reference values), and the
  non-numeric acuities (CF, HM, LP, NLP) are ordered categories that are never turned into numbers.
  CCT is stored but never applied as an IOP correction — that is a clinical judgement.
  Home self-checks: Amsler with a drawable overlay reusing the existing drawing engine and its
  text descriptions, a card-calibrated tumbling-E vision check, and a contrast check. Test
  conditions (distance, correction, screen brightness, room lighting) are mandatory — a result
  cannot be saved without them, because a result without them is not comparable with anything,
  which is the only thing these are for. Two attempts taken differently are reported as not
  comparable rather than plotted together.
  Treatment cycles: an injection series now reads "3rd injection, 6-week interval, most recent
  12 Aug" in the brief rather than a bare start date; tapers are described as tapers.
  **All new clinical copy is unreviewed and listed in `docs/clinical-copy-review.md`** — boundary
  statements, check instructions, profile descriptions and measurement methods — with the specific
  questions a reviewer should answer. Per AGENTS.md §5 an agent must not approve it; this is the
  gate on releasing the phase.
- **2026-09-08** — **Phase 04 done.** `Today` is now a decision before it is a form: two large
  targets ("Nothing different today" / "Something changed"), with the form appearing only after the
  second. Quick entries come from `lib/suggestions.ts`, built from the person's own history and
  never from a generic list. `lib/streak.ts` states continuity as one plain sentence and stays
  silent when there is nothing worth saying — no streak, no flame, no guilt; a gap is answered with
  "Gaps are fine". Entries can be dated to yesterday or an earlier day, so writing up last night's
  change this morning no longer moves its onset a day later and corrupts the brief.
  Mobile: sidebar becomes a bottom tab bar with the four primary destinations in the thumb zone and
  the rest behind a "More" sheet, safe-area insets respected, dialogs become bottom sheets, and the
  save row sticks above the tab bar. Drawing gained palm rejection (touches ignored once a stylus is
  in use, and wide contact patches rejected), pinch-vs-stroke discrimination, `touch-action: none`,
  and ⌘Z / ⇧⌘Z.
  Playwright runs on Chromium desktop and WebKit iPhone 13 in CI: the daily loop, backdating,
  persistence across reload, the mobile tab bar and sheet, no sideways scrolling on any page, and
  the offline suite.
  **The Phase 02 offline gap is closed** — and it was a real bug, not just an unverified one. The
  service worker cached on first fetch only, so nothing from the first visit was cached and the
  next load offline failed; assets are now precached by a post-build step that injects the real
  content-hashed filenames. A second bug: cache lookups missed because precached responses carry a
  `Vary` header that did not match the page's own requests, so every asset failed offline while
  appearing to be cached. Both fixed and covered by tests that load the app, cut the network,
  reload, and record an entry. A third E2E test asserts zero third-party requests across every page.
  Also fixed: the "compared with your usual" radios had no accessible group name (now a fieldset
  with a legend), an empty table header in prescriptions, and Today did not show that today was
  already recorded after a reload.
  **Not covered:** offline reload on WebKit — Playwright throws an internal error driving it, so
  that one test is Chromium-only and needs a manual check on a real iOS device before release.
- **2026-09-08** — **Phase 02 done.** `lib/indexes.ts` builds the timeline, per-day grouping,
  per-eye and per-type symptom maps and first-seen dates once per data change, cached on the
  identity of the store's `data` object; search caches its own row index the same way. The store
  now exposes one stable `data` object instead of rebuilding `toAllData` on every render. Timeline
  renders 60 days at a time with an explicit "show earlier" control. Pages other than Today and
  Timeline are lazy-loaded: initial JS is 70 KB gzip against a 120 KB budget, enforced by
  `npm run bundle` in the gate, which also fails if a heavy page creeps back into the entry chunk.
  Thumbnails now generate in a worker (OffscreenCanvas, WebP with a JPEG fallback) and are stored
  as their own compressed file records rather than data URLs on the imaging record.
  Benchmarked against a ten-year record — 20,000 symptoms, 500 drawings, 200 scans: index build
  12ms, cached read 0.02ms, search 22ms cold and 4ms warm, brief 5ms, ask 9ms. Budgets in the test
  are far looser than these, so a reintroduced quadratic scan trips them.
  Two real leaks fixed: the OCT comparison created object URLs and never revoked them, and opening
  a document leaked one per click. `storedFileURL`/`releaseFileURL` now track outstanding URLs and
  warn past a threshold.
  **Unverified: the offline shell.** A service worker and manifest ship and are covered by tests
  for their content, but this environment's embedded browser blocks service-worker registration
  (the script itself fetches fine), so actual offline behaviour has not been confirmed. It needs a
  check in a normal browser: load, go offline, reload, record an entry. Everything else in the
  phase was verified in the production build — all eight routes render with no errors.
- **2026-09-08** — **Phase 03 done.** Type scale tokens with a user setting (100/125/150/200%),
  four themes including two high-contrast ones, and a contrast test that computes WCAG ratios from
  the real tokens and fails the build — it found three genuine failures in the original palette:
  borders at 1.3–1.5:1 (effectively invisible), light-theme muted text at 3.6:1, and an unverifiable
  focus ring. All fixed. Also: skip link and landmarks, 44px targets (the inline `minHeight: 28`
  pattern is gone and a test prevents its return), focus trap and focus restore in `Modal`, polite
  announcements for search results and brief generation, `prefers-reduced-motion` plus explicit
  reduced-motion / glare-comfort / dimmed-imagery preferences stored in the record.
  `lib/describe.ts` turns a drawing into words — a summary and a mark-by-mark description, shown to
  everyone and used as alt text everywhere a drawing appears.
  Defects found and fixed: **at ≤900px every navigation button lost its accessible name**
  (`display:none` on the label, icon `aria-hidden` — nameless to a screen reader); the timeline
  overflowed horizontally by 164px at 200% type; and `WhatISee` crashed outright if a browser
  refused a 2D canvas context.
  Verified in a real browser: zero horizontal overflow on all eight pages at 640px with 200% type
  (equivalent to 1280px at 200% zoom). 267 tests.
  A flaky test turned out to be a real write race, now fixed in two places: `setMeta` fired its
  IndexedDB write from inside a React state updater, so two quick preference changes could reach
  storage out of order; and `loadMigrated` wrote the whole meta record, reverting anything the
  person changed while a migration was running. Writes to meta are now serialised and use a new
  `dbPatch`, which merges inside one transaction instead of overwriting the document.
  **Deliberately not shipped: voice entry.** The browser Speech API sends audio to a third-party
  service in most browsers, which breaks non-negotiable #1. OS dictation works in every field and
  keeps the promise. Recorded in `docs/accessibility.md` along with the other known gaps.
- **2026-09-08** — **Phase 01 done.** Schema versioning with tested migrations (v1→v3) that write a
  pre-migration snapshot into a new `backups` store before touching anything; archive v2 with a
  canonical-JSON SHA-256 checksum, per-store counts and date span; import preview that validates and
  summarises before writing, with replace and merge modes (merge resolves by `updated_at`, newest
  wins); optional AES-GCM encryption with PBKDF2-SHA256 at 250k iterations; backup-age tracking with
  a once-a-week calm nudge; storage estimate with `navigator.storage.persist()` reported honestly;
  a non-destructive "test my backup" validator; and `dbWriteSnapshot` so multi-store writes are one
  transaction. 146 tests.
  **Decision: stored files moved from `Blob` to `ArrayBuffer`** (`StoredFile.bytes`, plus `size` and
  `stored_at`), which is what Phase 00 flagged. Blobs are unevenly supported in IndexedDB and could
  not be asserted at all in tests; bytes round-trip everywhere. The Phase 00 skipped test is now a
  real one, and `saveStoredFile` turns a quota failure into a message instead of a silent loss.
  Verified in a real browser as well as in CI: 72 demo records and 5 files exported, database wiped,
  re-imported — checksum verified and the fundus image byte-identical; encrypted round trip rejects
  the wrong passphrase and leaks no plaintext.
- **2026-09-08** — **Phase 00 done.** Vitest + Testing Library + fake-indexeddb, ESLint 9 flat
  config with jsx-a11y as errors, Prettier, test factories, 96 tests, error boundary with a
  database-level export escape hatch, `npm run verify` gate, GitHub Actions CI. Upgraded Vite 5→7
  and Vitest 2→3 to clear 5 advisories (1 critical) in the dev toolchain.
  Three defects found by the new tests, all fixed:
  (1) `parseQuery` kept the eye word as a required search term, so "glare left eye" silently
  excluded both-eye records — the eye-leak class the record-integrity reviewer warns about;
  (2) timeline rows showed eye and demo badges but not provenance, in the one view where
  patient-reported and clinician-documented entries sit side by side (non-negotiable #2);
  (3) the ESLint a11y config promoted rules the plugin sets to "off", including the deprecated
  `label-has-for`, producing 71 false positives against our own `Field` label component.
  Export logic moved out of `Settings` into `lib/archive.ts` so it works when the UI has crashed —
  Phase 01 extends that envelope.
  **Known gap:** `fake-indexeddb` drops jsdom Blobs in its structured clone, so the bytes of
  uploaded scans and documents cannot be asserted in this environment. Recorded as a skipped test.
  Phase 01 should decide whether stored files move to `ArrayBuffer`; Phase 04's Playwright suite
  covers it otherwise. This is the highest-value untested path in the app.
- **2026-09-08** — Phase 06 revised to a hybrid render pipeline. Blender owns the base anatomy
  mesh, the baked detail maps and Phase 07's procedure animations; the engine keeps everything
  continuous (iris colour, pupil, vessels, fundus, every severity parameter) because baking a
  parameter kills the severity slider. All assets ship locally with no runtime fetch: hosted build
  ≤ 12 MB lazy-loaded behind the Visualize chunk, standalone single file ≤ 5 MB (raised from 3 MB)
  and must render with the network blocked. Assets are committed with a licence manifest and a hash
  drift check, so a clone without Blender still builds — Blender is needed only to regenerate.
- **2026-09-08** — Agent control established: `AGENTS.md`, `CLAUDE.md`, invariant guard
  (`npm run guard`), `/phase` `/gate` `/new-record-type` commands, three reviewer subagents,
  phase ledger. Guard found and fixed a real provenance gap: `FloaterObject` had no `source_type`
  (now `patient_reported`, backfilled on read pending the Phase 01 migration system).
- **2026-09-08** — Build plan written: `docs/plan/`, eleven phases.
