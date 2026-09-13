# Phase 13 — Browser rendering and solid interactive sections

**State:** not started. See `EYE-REALISM-HANDOFF.md` for the complete visual contract.

## Preconditions

Phase 12 assets and geometry contract complete. Read `AGENTS.md` and the handoff before editing. Preserve the existing dirty checkout.

## Scope

`app/src/engine/core/scene.ts`, `core/capability.ts`, anatomy builders, materials, assets, public
engine API and engine tests; `app/src/components/EyeCanvas.tsx` lifecycle integration;
asset/standalone scripts where integration requires it; `docs/eye-realism/` evidence.

## Tasks

1. Load the original neutral model through the agreed local bundle path. Wire parameterised
   iris, pupil, vessels, fundus and condition deltas to geometry/materials. Do not replace the
   model with a rendered image or require `?render=blender` to see the improved result.
2. Implement distinct tissue materials: fine rough sclera, moist retinal wall, darker choroid,
   fibrous muscle, pale nerve sheath and controlled corneal/lens transmission. Test transparent
   ordering from front, back and the cut surface; avoid nested transparency hiding the anatomy.
3. Replace unsealed clipping with thickness-aware section geometry. Compute intersections/caps
   in model coordinates for each sliceable solid; keep tissue bands distinct and recompute only
   affected geometry. Handle tangent cuts and slice extremes without spikes, holes or stale caps.
4. Attach retinal vessel tubes to the concave surface using the existing seeded tree. Bound
   tessellation by quality tier, preserve the avascular zone and clip vessels with the retinal
   surface. Use finer detail only where it remains perceptible at the intended viewport.
5. Set a reference-inspired three-quarter cutaway camera with room for the nerve and muscles.
   Provide exterior, corneal and retinal framing from anatomy bounds. Use local studio lighting,
   consistent tone mapping and restrained exposure; keep every part legible against the background.
6. Preserve demand rendering and correctly resume during transitions/parameter changes. Dispose
   dynamic section buffers, maps and loaders; handle resize and context loss without blank views.
7. Capture the four browser views using Phase 11 camera settings; compare with both baseline and
   Blender study. Correct structural or material discrepancies now, before adding more controls.

## Acceptance criteria

- Actual browser images meet visual items 1–6; no screenshot is substituted with a Blender render.
- Slice values 0, .25, .5, .75 and 1 remain valid under orbit and do not leave open tissue edges.
- Left/right, pupil, iris/fundus appearance and existing condition parameters still change output.
- Tests cover section topology, tangent/extreme cuts and repeated buffer replacement/disposal.
- `npm run verify` and relevant desktop engine E2E pass; initial/lazy/standalone budgets hold.

## Handoff to the next phase

Update `STATUS.md` with the branch, date, evidence paths and any gaps. List changed source files,
regeneration commands, tests run and assumptions the next phase must preserve. Do not mark this
phase done while a required criterion is unmet. No publishing or clinical self-approval.
