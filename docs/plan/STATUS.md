# Phase ledger

The single place that says what has actually been built. Agents update this when they **start** and
when they **finish** a phase. Keep it honest — a phase marked done that isn't is worse than one
marked blocked.

**States:** `not started` · `in progress` · `blocked` · `done` · `partial (see notes)`

| # | Phase | State | Branch | Updated | Notes |
|---|---|---|---|---|---|
| 00 | Foundations & guardrails | done | phase-00-foundations | 2026-09-08 | 96 tests; `verify` = types + lint + guard + tests + build; CI green |
| 01 | Data integrity & portability | done | phase-01-data-integrity | 2026-09-08 | archive v2 + migrations + encryption + merge; files now stored as bytes |
| 02 | Performance & scale | not started | — | — | |
| 03 | Accessibility for low vision | done | phase-03-low-vision-access | 2026-09-08 | 4 themes, scalable type, axe + keyboard tests, drawings described in words |
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
