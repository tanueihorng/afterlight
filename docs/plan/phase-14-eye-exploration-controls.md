# Phase 14 — Interactive cornea, retina and layer inspection

**State:** not started. See `EYE-REALISM-HANDOFF.md` for the complete visual contract.

## Preconditions

Phase 13 browser renderer visually accepted against the contract. Read `AGENTS.md` and the handoff before editing. Preserve the existing dirty checkout.

## Scope

`app/src/components/EyeStudio.tsx`, `EyeCanvas.tsx`, `app/src/pages/Visualize.tsx` only for eye
integration, `app/src/engine/` interaction API, `app/src/lib/locales/en.ts`, relevant styles,
component/engine/E2E tests, `docs/guide.md` and `docs/eye-realism/`.

## Tasks

1. Make the anatomical cutaway the initial educational presentation, with a clear whole-eye
   alternative and a reset action that restores camera, slice, separation and selection.
2. Implement damped pointer orbit, bounded zoom and touch controls without trapping page scroll.
   Provide keyboard equivalents and visible focus. Reduced motion applies changes directly.
3. Add structure selection through model picking plus a synchronised accessible list. Selection
   identifies the part with outline/label and text, not colour alone; focus camera on explicit
   request. At minimum support cornea, lens, sclera, choroid, retina, nerve and muscles.
4. Connect slice position, layer visibility and reversible exploded spacing to the existing
   scene. Do not remount the canvas on slider input. Cap detached sections as needed, and retain
   stable structure IDs. Label spacing/layer enlargement as illustrative rather than measured.
5. Provide useful cornea and retina presets: corneal front/back surfaces and lens relationship;
   retinal bowl, vessels and disc. If a layer is too thin to inspect at true scale, use a clearly
   labelled reversible magnification setting. Reuse existing educational text; prepare any new
   clinical explanation separately in `docs/atlas-review.md` for human review.
6. Keep the generic-model boundary visible, plus a text description of the selected structure,
   visible layers and cutaway state. Translate new control strings through `t()`. Check 44px
   targets, largest type scale, four themes, mobile layouts and the no-WebGL fallback.

## Acceptance criteria

- A user can reach a corneal close-up, retinal close-up and layered section with labelled controls.
- Picking and keyboard/list selection agree; reset restores the documented initial state.
- Orbit, zoom, slices and separation remain responsive and preserve the mounted renderer.
- Keyboard-only and reduced-motion journeys, accessible names and no-WebGL fallback pass tests.
- No new clinical copy is self-approved; `npm run verify` and relevant desktop/mobile E2E pass.

## Handoff to the next phase

Update `STATUS.md` with the branch, date, evidence paths and any gaps. List changed source files,
regeneration commands, tests run and assumptions the next phase must preserve. Do not mark this
phase done while a required criterion is unmet. No publishing or clinical self-approval.
