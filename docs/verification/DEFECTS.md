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

### V-015 — Record rows disappeared before their database write committed
- **Found** 2026-09-23 while checking appointment deletion across a reload.
- **Severity** high (a record looked deleted, then returned after reload because the page reloaded
  before the IndexedDB transaction finished).
- **Repro** Add an appointment, reload, edit it, reload, delete it, then reload again. The row
  vanished immediately, but the subsequent reload restored it.
- **Cause** Store writes changed React state before waiting for IndexedDB. Some delete controls do
  not await their promise, so the visible removal could trigger a reload while the transaction
  was still pending.
- **Fix** `StoreProvider` now updates its in-memory lists only after `dbPut` or `dbDelete` resolves
  at transaction commit. A failed write leaves the last committed row visible.
- **Regression** `src/lib/store.ops.test.tsx` aborts a delete transaction after request success and
  asserts the row remains visible. The desktop and mobile appointment add/edit/delete/reload journey
  passes in `e2e/verify/appointments.spec.ts`.

### V-105 — Today’s saved observation was hidden by the timeline landing view
- **Found** 2026-09-14; resolved 2026-09-23.
- **Severity** medium (the person could record an observation and then land on a view that omitted it).
- **Fix** Today’s View timeline action now opens a dedicated recorded-entry route that selects
  the all-dates, With my notes view. Ordinary Timeline navigation retains its normal defaults.
- **Regression** `src/pages/timeline-return.test.tsx` seeds an older symptom and confirms it is
  visible on this route; `e2e/daily-loop.spec.ts` follows the post-save action and checks the
  observation view.

### V-013 — Everything view ignored its pagination window
- **Found** 2026-09-17 by measuring rendered groups before any pagination click.
- **Severity** medium (long histories mounted in full; paging control misrepresented the view).
- **Repro** Seed 150 daily logs on distinct dates, choose Everything and All time. Before the
  fix, 150 `.tl-day` groups were rendered while the button said “90 more days”.
- **Fix** The Everything renderer now maps `shownDays`, not all `byDay` groups.
- **Regression** `e2e/verify/timeline.spec.ts` requires 60 groups initially, 120 after Show earlier,
  and 150 after Show all, then no paging button. Before fix: expected 60, received 150. After
  production rebuild: both desktop and mobile pass, one worker, no retries.

### V-014 — Presentation skip disabled all mobile appointment checks
- **Severity** medium (verification coverage hole, not an application defect).
- **Fix** Scoped the mobile skip inside the presentation test rather than the whole describe.
  The newly exposed question-delete test uses separate Delete and Confirm delete clicks;
  synthetic double-click failed on the mobile project.
- **Evidence** Appointments suite: 9 passed, 1 presentation skip, both projects, no retries.
  These assertions remain narrower than several test titles; artifact scope and edit coverage
  are still incomplete.

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
  pages show; `npm run verify` alone does not catch this. *(Correction: this fix was first
  recorded here before it was applied to the spec — found and applied during the final gate.)*
- **Related (fixed above)** V-105 — the Today action now opens the observation-inclusive view.

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

### V-010 — Reload checks raced the commit; meta writes still resolved before it
- **Found** 2026-09-16 (re-run of the verification plan: the onboarding, settings, today and
  persistence reload specs failed on a single worker, not only under load)
- **Severity** medium (the app's settings writes kept a weaker "saved" promise than V-009
  claimed; three reload checks either failed or proved nothing)
- **Symptom** Three layered causes.
  1. `dbPatch` — the path every `setMeta` takes (onboarding finished, theme, text size, comfort
     settings, condition profiles) — still resolved on request success. V-009 fixed `tx()` only.
  2. The screen follows the store the instant a person acts; the commit lands milliseconds
     later. The specs reloaded inside that gap, and Chromium aborts an uncommitted transaction
     on unload. An instrumented probe showed the write always survives when the reload comes a
     few milliseconds later. `/today is recorded/` also matched the optimistic "recorded as no
     change" note, so the Today check reloaded before the save had committed.
  3. The profiles spec checked `getByRole("checkbox").first()` — which is "Reduce movement",
     not a condition profile. It never tested profiles.
- **Fix** `dbPatch` resolves at `transaction.oncomplete` and rejects on abort
  (app/src/lib/db.ts). Specs wait for the commit before reloading: `settingsSaved` in
  e2e/verify/helpers.ts polls the stored meta; Today and persistence wait for the post-commit
  "Today is recorded." confirmation; the profiles spec targets the "What are you tracking?"
  section and checks its not-a-diagnosis sentence.
- **Evidence (2026-09-17)** `src/lib/db-commit.test.ts`: 4 tests pass. Restoring request-success
  resolution makes the aborted-patch test fail (promise resolved instead of rejecting); restoring
  commit-only resolution returns all 4 to passing. A separate 42-test browser run has 41 passes
  and the V-011 offline failure, with one worker and no retries.
