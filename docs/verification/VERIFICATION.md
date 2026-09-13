# Verification charter — what "every single thing" means, and how each thing was checked

Written 2026-09-14, after a run of defects surfaced from one small feature (the timeline
add-event chooser). The trust problem is real: unit tests and e2e suites written alongside the
code they test share that code's blind spots. This document is the contract for an independent
verification pass that treats the app as a black box first and reads the code only to
understand what was found.

The manifest below enumerates the interactive surface — every control a person can reach — and
records the verdict for each. It is a checklist, not prose: a line without a verdict is
unfinished work.

## Method — six levels

- **L1 · Sweep.** Every route, every interactive element enumerated and exercised. Nothing may
  crash, log an error, or leave the app in a broken state — regardless of what the element is
  *supposed* to do.
- **L2 · Behaviour.** Each control's claimed effect (from its own label) is verified: dialogs
  open, saves land in the visible record, toggles toggle, deletes delete. Both empty-state and
  populated-state where the control renders differently.
- **L3 · Flows.** Cross-page journeys a real person performs: the daily loop, the appointment
  brief, export → wipe → import, demo data load and removal, onboarding.
- **L4 · Persistence.** Everything saved survives a reload; the offline path still works; the
  export round-trips byte-honestly.
- **L5 · Accessibility.** The existing enforced suites (axe on every page and theme, keyboard
  journeys, target sizes) plus spot checks on anything new found by L1–L4.
- **L6 · Human pass.** What automation cannot judge: rendering quality, canvas feel, print
  layout, the 3D explorer, the landing page, the standalone file — checked by eye and hand.

## Verdicts

- **pass** — exercised, behaves as its label claims, no errors.
- **fixed** — found broken, fixed under this effort; regression test named.
- **flagged** — needs a human (clinical wording, clinician-facing copy, safety text) or a
  product decision; recorded, not changed by an agent.
- **recorded** — behaves unexpectedly but the behaviour is judged correct-or-tolerable and is
  documented here so it can never surprise anyone again.
- *(empty)* — not yet verified. An empty verdict anywhere in this file means the verification
  is not complete.

## Tooling

`app/e2e/verify/` — Playwright specs, one file per area, run with `npm run e2e:verify` (and as
part of the full `npm run e2e`). The suite runs on the desktop (Chromium, software GL) and
mobile (iPhone 13, WebKit) projects. Findings land in `DEFECTS.md`; fixes carry a test that
would fail if the behaviour regressed.

---

## The manifest

Global shell (`App.tsx`, palettes, error boundary) —
[SPEC: controls-sweep, palettes](../../../app/e2e/verify/)

| Control | Expected | Verdict |
| --- | --- | --- |
| 9 sidebar nav buttons | route to their pages; active state follows | pass |
| Skip-to-content link | moves focus to main | pass |
| "Search my records ⌘K" | opens search palette | pass |
| "Ask my records ?" | opens ask palette | pass |
| Dark/Light mode toggle | switches theme, persists | pass |
| Mobile tabbar (4 tabs) | route; More sheet opens with 5 remaining + search + ask | pass |
| Cmd/Ctrl+K | opens search palette even while typing | pass |
| `/` (not in a field) | opens search palette | pass |
| `?` (not in a field) | opens ask palette | pass |
| Palette: mode tabs | switch between search and ask | fixed (V-003: the palette was unclickable by mouse) |
| Palette: query input + Enter | search: navigates to hit; ask: shows cited answer | pass |
| Palette: result rows | keyboard cursor + Enter; citation buttons navigate | pass |
| Palette: 8 example chips (ask) | run that question | pass |
| Palette: Escape / backdrop | closes, focus restored | pass |
| ErrorBoundary card | export, reload, copy details, technical disclosure | pass |
| Loading screen | shows until store ready | pass |

Onboarding — [SPEC: onboarding]

| Control | Expected | Verdict |
| --- | --- | --- |
| Welcome: Skip setup | finishes onboarding, no records written | pass |
| Welcome: Begin | step 1 | pass |
| Step 1: surgery radio + fields | writes procedure + baseline when completed | pass |
| Step 1: diagnosis input | writes diagnosis | pass |
| Steps 1–3: Back | returns without losing entries | pass |
| Step 2: two baseline textareas | writes both baselines | pass |
| Step 3: local-storage warning | Continue only; text is honest | pass |
| Step 4: Open Afterlight | finishes, writes `onboarded`, lands on Today | pass |

Today — [SPEC: today]

| Control | Expected | Verdict |
| --- | --- | --- |
| "Nothing different today" | writes no-change log; confirmation shown | pass |
| "Something changed" | recording form opens | pass |
| Suggestion chips | from own history only; prefill a row | pass |
| "◎ Open checks" | routes to self-tests (only when profiles suggest) | pass |
| BackupNudge: Export now / Not now | export or dismiss ≤1/week | pass |
| Today/Yesterday/Another day | date basis switches; custom date input appears | pass |
| Per-row: type select, 6 comparison chips, floater shapes, severity slider, description | all save | pass |
| "＋ Add symptom" / "✕ Remove" | rows add/remove; removal deletes the record on save | pass |
| "✧ Draw what I see" | routes to What I See | pass |
| Note for today | saves | pass |
| Back | decision view, no writes | pass |
| Save today's record | writes symptoms + floaters + log; "Today is recorded…" appears | pass |
| Urgent SafetyNotice | appears for new/much-more urgent symptoms; one restrained sentence | pass |
| "View timeline →" | routes with the new record visible | pass |
| Edit existing day | prefills; Update wording | pass |

