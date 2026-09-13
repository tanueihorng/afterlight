# Defect register — the independent verification pass

Every finding from the verification pass (`VERIFICATION.md`), recorded honestly. Nothing is
hidden because it is embarrassing, and nothing is called fixed without a test that would fail
if it came back.

Statuses: **open** · **fixed** (test named) · **flagged** (needs a human or a product decision;
agent must not change it) · **recorded** (unexpected but correct-or-tolerable, documented).

Severity: **high** (loses or misrepresents data, breaks a non-negotiable) · **medium** (a
person-visible flow is wrong or dead) · **low** (cosmetic or unreachable).

---

## Fixed

### V-003 — The search/ask palette was unusable by mouse
- **Found** 2026-09-14 (palettes spec; isolated by an elementFromPoint probe)
- **Severity** high (one of the app's primary surfaces; worked only by keyboard)
- **Symptom** The palette rendered correctly, accepted typed input, and closed on Escape — but
  every mouse click on its tabs, results, example chips, or Ask button was swallowed by the
  fixed `backdrop-dismiss` layer behind it. Clicking the palette anywhere simply closed it.
  `.modal` carries `position: relative; z-index: 1` with a comment warning about exactly this
  failure ("the dialog looks fine and simply does not respond"); `.sheet` has the same guard.
  `.palette` was missed.
- **Repro** Open Ask my records → click any example question. The palette closed without
  running the question.
- **Fix** `.palette` now carries the same `position: relative; z-index: 1` (app/src/styles.css).
- **Test** e2e/verify/palettes.spec.ts — chip click runs the question; search result click
  navigates. (Every existing suite passed before this: keyboard tests do not click, and unit
  tests do not hit-test — this defect is the reason the sweep exists.)

### V-004 — The e2e regression suite was silently broken by the story view
- **Found** 2026-09-14 (verification run of the existing suite against current HEAD)
- **Severity** high (the safety net had a hole nobody knew about)
- **Symptom** `e2e/daily-loop.spec.ts` "records a change, and it reaches the timeline" fails on
  current HEAD: the story view (added post-phase-16, commit a9420be) hides symptom events from
  the default clinical-spine lens, and the test had never been re-run after that change. The
  recorded `.last-run.json` said "passed" — from an older build.
- **Fix** The test now verifies the symptom on the Everything view (and still asserts the
  provenance wording). The full suite must be re-run at the end of any change that touches what
  pages show; `npm run verify` alone does not catch this.
- **Related (flagged, see below)** whether a just-recorded symptom being invisible on the
  default timeline view is the right design is a product question — V-105.

### V-001 — Timeline chooser: "Drawing of what you see" routes to a nonexistent page
- **Found** 2026-09-14 (e2e/verify/timeline-add.spec.ts, first run)
- **Severity** medium
- **Symptom** Choosing "Drawing of what you see" in the "+ Add event" chooser set
  `location.hash = "drawing"`, producing `#/drawing` — a route that does not exist. The router
  silently fell back to Today with the stale hash left in the address bar. The button did
  nothing a person could call "opening the drawing page".
- **Repro** Timeline → + Add event → Drawing of what you see. URL became `#/drawing`; the app
  showed Today.
- **Fix** The chooser entry now targets `#/what-i-see` (app/src/pages/TimelinePage.tsx).
- **Test** e2e/verify/timeline-add.spec.ts — "drawing of what you see opens the drawing page".

### V-002 — DiagnosisModal defaulted "Confirmed by a clinician" to checked
- **Found** 2026-09-14 (probe during the defect investigation)
- **Severity** high (misrepresents provenance; non-negotiable 2)
- **Symptom** A person typing their own diagnosis into My Eyes or the Timeline chooser got a
  pre-checked "Confirmed by a clinician" box. The saved record claimed clinician confirmation
  nobody had given — in the record, the brief's provenance split, and any export.
- **Fix** The checkbox now defaults unchecked (app/src/pages/MyEyes.tsx). A person who
  transcribes from a clinic letter ticks it deliberately.
- **Test** src/pages/my-eyes-modals.test.tsx — checkbox default; e2e flow coverage in
  e2e/verify/my-eyes.spec.ts.

### V-005 — Entries written between midnight and the UTC offset were dated the previous day
- **Found** 2026-09-14 (today spec: removing a saved symptom row left the record in place)
- **Severity** high (misdates a medical record; silently breaks edit and delete for early-morning entries)
- **Symptom** `nowISO()` stores UTC timestamps, but day extraction (`isoToDateOnly`, and about
  thirty raw `.slice(0, 10)` call sites) read the UTC day. On this machine (UTC+8) a symptom
  recorded at 03:02 local was dated 13 Sep — while the same row rendered the time as 3:02, so
  the date and the time on one event row contradicted each other. Worse: `symptomsOnDate`
  matched entries against `todayLocal()`, so anything recorded before 08:00 was invisible to
  Today's edit/delete path — a saved row could not be removed, because the record that matched
  it had "shifted" to yesterday.
- **Fix** `isoToDateOnly` now derives the local calendar day for full timestamps (date-only
  strings pass through), and every raw slice site — search, ask, brief windows, backup ageing,
  archive summaries, drawings, appointments, the brief PDF — goes through it. Stored
  representations are unchanged; only the day-reading was wrong.
- **Tests** src/lib/iso-day.test.ts (timezone-pinned: a 03:02 local entry is today's, date and
  time agree); the removed-row e2e in e2e/verify/today.spec.ts, which failed before the fix and
  passes after. The brief window now compares date-only strings on both sides — building an
  end-of-day UTC timestamp would itself have shifted the boundary across timezones.

## Flagged (needs a human or a product decision; agent must not change)

### V-105 — A just-recorded symptom is invisible on the timeline's default view
- **Found** 2026-09-14 (today spec / V-004 investigation)
- **Severity** medium (a frightened person records a change, opens the Timeline, and reads
  "No clinical events in this view")
- **Symptom** The story view (the default) shows only the "clinical spine" — diagnosis,
  surgery, imaging, appointments. Symptoms, drawings and daily logs are "observation" weight
  and hidden until the lens is switched to "With my notes" or the view to "Everything". The
  empty state does say to switch, and the design is documented as deliberate (the story view's
  own header comment). But Today's "View timeline →" lands the person on the view that omits
  what they just saved.
- **Why flagged** Changing the default lens, or landing on "With my notes" after a save, is a
  product decision about the timeline's reading experience, not a mechanical fix.
- **Recommendation** After a Today save, land the timeline with the lens that includes
  observations (or switch the lens automatically the way the chooser widens the range).

## Recorded (unexpected but judged correct-or-tolerable)

### V-101 — Timeline shows an empty list after reload until the range is widened
- **Found** 2026-09-14 (probe; also the original misdiagnosis seed for the "inline add never
  lands" defect)
- **Symptom** A record dated years ago does not appear after a reload because the default
  range is 30 days. The chooser widens the range to All time exactly so a just-saved event is
  on screen, but a later reload returns to 30 days.
- **Judgement** This is a range filter doing its job, not a lost write: the record is present
  in IndexedDB and appears with "All time". Not changed; documented so it is never mistaken
  for data loss again.

### V-102 — The recorded "Timeline inline add never lands" defect did not reproduce
- **Found** 2026-09-14 (docs/plan/PHASE-16-HANDOFF.md §Open defect, recorded 2026-09-14)
- **Symptom** The handoff reported the Procedure/Diagnosis/Medication modals saving without the
  record ever landing (absent even after reload). Verification shows all three save, persist
  with well-formed records, appear immediately, and survive reload — on both browser projects.
- **Judgement** Stale defect report; the immediate-visibility symptom was fixed by the chooser's
  `setRange("all")` and the "absent after reload" observation was V-101. Resolution appended to
  the handoff. Regression guards: src/lib/store.ops.test.tsx (ops put/del → timeline → IndexedDB)
  and e2e/verify/timeline-add.spec.ts (all seven kinds).

## To verify (candidates from the code inventory; each gets a verdict)

- `#/my-eyes?add=…` deep link reads a parameter nothing ever sends (unreachable?)
- `EyeSelect` component exported, never used
- Visualize tab type member `"conditions"` never rendered
- MeasurementModal has `note` state with no input (measurements cannot carry a note)
- DisplaySettings shows "Light" twice (two buttons, one theme)
- Prescription acuity values are saved but never displayed anywhere
- Timeline category filter row hidden in Story view — no effect possible there
- ConfirmButton 2.6s re-arm: double-click timing and label reset