- **Limit** Optimistic UI is not a durable-save acknowledgement. These results do not establish
  every UI failure path or exclude rapid user navigation. Historical repeat-run claims are withdrawn.

### V-012 — The store could set state after it unmounted
- **Found** 2026-09-16 (`npm run verify` red: Vitest reported an unhandled
  `ReferenceError: window is not defined` from src/pages/selftests.test.tsx)
- **Severity** low (it failed the gate; in the app only a StrictMode remount reaches it)
- **Symptom** The last self-tests test finished before `loadMigrated()` settled; the provider
  then called `setData` after the test environment was torn down. All 582 tests still passed,
  which is why the gate was the only thing that noticed.
- **Fix** `StoreProvider` ignores a load that settles after unmount (app/src/lib/store.tsx).
- **Test** `npm run verify` — 582 unit tests, no unhandled errors, three consecutive runs.

## Flagged (needs a human or a product decision; agent must not change)

### V-106 — Saved briefs are invisible outside search
- **Found** 2026-09-14 (with V-006)
- **Severity** low (the artefact is safe; discovery is poor)
- **Symptom** A person can build and save an appointment brief, but no page lists saved briefs;
  they surface only if the person searches. Rendering them on the timeline means adding a
  "brief" event type through `buildTimeline`, the category toggles, story weights and
  provenance badges — a product decision, not a mechanical fix.

### V-006 — "Save brief into timeline" promised an appearance the timeline never makes
- **Found** 2026-09-14 (appointments spec)
- **Severity** medium (the copy promised something the app does not do)
- **Symptom** The brief's "Save brief into timeline" button wrote the brief to the briefs store
  and told the person "Saved briefs appear on your timeline and in My Records." — but
  `buildTimeline` never emits brief events, and no page called "My Records" exists. A saved
  brief was reachable only through the search palette, which does index briefs.
- **Fix** The copy now tells the truth: the button reads "Save this brief" and the status line
  says saved briefs turn up in search results as Appointment briefs.
- **Related (flagged, V-106)** whether saved briefs *should* render on the timeline is a
  product decision — it would add a new event type through the timeline's categories, story
  weights and provenance badges.

### V-009 — Write confirmations could resolve before the IndexedDB transaction committed
- **Found** 2026-09-14 (persistence spec: a just-confirmed daily log missing after reload,
  while older stores survived — first read as V-103, then reproduced as partial loss)
