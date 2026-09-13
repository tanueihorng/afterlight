# Original anatomical eye — execution handoff for any AI agent

Written 2026-09-13. **Planning only; phases 11–16 are not started.**

This plan is independent of model and coding assistant. Any agent with access to the repository,
a terminal, Blender and a browser can execute it. Use the equivalent tools in your environment;
no particular assistant, plugin or conversation history is required. If a required capability is
unavailable, record the limitation and leave its acceptance checks unverified.

## The user's request

Build the eye ourselves, using Blender and Three.js, to reach the anatomical cutaway quality of
[the supplied Eye Anatomy reference](https://sketchfab.com/3d-models/eye-anatomy-5dac474887174eb78cb7ffce6bd9ce3a).
The user rejected earlier cosmetic improvements and explicitly wants original authoring, not a
purchase, embedded Sketchfab viewer, or another request to supply a model. Improve **both**
Visualize → The eye and Visualize → 3D explorer. Preserve their existing functionality.

The target is a convincing interactive anatomical specimen: a three-quarter side cutaway with a
readable retinal bowl, layered wall thickness, shaped cornea and lens, branching vessels, optic
nerve and tapered muscle straps. The cornea sits towards screen-right and the nerve towards
screen-left in the reference composition. The existing frontal white sphere, iris texture and
capsule muscles do not meet this target. Changing the renderer or adding a Blender screenshot
alone does not solve it. Build original geometry and materials; do not claim an exact replica.

## Read first

Read `AGENTS.md`, this document, then the current phase brief and every file in its Scope.
The following briefs govern this follow-up; the old Phase 06 is historical context. In particular,
this work does not require eyelids, animated tear breakup, or additional disease content. The
fundus and condition-dependent changes remain procedural, including in the Blender preview.

| Phase | Deliverable | Dependency |
|---|---|---|
| [11](phase-11-eye-reference-and-contract.md) | Baseline, anatomy sources and shared model contract | None |
| [12](phase-12-original-blender-anatomy.md) | Original editable Blender cutaway and browser assets | 11 |
| [13](phase-13-eye-renderer-and-sections.md) | Real-time materials, solid sections and camera | 12 |
| [14](phase-14-eye-exploration-controls.md) | Cornea/retina inspection, slicing and accessible controls | 13 |
| [15](phase-15-explorer-renderer-parity.md) | Same model quality in the legacy explorer | 14 |
| [16](phase-16-eye-visual-and-offline-gate.md) | Visual evidence, performance and offline regression gate | 15 |

Execute one phase at a time. Update `STATUS.md` with the actual branch/date at phase start and
with evidence at completion. Follow the repo's phase commit convention, staging only work owned
by that phase. Do not sweep unrelated files into a commit. Continue through ordinary reversible
implementation choices without asking for approval after every phase. If a technical assumption
proves false, record the issue and revised proposal rather than silently dropping a requirement.
Human review remains required only where `AGENTS.md` explicitly requires it.

## Existing work to preserve and verify

The checkout is already dirty. Record its status and diff before any edit; do not reset it.
Earlier work added Blender iris baking, normal/relief PNGs, aspheric corneal geometry, controls,
asset embedding and browser tests. Read those changes before replacing anything. In particular:

- `assets-src/build-eye.py`, `preview-eye.py`, `eye.blend`, `eye-study.png`, `ASSETS.md`.
- `app/src/engine/anatomy/surface.ts`, `materials/iris-detail.ts`, `assets/`.
- `app/scripts/sync-eye-assets.mjs`, plus changes to both renderers and their tests.
- Untracked `docs/Afterlight-User-Stories-and-Technical-Spec.docx`, its PDF and `scripts/`
  predate this work; do not remove, rewrite or commit them as part of this task.

Blender was installed and used in the preceding work; verify `blender --version` before assuming
installation is needed. Three.js is already installed. Current source supports an iris bake, not
a complete reference-quality anatomical asset. `eye-study.png` is a Blender render, not evidence
that the browser looks the same. The Phase 06 ledger's historical “Blender not installed” note is
stale for the current working tree; retain its historical meaning and append the new evidence.

The main renderer is `app/src/engine/core/scene.ts`, mounted by `EyeCanvas.tsx` and `EyeStudio.tsx`.
The other tab still loads root `EyeExplorer.html` through a generated public copy. The generated
`EyeExplorer-engine.html` is a third deliverable, not the file used by the legacy tab. The two
renderers currently have different Three.js versions. Avoid assuming materials or objects can
be passed between them. Keep existing condition, tour, compare and simulator paths operational.

## Engineering decisions

- Blender authors the neutral base surfaces and baked fine detail. Three.js supplies runtime
  deformation, procedural vessels, parameter changes, clipping and interaction. Never bake a
  patient's appearance or disease severity into a fixed replacement model.
- Share a documented anatomy/asset contract between the two viewers. Prefer shared pure geometry
  data/builders with thin renderer adapters; preserve legacy behaviours rather than replacing
  its entire page before feature parity exists. Bundled local glTF is an option for static neutral
  parts, using Three's own loader; it is not an excuse to freeze editable parts.
- Physical dimensions come from `dimensions.ts`. New measurements need traceable anatomy sources
  and explicit approximations. Artistic exposure, roughness and camera framing are separate from
  anatomical dimensions. Illustrative layer magnification is labelled and reversible.
- Slices show closed, thickness-bearing tissue edges. Shader clipping alone leaves hollow open
  shells and is insufficient. Implement explicit section geometry for controlled ocular surfaces;
  clip attached vessels with their parent layer. Unsupported cuts must not pretend to be complete.
- Preserve local assets, initial lazy-load boundaries, the generic-model statement, condition
  parameters, laterality and accessible non-canvas alternatives. Do not touch diary data schemas.
- Runtime assets stay within the existing 12 MB lazy renderer and 5 MB engine standalone budgets;
  measure actual emitted/inlined bytes. No remote model, texture, font or environment requests.

## Visual completion contract

At the default cutaway angle, without manipulating controls, the browser must visibly show:

1. A cohesive globe and concave retinal bowl, not nested floating spheres.
2. Distinct continuous scleral, choroidal and retinal cut edges, with no black holes or flicker.
3. A corneal bulge joining the limbus and a separate biconvex lens behind the iris.
4. Retinal vessels attached to the inner surface and connected visually to the disc region.
5. A shaped optic nerve/sheath and tapered muscle straps with directional fibres, not capsules.
6. Soft neutral lighting, restrained wet highlights and clear tissue differences without plastic
   uniform gloss, huge white glare spots or saturated decorative colours.
7. Smooth user-controlled orbit, useful near-detail views and live slicing/separation.
8. The generic educational boundary legible in every view, including fullscreen if implemented.

Save comparable browser views and a written assessment of each item. Automated screenshots only
prove pixels exist; the executor must inspect the images. A good Blender render does not waive
browser comparison. If any item fails, iterate in the owning phase and keep the ledger honest.
This is a visual target, not a claim of clinical validation or a promise of pixel identity.

## Execution prompt

Give this prompt to any AI coding agent working in this repository:

> Read AGENTS.md and docs/plan/EYE-REALISM-HANDOFF.md. Execute phases 11–16 in order,
> starting with phase-11-eye-reference-and-contract.md. Build the original Blender/Three.js eye
> ourselves to match the supplied reference's anatomical cutaway quality in both Visualize eye
> views. Preserve the dirty working tree and existing condition functionality. Follow every
> phase's scope, acceptance criteria and verification gate. Inspect actual browser screenshots
> and iterate until the visual contract is met; do not substitute a Blender preview for browser
> evidence. Update STATUS.md and report passed, failed and skipped checks honestly. Do not
> publish, buy a model, add runtime third-party requests or mark clinical review approved.
