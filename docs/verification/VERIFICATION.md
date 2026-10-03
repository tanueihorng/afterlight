# Verification charter — evidence and limits

Updated 2026-09-23. **Overall status: partial; whole-app verification is not complete.**

This corrects the reports dated 2026-09-14 and 2026-09-16. The previous manifest bulk-filled
124 `pass` cells without per-control execution evidence. Those verdicts are withdrawn, as are
the blanket claims of a clean sweep, green suites, complete persistence coverage and completed
human inspection. Historical aggregate totals and repeat-run claims are not used as evidence
here. A spec's existence, a test title or a code fix is not a passing run.

## Charter and verdicts

Verify the app's observable promises, starting with real user actions and following saved data
through storage, reload and export. Keep these areas distinct:

- **L1 — Sweep:** routes, controls, errors and recovery, on desktop and phone.
- **L2 — Behaviour:** each control's effect, with empty and populated records.
- **L3 — Flows:** daily recording, onboarding, briefs, demo removal and archive round-trips.
- **L4 — Persistence:** commit acknowledgements, reloads, offline use and stored files.
- **L5 — Accessibility:** keyboard, screen reader, focus, targets, themes and type scales.
- **L6 — Human inspection:** rendering, drawing feel, print, landing page and standalone explorer.

**Verified** means the named check has a recorded outcome, limited to its actual assertions.
**Partial** means some evidence exists but the area's acceptance criteria remain uncovered.
**Unverified** means no adequate execution evidence is recorded. **Open** means an unresolved
failure or explanation. **Flagged** requires a human decision. Historical reproductions are
labelled as such; hypotheses are not findings of cause.

For future verdicts, record the date, revision/working-tree state, command or manual steps,
environment, assertions and result (including failures/skips). Do not infer coverage from test
names or replace a failure with an environment explanation without discriminating evidence.
Findings and their limits belong in [DEFECTS.md](DEFECTS.md).

## Focused evidence — 2026-09-23

This pass used the current working tree, including pre-existing uncommitted changes. The checks below
were executed after the store commit-order fix; they describe only the named flows.

| Check | Result | What it establishes |
| --- | --- | --- |
| `cd app && npm run verify` | **Pass** — typecheck, lint, guard, assets, changelog, 591 unit tests, production build, bundle budget and built-file no-network check | The configured project gate is clean. Build emits existing warnings for the large Visualize chunk and `MyEyes` being imported both dynamically and statically. |
| Focused Playwright run: daily loop; Today; appointments; persistence; timeline; timeline add; settings, `--workers=1` | **82 passed, 2 skipped** across desktop Chromium and mobile WebKit | Covered add/edit/delete and reload for appointments; question updates; daily record save/edit/delete; demo load/remove; settings persistence; timeline filters and chooser; browser offline is covered on desktop Chromium. Skips: desktop-only brief presentation on mobile, and offline navigation on mobile WebKit (V-011). |
| Focused Playwright run: My Eyes; self-checks; imaging; palettes; Visualize, `--workers=1` | **41 passed, 7 skipped; 2 initial Amsler test failures** across desktop Chromium and mobile WebKit | The two failures came from the Amsler test clicking once instead of drawing, with its canvas below the viewport. The test now scrolls the canvas into view and draws by pointer drag; rerunning the complete self-check file passed **6/6** across both projects. The other executed My Eyes, imaging/document, palette search/ask and Visualize assertions passed. The seven skips remain skips; this is selected flow coverage, not a whole-page sweep. |
| Focused Playwright run: handoff; mobile shell; offline; release; onboarding; What I See, `--workers=1` | **49 passed, 5 skipped** across desktop Chromium and mobile WebKit | PDF bytes and drawing output, encrypted share scope and QR text, print provenance, document import, phone navigation/overflow, onboarding, and drawing save/edit/compare passed. Four phone-only checks skip on desktop; the mobile network-cut record check is skipped under V-011. |
| `controls-sweep.spec.ts`, all nine desktop routes split into focused runs; phone shell on mobile | **9/9 route sweeps and 1/1 mobile shell sweep passed** | Every visible button, link, tab and summary on Today, What I See, Timeline, My Eyes, Checks, Imaging, Appointments, Visualize and Settings was clicked without a page error or loss of navigation. Mobile tab routing and More-sheet destinations passed. These are crash/navigation smoke checks; the page-specific tests establish selected control effects. |
| `src/components/eye-interaction.test.tsx`, `src/pages/timeline-return.test.tsx`, `src/lib/store.ops.test.tsx` | **7 passed** | A transaction abort keeps the last committed list visible; Today-to-timeline opens with observations and all dates; model drag/cancel does not select, clicks select, latest callback is used, and unsupported fullscreen is hidden. |
| `e2e/engine.spec.ts --project=desktop --workers=1` | **8 passed** (5.3 minutes) | Real 3D rendering, accessible selection/reset, generic boundary, repeated scene disposal, section-resource stability, keyboard rotation and the standalone explorer offline/no-network journey all passed in Chromium. No physical GPU/device performance claim. |
| Manual narrow-screen review on the local app | **Observed** | Today targets and bottom navigation are legible; the appointment time input was too small and is now full width with a 44px minimum height. The save confirmation’s timeline action visibly opens the entry with its eye and provenance labels. |

A wider 224-test run was stopped after 10.8 minutes while a route-control sweep was still running. It recorded
34 passes, one 3D boundary timeout, and an interrupted appointment sweep. The isolated desktop engine file
later passed 8/8; the appointment sweep passed on its own, then all nine desktop route sweeps and the mobile
shell sweep passed in focused runs. The combined 224-test run itself remains incomplete. Physical-device iOS
offline use, full screen-reader review and physical print output are not certified by this pass.

## Focused evidence — 2026-09-17