- **Severity** high (the app's "saved" promise was slightly stronger than what it waited for)
- **Symptom** `db.ts`'s transaction helper resolved on request success, which IndexedDB fires
  *before* the transaction commits. Every write path in the app awaited that, so a confirmation
  could render, and a modal could close, microseconds before the write was durable. A reload
  or close landing in that window aborts the transaction and silently drops the just-written
  record while older data survives — widening from microseconds to whole seconds under load.
- **Fix** Write transactions now resolve at `transaction.oncomplete` — the actual commit — and
  reject on abort. Every `await store.*.put(...)` in the app is now commit-durable.
- **Tests** the whole suite re-run (582 unit, full e2e); the reload-persistence specs that
  intermittently lost a just-saved entry under load are the regression guard.

### V-008 — The eye viewer's fullscreen button threw on iOS
- **Found** 2026-09-14 (controls sweep, mobile project)
- **Severity** medium (the button crashed instead of toggling on iPhones)
- **Symptom** `EyeCanvas` called `requestFullscreen()` unguarded. iOS Safari exposes no element
  fullscreen, so on the phone the "⛶" button raised `TypeError: requestFullscreen is not a
  function` and did nothing.
- **Fix** The fullscreen control is rendered only when `requestFullscreen` is available, so a
  platform without element fullscreen is not offered a dead control (app/src/components/EyeCanvas.tsx).
- **Test** `src/components/eye-interaction.test.tsx` verifies the control is hidden without API
  support; the focused Visualize browser run passes. The full mobile control sweep remains incomplete.

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

### V-103 — Historical reload failures were attributed to eviction without proof — OPEN
- **Observation** Earlier reload checks sometimes returned to onboarding or did not find a
  just-written record. Their save oracle could match optimistic UI before commit.
- **Correction (2026-09-17)** Browser eviction, memory pressure, immunity of installed profiles,
  and absence under serial execution were not established. Missing `onboarded` alone does not
  prove eviction: an empty database legitimately receives schema-only metadata during migration.
  A retry passing does not make the first failure harmless.
- **Action** Removed data-dependent eviction skips from verification helpers and callers.
  Reload tests now wait for committed Today confirmation or an independent stored settings read.
- **Evidence** The focused 42-test run on 2026-09-17 passed 41 tests; its only failure was V-011.
  This does not retrospectively prove the cause of every historical reload failure.

### V-104 — WebKit logs repeated texImage3D errors from the 3D-texture path
- **Found** 2026-09-14 (controls sweep, mobile project)
- **Symptom** On the WebKit mobile project, the 3D eye logs
  `WebGL: INVALID_OPERATION: texImage3D: FLIP_Y or PREMULTIPLY_ALPHA isn't allowed for
  uploading 3D textures` on every frame. Chromium does not. The render still produces frames.
- **Judgement** Recorded as a renderer follow-up rather than swept as a page defect; the
  mobile sweep tolerates this one message explicitly. Deep renderer work is out of scope for
  the verification pass.

### V-011 — Offline reopening fails in the mobile WebKit test — OPEN
- **Reproduced** 2026-09-17, working tree beyond `5816856`, one worker, no retries.
- **Repro** `npx playwright test e2e/verify/persistence.spec.ts --workers=1 --retries=0 --grep 'network cut'` from `app/`.
- **Result** Chromium passes; mobile WebKit fails at `page.goto('/#/today')` after leaving for
  `about:blank` with the context offline: `WebKit encountered an internal error`.
- **Diagnostic evidence** Both projects pass the assertion that every file in the generated
  service-worker SHELL list is present in Cache Storage before the network is cut. The worker
  controls the page. This rules out missing precached files in these runs, not every worker defect.
- **Correction** The earlier claim that `goto` worked was not an offline document-reopening
  proof. The pre-existing offline spec skips WebKit, but that is not independent proof of cause.
  Following the independent reproduction below, the verifier skips only this test on WebKit
  with an explicit V-011 reason. This is an unverified platform path, not a pass or an app fix;
  physical iOS offline reopening remains unverified.
- **Refined isolation (2026-09-17, second run)** The same minimal page, with the network made
  unreachable by *stopping the server* instead of `context.setOffline(true)`, reloads offline
  fine in WebKit too. The failure is specific to Playwright's offline-emulation path in WebKit,
  not to a service worker serving a cached shell while unreachable. The spec cannot stop the
  shared preview server per-test, so the skip stands; the app's offline path itself now has
  positive (Chromium + WebKit server-down isolation) but still not iPhone-device evidence.
- **Independent isolation** `/tmp/afterlight-offline-isolation.cjs` serves a static heading and a
  minimal cache-first service worker from a local HTTP server, with no Afterlight code. After
  proving the page is cached and controlled, it cuts the network and reloads. WebKit fails with
  the same internal error; Chromium passes. Afterlight is therefore not required to reproduce
  this environment-specific failure. This supports a Playwright/WebKit-path limitation, not a
  claim that real Safari or the app's full offline behavior has passed.

### V-107 — Visualize specs time out when both workers are on the 3D page at once
- **Found** 2026-09-16 (full `npm run e2e:verify` re-runs, desktop project)
- **Symptom** Late in a two-worker run, 3–4 Visualize specs time out waiting for a button to be
  "stable" (the atlas row, Retina states, Reset view), on both attempts. They fail only when two
  Visualize specs run side by side — each page renders the eye in software GL. The same file
  passes 14 of 14 (two repeats) on one worker, and the first re-run passed it at two workers.
- **Judgement** Recorded as test-environment starvation, the same family as V-103, pending a
  decision: run `visualize.spec.ts` serially, or accept it in local runs. Not yet shown to be
  harmless on a slow real device — worth a human look at the eye studio on low-end hardware.

## Inventory candidates — verdicts

- **`#/my-eyes?add=…` unreachable deep link — fixed.** Nothing in the app ever navigated with
  `?add=` (the chooser opens the modals inline), and the router treats the query as part of an
  unknown route. The dead parameter handling and its `ADD_KINDS` map are removed.
- **`EyeSelect` exported, never used — recorded.** Dead export in ui.tsx; harmless, left for the
  component library's next touch.
- **Visualize tab type member `"conditions"` never rendered — fixed.** Removed from the `Tab` union.
- **MeasurementModal `note` state with no input — fixed.** The model, the save path and the
  timeline summary all support a note; only the input was missing. Added ("Note (optional)").
- **DisplaySettings showed "Light" twice — fixed.** The duplicate entry in `prefs.ts` THEMES is
  removed; one Light button remains.
- **Prescription acuity saved but never displayed — fixed.** `fmtRx` now appends the recorded
  acuity when present, so what goes in comes back out.
- **Timeline category filters hidden in Story view — recorded (by design).** The filters belong
  to the Everything view; the Story view's lens does that filtering instead.
- **ConfirmButton 2.6s re-arm — recorded (by design).** Verified: a prompt second click confirms
  (the suite double-clicks), a slow second click re-arms. The window is generous enough for a
  deliberate destructive confirm.

- `#/my-eyes?add=…` deep link reads a parameter nothing ever sends (unreachable?)
- `EyeSelect` component exported, never used
- Visualize tab type member `"conditions"` never rendered
- MeasurementModal has `note` state with no input (measurements cannot carry a note)
- DisplaySettings shows "Light" twice (two buttons, one theme)
- Prescription acuity values are saved but never displayed anywhere
- Timeline category filter row hidden in Story view — no effect possible there
- ConfirmButton 2.6s re-arm: double-click timing and label reset