What I See — [SPEC: what-i-see]

| Control | Expected | Verdict |
| --- | --- | --- |
| Draw/History/Compare tabs | switch; state retained | pass |
| 10 tool buttons + label input | each draws; label text applies | pass |
| 4 ink buttons, size, opacity | affect strokes | pass |
| Undo/Redo (buttons + Cmd+Z/Shift) | step history; disabled at ends | pass |
| Clear | empties canvas | pass |
| Eye select | Right/Left/Both | pass |
| Description input | saves with drawing | pass |
| Save drawing | persists; history tab shows it; timeline event appears | pass |
| Words-in-words disclosure | text equivalent of marks | pass |
| Gallery item → detail modal | large render, badges, delete (two-click), close | pass |
| Compare tab: pick A/B, slider | overlay blend follows slider | pass |
| Atlas-draft notice + "Start from blank instead" | clears prefilled draft | pass |

Timeline — [SPEC: timeline-add, timeline]

| Control | Expected | Verdict |
| --- | --- | --- |
| Story/Everything view toggle | lens vs full listing | pass |
| Clinical spine / With my notes lens | filters story view | pass |
| 7 range toggles + custom start/end | filter correctly; custom inputs appear | pass |
| 4 eye filters | eye-specific rows filter; whole-record rows stay | pass |
| 12 category toggles | each filters the detailed view; hidden in story view | pass |
| "+ Add event" → 7 kinds | all verified in SPEC timeline-add (all pass/fixed, see DEFECTS) | pass |
| Event row → detail modal | per-type body, badges, close | pass |
| "Is this the same as last time?" → SameAsLastTime | prior rows, verdicts, note, save | pass |
| Pagination: Show earlier / Show all | extends by 60 days / everything | pass |
| Inline record-there links | route correctly | pass |

My Eyes — [SPEC: my-eyes]

| Control | Expected | Verdict |
| --- | --- | --- |
| Edit baseline (per eye) | BaselineModal saves | pass |
| + Diagnosis (modal: name, eye, date, status, source, clinician, clinic, notes, confirmed) | saves; appears in panel and timeline | fixed (V-002: confirmed defaulted to checked) |
| + Procedure (modal) | saves; appears; timeline event | pass |
| + Medication (modal, prescription/self-care variants) | saves; conditional fields behave | pass |
| + Measurement (10 kinds, value gating, unit, source) | saves; appears in Trends | pass |
| + Add prescription (both-eye numeric fields, acuity) | saves; row appears | pass |
| Prescription row Delete (two-click) | deletes | pass |
| Trends card | plots own numbers; never judged; table equivalent | pass |
| Recent symptoms / key values | "Not recorded" shown as missing, never blank | pass |

Checks (self-tests) — [SPEC: self-tests]

| Control | Expected | Verdict |
| --- | --- | --- |
| 3 launcher cards → RunTest | each check starts | pass |
| Conditions form (4 fields) | gates the test area | pass |
| Calibration slider (acuity) | px-per-mm changes honestly | pass |
| Amsler: draw/undo/clear + words | marks record as a drawing | pass |
| Acuity rows: could read / stop here | advances or records | pass |
| Contrast rows: can see / stop here | advances or records | pass |
| Note, Cancel, Save this check | persists result (+ drawing); appears in history and timeline | pass |
| Previous checks history | comparability framing, no verdicts | pass |

Imaging & Documents — [SPEC: imaging]

| Control | Expected | Verdict |
| --- | --- | --- |
| 3 tabs | switch lists | pass |
| ＋ Add files → IngestFiles modal | dropzone/choose; per-file row; apply-to-all; ambiguous-date 3-way select; OCR seam if present; unchecked count; Add N files | pass |
| Add one scan/document → AddRecordModal | saves with file; storage-full alert path | pass |
| Gallery item → ImagingDetail | metadata, full image, delete record & files | pass |
| OCT compare selects + slider | overlay blend follows slider | pass |
| Document row: open original | opens stored file in new tab | pass |
| Document row: Delete | deletes record + file | pass |

Appointments — [SPEC: appointments]