The following execution results were supplied for this documentation correction; they were not
rerun during the edit. Source inspection confirms the named assertions and commit handlers.
The working tree has changes beyond HEAD `5816856`, including the regression test and `dbPatch`
changes; these results must not be attributed to that commit alone.

| Check | Recorded result | What it establishes |
| --- | --- | --- |
| `app/src/lib/db-commit.test.ts`, unchanged implementation | **4 pass** | Put and patch reject when request success is followed by transaction abort; an aborted patch preserves the previous committed value; an idempotent patch preserves unrelated metadata; empty-store migration retains schema and onboarding across subsequent loads. |
| Production `dbPatch` mutation: add `write.onsuccess = () => resolve(merged)` | **1 fails**, with the promise resolved instead of rejecting | The aborted-patch regression detects premature acknowledgement in the production implementation, not merely in a test-local imitation. |
| Restore commit-only resolution at `transaction.oncomplete` | **4 pass** | The focused suite returns to passing when the premature resolution is removed. |

The empty-store migration check writes `schema_version`, creates one backup, patches
`onboarded`, then calls `loadMigrated()` again. Schema and onboarding remain present and no
second backup is created. This is not a browser reload test, but it provides no basis to blame
empty migration for the reported loss. Nor is there evidence here establishing browser eviction.

**V-009's commit barrier is verified at this focused scope, including the `dbPatch` extension
tracked in V-010. It is not proof that all reload data loss is fixed.** The tests do not establish
every UI save path, real-browser unload behaviour, whole-record persistence or storage eviction.

## Per-area evidence and outstanding work

Spec paths below are under `app/e2e/verify/` unless stated otherwise. They identify available
coverage to inspect/run, not results. No area inherits a pass from a suite filename.

| Area | Status | Evidence retained and limits |
| --- | --- | --- |
| Global shell, navigation and palettes | Partial | All nine desktop route-control smoke sweeps and the mobile tabbar/More sheet passed; palette mouse-driven search and ask examples passed. Shortcut, focus, error-boundary and semantic effects of every control are not fully covered. |
| Onboarding | Partial | Browser skip, full path and Back journeys passed on desktop and mobile. Migration metadata checks pass; reload of every onboarding field remains outside this run. |
| Today | Partial | The focused daily-loop and Today browser flows passed save/edit/delete and persistence checks. After saving, the View timeline action now opens the saved observation across all dates; `timeline-return.test.tsx` covers an older observation. All fields, urgent-notice behaviour and timing remain unverified here. |
| What I See | Partial | Drawing save/history/delete, undo/redo/clear and compare passed on desktop and mobile. Every drawing tool, text equivalents, and reload coverage remain outside this run. |
| Timeline | Partial | The focused range/lens and chooser flows passed, including Today’s saved-observation destination (V-105 fixed below). Not every chooser kind and record is covered through reload; V-102 remains unresolved at that broader scope. |
| My Eyes | Partial | Selected forms and confirmation/provenance assertions passed in the focused desktop/mobile browser run. Full form, trend and persistence coverage is unverified. |
| Checks | Partial | The complete Amsler, acuity and contrast browser flows passed on desktop and mobile (6 tests). Other calibration details, all controls, stored drawing equivalents and accessibility remain outside this run. |
| Imaging and documents | Partial | Selected scan, extracted-content review, ambiguous-date, file open/delete and OCT comparison browser flows passed. Quota failures and full file-byte/reload coverage are not established. |
| Appointments, briefs and sharing | Partial | Appointment add/edit/delete and question updates survived reload. Handoff checks passed PDF byte stability, embedded drawings, encryption/scope, QR text and print provenance. Physical pagination, device print output and clinician-facing wording remain open; wording needs human review. V-106 remains a product decision. |
| Visualize and explorer | Partial / open | Selected atlas search, deep links, severity and viewer modes passed in the page-focused run. All 8 desktop engine checks passed, including the generic boundary, resource stability and standalone offline explorer. Some mobile checks skip; visual quality on physical devices and slow-device performance are not certified. |
| Settings, demo and archives | Partial | Settings persistence and demo load/removal passed in the focused run. Archive merge/replace/encryption and wipe flows remain unverified. |
| Cross-cutting persistence and offline | Partial / open | Focused daily and appointment save/edit/delete reload journeys passed, along with offline recording on Chromium. The cause/extent of broader reload loss remains open (V-103); the mobile WebKit network-cut reload remains skipped under V-011. No blanket round-trip claim. |
| Search and ask | Partial | Selected palette search and ask examples passed by mouse. All record types, citation and not-found cases and keyboard paths are not fully covered by this run. |
| Accessibility | Partial | `npm run verify` passed the configured accessibility test suite and lint checks. Full screen-reader and physical-device review is not claimed. |
| Technical invariants | Partial | `npm run verify` passed the configured guard, unit tests, build, initial/lazy bundle budgets and built-file no-network check. This does not certify untested real-device and export/print scenarios. |
| Human inspection and clinical review | Partial / flagged | Manual narrow-screen inspection found and verified the 44px appointment time-input improvement and checked the Today-to-timeline path. Browser print assertions preserve provenance; physical print output and broader visual inspection remain open. Clinical, safety and clinician-facing copy require human review; this report is never clinical sign-off. |

## Execution boundary for this correction

This pass changed existing save ordering, timeline navigation, 3D input handling and input sizing,
with regression tests and browser checks; it added no new product feature. The working tree already
contained other uncommitted work, which was preserved. `npm run verify` passed on this tree, the
focused desktop/mobile browser runs completed, and all route-control sweeps later passed individually.
The combined 224-test run was stopped after 10.8 minutes; physical-device, full screen-reader and
print checks keep whole-app certification partial. No commit, release, publish or clinical-review
approval was made.
