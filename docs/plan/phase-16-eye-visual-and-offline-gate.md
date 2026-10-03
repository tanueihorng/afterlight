# Phase 16 — Visual review, performance and offline completion gate

**State:** not started. See `EYE-REALISM-HANDOFF.md` for the complete visual contract.

## Preconditions

Phases 11–15 implemented with evidence. Read `AGENTS.md` and the handoff before editing. Preserve the existing dirty checkout.

## Scope

`app/e2e/engine.spec.ts` and relevant offline/accessibility tests, focused fixes to phase-owned
rendering files, `docs/eye-realism/acceptance.md`, final screenshots, `docs/engine.md`,
`docs/asset-pipeline.md`, `docs/guide.md`, `docs/plan/STATUS.md`.

## Tasks

1. Build once and test the same production output; do not rebuild asset hashes underneath a
   running browser suite. Run Blender separately from timing-sensitive test workloads.
2. Save final desktop and phone browser images: default cutaway, exterior, cornea, retina and
   exploded layers, in both viewers. Include intermediate and extreme slice positions, plus
   left/right anatomy. Inspect at normal viewing size and close-up. Assess every visual-contract
   item explicitly against the baseline/reference traits; link images and list remaining gaps.
3. Record hardware/browser, quality tier, triangle counts, draw calls, texture memory estimates,
   lazy bytes and standalone sizes. Target p95 frame time <=33 ms during interaction at medium
   tier on the tested hardware and <=50 ms at low tier on a tested phone. Report unavailable
   hardware as unverified; software-renderer CI timing is not evidence of phone performance.
4. Verify rendering settles when idle, no continuous auto-rotation by default, reduced motion
   stops interpolation, and repeated mount/unmount plus slice sweeps do not accumulate resources.
   Lower detail adaptively where needed while retaining visible anatomical structure.
5. Run desktop and mobile interaction/accessibility journeys, largest text and four themes.
   Confirm demo data still loads and no diary flows, record provenance or schemas changed.
6. Verify zero external requests in both views, production offline reload after installation,
   and standalone files opened directly without network. A hosted URL's first visit cannot load
   without its bytes: distinguish that from a supplied standalone working on its first opening.
7. Run `npm run verify`, `npm run build:standalone` and `npm run e2e` from `app/`. Record exact
   commands, results and any environment-specific skips. Do not suppress failing tests or loosen
   budgets to obtain a green gate. Fix regressions in scope and rerun relevant checks.
8. Update docs with rebuild commands, parameter ownership, supported slice modes and measured
   limits. Mark phases done only where their criteria hold. Report visual quality separately
   from clinical validation. Leave clinical-review status and publishing untouched.

## Acceptance criteria

- Final acceptance report links real browser evidence for both viewers and all visual criteria.
- Verification, standalone build and E2E gates are clean; skips and device gaps are explicit.
- Offline behaviour, accessibility, parameter controls and resource cleanup are demonstrated.
- Initial download, 12 MB lazy renderer and 5 MB engine standalone limits still pass.
- The user receives a working local preview and editable Blender source, with honest limitations.

## Handoff to the next phase

Update `STATUS.md` with the branch, date, evidence paths and any gaps. List changed source files,
regeneration commands, tests run and assumptions the next phase must preserve. Do not mark this
phase done while a required criterion is unmet. No publishing or clinical self-approval.
