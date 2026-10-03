# Phase 12 — Original Blender anatomy and reproducible assets

**State:** not started. See `EYE-REALISM-HANDOFF.md` for the complete visual contract.

## Preconditions

Phase 11 contract complete. Read `AGENTS.md` and the handoff before editing. Preserve the existing dirty checkout.

## Scope

`assets-src/build-eye.py`, `preview-eye.py`, `eye.blend`, `ASSETS.md`; optional focused authoring
scripts under `assets-src/`; `app/src/engine/anatomy/dimensions.ts`, new shared anatomy data/builders,
`app/src/engine/assets/`, asset generation/check scripts; `docs/eye-realism/` and asset pipeline docs.

## Tasks

1. Preserve the useful iris bake pipeline. Add neutral anatomy dimensions with sources from
   Phase 11, and make Blender read the same parameter data the browser uses.
2. Author an ellipsoidal globe with an open limbus, nonzero scleral/choroidal/retinal walls,
   anterior and posterior corneal surfaces, shaped biconvex lens, iris, ciliary structure and
   zonular attachments. Keep required deformable topology and structure IDs stable.
3. Author a tapered optic nerve with sheath/core separation, positioned relative to the disc,
   and anatomically placed flattened muscle straps with tendon transitions. Avoid eyeball lids
   obscuring the cutaway; remove the old decorative torus/capsule look from this presentation.
4. Build the retinal bowl and vessels from shared procedural data, including in the Blender
   study. Preserve disc/fovea laterality and the avascular zone. Do not use a painted stock fundus.
5. Bake neutral fine-detail maps for tissue fibres and relief where they contribute at browser
   scale. Keep colour, pupil size, vessel density and condition deltas runtime-controllable.
6. Produce an editable full `.blend` scene with named collections and reproducible camera/light
   presets. Export optimised neutral assets or shared mesh data according to the contract.
7. Render a side cutaway, exterior, cornea close-up and retina close-up. Inspect the geometry
   silhouettes and joins before polishing shaders. Record mesh counts, units, maps and provenance.
8. Validate finite vertices/normals, winding, expected bounds and nonzero wall thickness. Check
   watertightness for closed tissue solids, with intended openings explicitly documented. Verify
   baked/exported assets and hashes; build a clone-equivalent path that needs no Blender installed.

## Acceptance criteria

- Editable Blender source visibly contains the whole anatomical model, not just an iris sculpt.
- Four inspected renders satisfy the structural parts of the handoff's visual contract.
- Contract IDs, dimensions and parameterisable parts survive export; no frozen severity model.
- Geometry tests catch invalid topology/bounds and incorrect left/right disc placement.
- Exported bytes fit the agreed budgets; `npm run verify` passes with committed-asset checks.

## Handoff to the next phase

Update `STATUS.md` with the branch, date, evidence paths and any gaps. List changed source files,
regeneration commands, tests run and assumptions the next phase must preserve. Do not mark this
phase done while a required criterion is unmet. No publishing or clinical self-approval.
