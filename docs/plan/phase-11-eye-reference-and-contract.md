# Phase 11 — Eye reference, baseline and anatomy contract

**State:** not started. See `EYE-REALISM-HANDOFF.md` for the complete visual contract.

## Preconditions

None. Read `AGENTS.md` and the handoff before editing. Preserve the existing dirty checkout.

## Scope

`docs/plan/EYE-REALISM-HANDOFF.md`, `docs/plan/STATUS.md`, `docs/engine.md`,
`docs/asset-pipeline.md`; read-only inspection of `assets-src/`, `app/src/engine/`,
`EyeExplorer.html`, `app/src/components/EyeCanvas.tsx`, `EyeStudio.tsx`,
`app/src/pages/Visualize.tsx`, `app/e2e/engine.spec.ts`, and build/asset scripts.
New outputs: `docs/eye-realism/baseline.md`, `anatomy-contract.md`, and baseline screenshots.

## Tasks

1. Record the branch, dirty files, Blender version and current asset/build commands. Run the
   baseline verification gate and keep failures attributable to the existing checkout separate.
2. Open the supplied reference interactively if accessible; record the URL and observed visual
   traits. If inaccessible, use the detailed target in the handoff and state this evidence gap.
   Do not download its model or substitute a paid acquisition task.
3. Capture both current browser viewers in whole-eye, cutaway, corneal and retinal modes at a
   fixed desktop viewport. Record which features are absent, misleading or visually weak.
4. Inventory geometry names, condition hooks, coordinate conventions, laterality, dimensions,
   clipping, camera behaviour, generation scripts and embedded output paths in both viewers.
5. Define stable structure IDs, units/axes, parent transforms, material slots, UV conventions,
   parameter ownership and disposal ownership. Map every current condition hook to the planned
   replacement. Document how shared data will reach both Three.js versions without network loads.
6. Consult primary anatomy sources for new muscle, nerve, choroidal and attachment dimensions;
   cite the source and locator for each intended addition. Mark unavailable measurements as
   unresolved rather than inventing numbers. Separate true dimensions from illustrative scales.
7. Establish fixed comparison cameras and a capture matrix. Record baseline triangle/draw-call,
   asset-byte and interaction timings on the available hardware; establish the Phase 16 test setup.

## Acceptance criteria

- The baseline has actual images of both running viewers, their URLs, viewport and camera settings.
- The contract maps every rendered structure and legacy condition hook to an owner and a source.
- The slicing design explains how exposed edges will be closed and how material boundaries survive.
- There is a reproducible asset path from Blender through both viewers and the standalone build.
- `npm run verify` passes, or pre-existing failures are recorded and phase remains partial.

## Handoff to the next phase

Update `STATUS.md` with the branch, date, evidence paths and any gaps. List changed source files,
regeneration commands, tests run and assumptions the next phase must preserve. Do not mark this
phase done while a required criterion is unmet. No publishing or clinical self-approval.
