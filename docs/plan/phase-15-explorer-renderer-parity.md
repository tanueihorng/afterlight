# Phase 15 — Bring the original explorer to the same model quality

**State:** not started. See `EYE-REALISM-HANDOFF.md` for the complete visual contract.

## Preconditions

Phase 14 stable engine and controls. Read `AGENTS.md` and the handoff before editing. Preserve the existing dirty checkout.

## Scope

Root `EyeExplorer.html`, shared anatomy/material/interaction adapters under `app/src/engine/`,
`app/scripts/sync-eye-assets.mjs`, `sync-explorer.mjs`, `build-standalone.mjs`, relevant build
entrypoints and `app/e2e/engine.spec.ts`; `docs/engine.md`, `docs/asset-pipeline.md`.

## Tasks

1. Apply the same original anatomy/material contract through a thin legacy adapter. Generate
   embedded shared code from source with explicit markers. Do not manually patch generated blocks
   or pass Three.js instances across differing library versions. Keep clinical scenario code intact.
2. Replace primitive globe layers, nerve capsules, muscle capsules and obstructing torus lids
   in the anatomical presentation. Match the engine camera, lighting and default cutaway framing.
3. Connect existing cut, layer, appearance and deep-dive controls to stable structure IDs and
   capped sections. Restore all scenario/tour animation references previously attached to old
   meshes; verify each affected scenario through its user-facing entrypoint.
4. Retain existing generic boundaries and accessible controls. Port the new inspection controls
   where required for equivalent cornea/retina interaction; share localisation text where possible.
5. Regenerate public and engine standalone outputs using scripts. Root source, public copy and
   each standalone must contain current assets; do not update/deploy the public site as a shortcut.
6. Capture equivalent angles in both app tabs. Resolve visible material, scale, geometry and
   control discrepancies rather than leaving one viewer as the old prototype.

## Acceptance criteria

- Both actual Visualize tabs meet the same visual contract and expose useful cornea/retina views.
- Existing scenarios, tours and layer deep dives have a documented regression matrix with results.
- Asset-sync checks detect stale generated blocks; both standalone files open offline without errors.
- `npm run verify`, `npm run build:standalone` and relevant explorer E2E pass.

## Handoff to the next phase

Update `STATUS.md` with the branch, date, evidence paths and any gaps. List changed source files,
regeneration commands, tests run and assumptions the next phase must preserve. Do not mark this
phase done while a required criterion is unmet. No publishing or clinical self-approval.