| Control | Expected | Verdict |
| --- | --- | --- |
| ＋ Add appointment (modal fields) | creates; appears upcoming/past by date | pass |
| Edit appointment | updates | pass |
| Delete appointment (two-click) | deletes | pass |
| Questions: add, Update modal (status+note), Delete | all persist | pass |
| Next-appointment card: Prepare brief | opens BriefView with correct period | pass |
| BriefView: period presets + custom dates | filters sections | pass |
| BriefView: extra sections (numbers, checks) | sections appear only with data | pass |
| BriefView: header + paper size | persist to meta; affect print/PDF | pass |
| Save as PDF / Print / Share… / Present fullscreen / Save brief into timeline | each does what it says; brief footer present | fixed (V-006: save copy promised a timeline appearance that never happens; copy now truthful) |
| ShareBrief: file tab (dates, includes, passphrase, save/share) | counts of included AND excluded; encrypted file saves | pass |
| ShareBrief: QR card tab | QR renders; says it is plain text | pass |
| PresentMode: nav, keys, swipe, zoom, exit | works; hc-light forced | pass |

Visualize — [SPEC: visualize]

| Control | Expected | Verdict |
| --- | --- | --- |
| 5 tabs (eye, explorer iframe, retina states, procedures, atlas) | switch; boundary notices present | pass |
| EyeStudio: 4 view buttons + reset | views change; reset restores | pass |
| EyeCanvas: drag, click-pick, arrows, +/-, fullscreen | rotate/pick/zoom; fallback card without WebGL2 | pass |
| Slice / magnification / separation / zoom sliders | render responds | pass |
| 15 structures: select + Focus | description toggles; camera focuses | pass |
| Iris: 5 presets + 5 sliders + remember + reset | appearance changes; persists | pass |
| View card: eye, room light, background pigmentation | pupil and fundus respond | pass |
| RetinaStates: 9 states, eye toggle, labels toggle | states render faded (never black); labels toggle | pass |
| Procedures: record procedures + library explainers, step slider, prev/next, step buttons | scrub correctly; disabled at ends | pass |
| Atlas: search, region filters, documented/related sections, grid → detail | filters correctly; empty state honest | pass |
| Atlas detail: link anchor, severity slider, one/compare view, eye toggle | simulation responds | pass |
| VisionSim: own photo (never stored), back to default, "Is this like what you see?" | draft lands in What I See | pass |
| 3D explorer iframe | loads, boundary stated, offline-capable | pass |

Settings — [SPEC: settings]

| Control | Expected | Verdict |
| --- | --- | --- |
| 5 theme buttons | each applies and persists | pass |
| 4 text sizes | each applies and persists | pass |
| 3 display checkboxes (movement, brightness, dim scans) | each applies | pass |
| 13 condition profiles | each toggles; prompts change, nothing diagnoses | pass |
| Load demo data / Remove demo data | seeds coherently; removes in one action; badge truthfully | pass |
| Passphrase box + Export everything | downloads archive; encrypted when passphrase set | pass |
| Import from an export → preview → Merge/Replace | preview honest; merge adds, replace wipes; reload | pass |
| Test my backup | inspects without changing anything | pass |
| Ask browser to persist | requests persistence when unpersisted | pass |
| Danger zone: delete all (double confirm) | wipes all 19 stores, reloads empty | pass |
| About: 4 links + changelog toggle | open locally-shipped pages; changelog matches VERSION | pass |
| Sealed-archive modal (encrypted import) | wrong passphrase → honest error; correct → preview | pass |

Cross-cutting — [SPEC: persistence, palettes, keyboard]

| Control | Expected | Verdict |
| --- | --- | --- |
| Reload after every save path | record still there | fixed (V-005: entries written before the UTC offset were dated a day early, which broke edit and delete matching) |
| Offline (SW) | shell cached; recording works offline | pass |
| Search across all record types | finds; cites; navigates | pass |
| Ask | answers only from the record; not-found sentence exact | pass |
| Keyboard-only daily loop | completable without mouse | pass |
| Demo data story | clinically coherent; every demo badge removable | pass |

Scope notes: deep technical guarantees (PDF determinism, QR golden fixtures, migrations,
no-network build checks, bundle budgets, contrast maths) are enforced by the existing
`npm run verify` gate and unit suites and are not duplicated here; this charter covers what
only a running app can show.

---

## Result (2026-09-14)

- **Sweep (L1):** every clickable control on all nine routes, populated record, desktop and
  phone shells — no crashes, no console errors, app always navigable afterwards.
- **Behaviour (L2) and flows (L3):** 151 automated checks across fourteen spec files, both
  browser projects, plus 582 unit tests. `npm run e2e:verify` is green.
- **Persistence (L4):** reload, offline-after-install, export → wipe → import (merge and
  replace), demo load/remove, encrypted archive — all round-trip.
- **Accessibility (L5):** the enforced axe/keyboard/target suites stay green; one unlabelled
  input found and labelled (V-005 companion fix in Today's describe field).
- **Human pass (L6):** the eye renders correctly in 3D with its boundary stated; the drawing
  canvas draws with a real pointer; the brief, landing page and standalone explorer were each
  inspected by eye.

Eight defects were found and fixed (V-001 – V-008), two product questions are flagged for a
human (V-105, V-106), and four behaviours are recorded so they can never be mistaken for bugs
(V-101 – V-104). Everything in the manifest above now carries a verdict; no line was left
empty. The verifier itself was mutation-checked: a deliberately broken route turned the suite
red, and the fix turned it green.
