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
| 9 sidebar nav buttons | route to their pages; active state follows | |
| Skip-to-content link | moves focus to main | |
| "Search my records ⌘K" | opens search palette | |
| "Ask my records ?" | opens ask palette | |
| Dark/Light mode toggle | switches theme, persists | |
| Mobile tabbar (4 tabs) | route; More sheet opens with 5 remaining + search + ask | |
| Cmd/Ctrl+K | opens search palette even while typing | |
| `/` (not in a field) | opens search palette | |
| `?` (not in a field) | opens ask palette | |
| Palette: mode tabs | switch between search and ask | |
| Palette: query input + Enter | search: navigates to hit; ask: shows cited answer | |
| Palette: result rows | keyboard cursor + Enter; citation buttons navigate | |
| Palette: 8 example chips (ask) | run that question | |
| Palette: Escape / backdrop | closes, focus restored | |
| ErrorBoundary card | export, reload, copy details, technical disclosure | |
| Loading screen | shows until store ready | |

Onboarding — [SPEC: onboarding]

| Control | Expected | Verdict |
| --- | --- | --- |
| Welcome: Skip setup | finishes onboarding, no records written | |
| Welcome: Begin | step 1 | |
| Step 1: surgery radio + fields | writes procedure + baseline when completed | |
| Step 1: diagnosis input | writes diagnosis | |
| Steps 1–3: Back | returns without losing entries | |
| Step 2: two baseline textareas | writes both baselines | |
| Step 3: local-storage warning | Continue only; text is honest | |
| Step 4: Open Afterlight | finishes, writes `onboarded`, lands on Today | |

Today — [SPEC: today]

| Control | Expected | Verdict |
| --- | --- | --- |
| "Nothing different today" | writes no-change log; confirmation shown | |
| "Something changed" | recording form opens | |
| Suggestion chips | from own history only; prefill a row | |
| "◎ Open checks" | routes to self-tests (only when profiles suggest) | |
| BackupNudge: Export now / Not now | export or dismiss ≤1/week | |
| Today/Yesterday/Another day | date basis switches; custom date input appears | |
| Per-row: type select, 6 comparison chips, floater shapes, severity slider, description | all save | |
| "＋ Add symptom" / "✕ Remove" | rows add/remove; removal deletes the record on save | |
| "✧ Draw what I see" | routes to What I See | |
| Note for today | saves | |
| Back | decision view, no writes | |
| Save today's record | writes symptoms + floaters + log; "Today is recorded…" appears | |
| Urgent SafetyNotice | appears for new/much-more urgent symptoms; one restrained sentence | |
| "View timeline →" | routes with the new record visible | |
| Edit existing day | prefills; Update wording | |

What I See — [SPEC: what-i-see]

| Control | Expected | Verdict |
| --- | --- | --- |
| Draw/History/Compare tabs | switch; state retained | |
| 10 tool buttons + label input | each draws; label text applies | |
| 4 ink buttons, size, opacity | affect strokes | |
| Undo/Redo (buttons + Cmd+Z/Shift) | step history; disabled at ends | |
| Clear | empties canvas | |
| Eye select | Right/Left/Both | |
| Description input | saves with drawing | |
| Save drawing | persists; history tab shows it; timeline event appears | |
| Words-in-words disclosure | text equivalent of marks | |
| Gallery item → detail modal | large render, badges, delete (two-click), close | |
| Compare tab: pick A/B, slider | overlay blend follows slider | |
| Atlas-draft notice + "Start from blank instead" | clears prefilled draft | |

Timeline — [SPEC: timeline-add, timeline]

| Control | Expected | Verdict |
| --- | --- | --- |
| Story/Everything view toggle | lens vs full listing | |
| Clinical spine / With my notes lens | filters story view | |
| 7 range toggles + custom start/end | filter correctly; custom inputs appear | |
| 4 eye filters | eye-specific rows filter; whole-record rows stay | |
| 12 category toggles | each filters the detailed view; hidden in story view | |
| "+ Add event" → 7 kinds | all verified in SPEC timeline-add (all pass/fixed, see DEFECTS) | |
| Event row → detail modal | per-type body, badges, close | |
| "Is this the same as last time?" → SameAsLastTime | prior rows, verdicts, note, save | |
| Pagination: Show earlier / Show all | extends by 60 days / everything | |
| Inline record-there links | route correctly | |

My Eyes — [SPEC: my-eyes]

| Control | Expected | Verdict |
| --- | --- | --- |
| Edit baseline (per eye) | BaselineModal saves | |
| + Diagnosis (modal: name, eye, date, status, source, clinician, clinic, notes, confirmed) | saves; appears in panel and timeline | |
| + Procedure (modal) | saves; appears; timeline event | |
| + Medication (modal, prescription/self-care variants) | saves; conditional fields behave | |
| + Measurement (10 kinds, value gating, unit, source) | saves; appears in Trends | |
| + Add prescription (both-eye numeric fields, acuity) | saves; row appears | |
| Prescription row Delete (two-click) | deletes | |
| Trends card | plots own numbers; never judged; table equivalent | |
| Recent symptoms / key values | "Not recorded" shown as missing, never blank | |

Checks (self-tests) — [SPEC: self-tests]

