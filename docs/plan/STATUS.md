# Phase ledger

The single place that says what has actually been built. Agents update this when they **start** and
when they **finish** a phase. Keep it honest — a phase marked done that isn't is worse than one
marked blocked.

**States:** `not started` · `in progress` · `blocked` · `done` · `partial (see notes)`

| # | Phase | State | Branch | Updated | Notes |
|---|---|---|---|---|---|
| 00 | Foundations & guardrails | not started | — | — | `npm run verify` currently runs guard + build only; this phase adds lint + tests |
| 01 | Data integrity & portability | not started | — | — | |
| 02 | Performance & scale | not started | — | — | |
| 03 | Accessibility for low vision | not started | — | — | |
| 04 | Daily loop & mobile | not started | — | — | |
| 05 | Clinical breadth & self-tests | not started | — | — | |
| 06 | Visualization I — render engine | not started | — | — | start the spike early; long pole |
| 07 | Visualization II — disease atlas | not started | — | — | |
| 08 | Records intelligence | not started | — | — | |
| 09 | Clinician handoff & sharing | not started | — | — | |
| 10 | Release & clinical review | not started | — | — | |

## Log

Newest first. One line per meaningful event: phase started, phase finished, invariant changed,
scope cut, or a decision a future agent would otherwise have to re-derive.

- **2026-09-08** — Agent control established: `AGENTS.md`, `CLAUDE.md`, invariant guard
  (`npm run guard`), `/phase` `/gate` `/new-record-type` commands, three reviewer subagents,
  phase ledger. Guard found and fixed a real provenance gap: `FloaterObject` had no `source_type`
  (now `patient_reported`, backfilled on read pending the Phase 01 migration system).
- **2026-09-08** — Build plan written: `docs/plan/`, eleven phases.
