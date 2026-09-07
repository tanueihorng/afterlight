# Phase ledger

The single place that says what has actually been built. Agents update this when they **start** and
when they **finish** a phase. Keep it honest — a phase marked done that isn't is worse than one
marked blocked.

**States:** `not started` · `in progress` · `blocked` · `done` · `partial (see notes)`

| # | Phase | State | Branch | Updated | Notes |
|---|---|---|---|---|---|
| 00 | Foundations & guardrails | done | phase-00-foundations | 2026-09-08 | 96 tests; `verify` = types + lint + guard + tests + build; CI green |
| 01 | Data integrity & portability | not started | — | — | |
| 02 | Performance & scale | not started | — | — | |
| 03 | Accessibility for low vision | not started | — | — | |
| 04 | Daily loop & mobile | not started | — | — | |
| 05 | Clinical breadth & self-tests | not started | — | — | |
| 06 | Visualization I — render engine | not started | — | — | long pole; start the spike early. Hybrid: Blender-authored base mesh + baked detail, procedural for everything parameterised |
| 07 | Visualization II — disease atlas | not started | — | — | |
| 08 | Records intelligence | not started | — | — | |
| 09 | Clinician handoff & sharing | not started | — | — | |
| 10 | Release & clinical review | not started | — | — | |

## Log

Newest first. One line per meaningful event: phase started, phase finished, invariant changed,
scope cut, or a decision a future agent would otherwise have to re-derive.

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