| Control | Expected | Verdict |
| --- | --- | --- |
| 3 launcher cards → RunTest | each check starts | |
| Conditions form (4 fields) | gates the test area | |
| Calibration slider (acuity) | px-per-mm changes honestly | |
| Amsler: draw/undo/clear + words | marks record as a drawing | |
| Acuity rows: could read / stop here | advances or records | |
| Contrast rows: can see / stop here | advances or records | |
| Note, Cancel, Save this check | persists result (+ drawing); appears in history and timeline | |
| Previous checks history | comparability framing, no verdicts | |

Imaging & Documents — [SPEC: imaging]

| Control | Expected | Verdict |
| --- | --- | --- |
| 3 tabs | switch lists | |
| ＋ Add files → IngestFiles modal | dropzone/choose; per-file row; apply-to-all; ambiguous-date 3-way select; OCR seam if present; unchecked count; Add N files | |
| Add one scan/document → AddRecordModal | saves with file; storage-full alert path | |
| Gallery item → ImagingDetail | metadata, full image, delete record & files | |
| OCT compare selects + slider | overlay blend follows slider | |
| Document row: open original | opens stored file in new tab | |
| Document row: Delete | deletes record + file | |

Appointments — [SPEC: appointments]

| Control | Expected | Verdict |
| --- | --- | --- |
| ＋ Add appointment (modal fields) | creates; appears upcoming/past by date | |
| Edit appointment | updates | |
| Delete appointment (two-click) | deletes | |
| Questions: add, Update modal (status+note), Delete | all persist | |
| Next-appointment card: Prepare brief | opens BriefView with correct period | |
| BriefView: period presets + custom dates | filters sections | |
| BriefView: extra sections (numbers, checks) | sections appear only with data | |
| BriefView: header + paper size | persist to meta; affect print/PDF | |
| Save as PDF / Print / Share… / Present fullscreen / Save brief into timeline | each does what it says; brief footer present | |
| ShareBrief: file tab (dates, includes, passphrase, save/share) | counts of included AND excluded; encrypted file saves | |
| ShareBrief: QR card tab | QR renders; says it is plain text | |
| PresentMode: nav, keys, swipe, zoom, exit | works; hc-light forced | |

Visualize — [SPEC: visualize]

| Control | Expected | Verdict |
| --- | --- | --- |
| 5 tabs (eye, explorer iframe, retina states, procedures, atlas) | switch; boundary notices present | |
| EyeStudio: 4 view buttons + reset | views change; reset restores | |
| EyeCanvas: drag, click-pick, arrows, +/-, fullscreen | rotate/pick/zoom; fallback card without WebGL2 | |
| Slice / magnification / separation / zoom sliders | render responds | |
| 15 structures: select + Focus | description toggles; camera focuses | |
| Iris: 5 presets + 5 sliders + remember + reset | appearance changes; persists | |
| View card: eye, room light, background pigmentation | pupil and fundus respond | |
| RetinaStates: 9 states, eye toggle, labels toggle | states render faded (never black); labels toggle | |
| Procedures: record procedures + library explainers, step slider, prev/next, step buttons | scrub correctly; disabled at ends | |
| Atlas: search, region filters, documented/related sections, grid → detail | filters correctly; empty state honest | |
| Atlas detail: link anchor, severity slider, one/compare view, eye toggle | simulation responds | |
| VisionSim: own photo (never stored), back to default, "Is this like what you see?" | draft lands in What I See | |
| 3D explorer iframe | loads, boundary stated, offline-capable | |

Settings — [SPEC: settings]

| Control | Expected | Verdict |
| --- | --- | --- |
| 5 theme buttons | each applies and persists | |
| 4 text sizes | each applies and persists | |
| 3 display checkboxes (movement, brightness, dim scans) | each applies | |
| 13 condition profiles | each toggles; prompts change, nothing diagnoses | |
| Load demo data / Remove demo data | seeds coherently; removes in one action; badge truthfully | |
| Passphrase box + Export everything | downloads archive; encrypted when passphrase set | |
| Import from an export → preview → Merge/Replace | preview honest; merge adds, replace wipes; reload | |
| Test my backup | inspects without changing anything | |
| Ask browser to persist | requests persistence when unpersisted | |
| Danger zone: delete all (double confirm) | wipes all 19 stores, reloads empty | |
| About: 4 links + changelog toggle | open locally-shipped pages; changelog matches VERSION | |
| Sealed-archive modal (encrypted import) | wrong passphrase → honest error; correct → preview | |

Cross-cutting — [SPEC: persistence, palettes, keyboard]

| Control | Expected | Verdict |
| --- | --- | --- |
| Reload after every save path | record still there | |
| Offline (SW) | shell cached; recording works offline | |
| Search across all record types | finds; cites; navigates | |
| Ask | answers only from the record; not-found sentence exact | |
| Keyboard-only daily loop | completable without mouse | |
| Demo data story | clinically coherent; every demo badge removable | |

Scope notes: deep technical guarantees (PDF determinism, QR golden fixtures, migrations,
no-network build checks, bundle budgets, contrast maths) are enforced by the existing
`npm run verify` gate and unit suites and are not duplicated here; this charter covers what
only a running app can show.