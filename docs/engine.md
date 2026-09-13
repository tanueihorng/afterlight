# The eye engine

`app/src/engine/` renders a human eye. It is framework-agnostic TypeScript with an imperative API:
React mounts it, the standalone offline build mounts it, and tests call into it directly. Nothing
inside knows React exists.

## Layout

```
engine/
  core/
    scene.ts        the scene, materials, lighting, render loop, disposal
    capability.ts   what this device can do, and the quality tiers
  anatomy/
    dimensions.ts   ocular measurements in millimetres — every builder reads from here
    iris.ts         the two-layer melanin colour model and pupil response
    vessels.ts      the retinal vessel tree, grown from the disc
    fundus.ts       the fundus painter, and the parameters Phase 07 will drive
  materials/
    textures.ts     procedural iris, sclera and fundus textures, generated on device
  index.ts          the public surface, and GENERIC_MODEL_BOUNDARY
```

## Principles

**Anatomy in millimetres.** Axial length 24 mm, corneal anterior radius 7.8 mm, limbal diameter
11.7 mm, anterior chamber 3.1 mm, optic disc 1.8 mm at 15.5° nasal. A model built to real
proportions is the difference between "an eye" and "a ball with a picture on it". The anterior
geometry is derived from these — the sclera's corneal aperture, the corneal cap and the limbus
meet where the arithmetic says they meet, not where they looked right.

**Everything stays local.** The Blender-baked iris maps are embedded in the lazy renderer.
Iris colour, sclera and fundus textures are painted on-device and cached by their parameters.
No texture, model, HDRI or font is fetched from a third party.

**Parameters, not pictures.** Iris colour comes from one melanin model rather than four swapped
textures; the fundus comes from a vessel-growth algorithm rather than an image. Phase 07's disease
atlas is built entirely by changing these numbers.

**Dispose properly.** A leaked geometry or texture is invisible until the tab runs out of GPU
memory. `EyeScene.dispose()` releases every tracked resource, and an end-to-end test mounts and
unmounts the scene a dozen times while watching the heap.

**Say what it is.** `GENERIC_MODEL_BOUNDARY` is exported from one place and carried by every view,
including the canvas's accessible name. The more convincing the render becomes, the easier it is
for a patient to believe they are looking at their own retina — that sentence is the safety
property of the engine, not decoration.

## Quality and fallback

`probeCapability()` picks a tier from WebGL2 support, device memory, core count and maximum texture
size; the user can override it. Without WebGL2 the app says so plainly and the labelled 2D diagrams
remain, rather than showing a black rectangle.

## Adding anatomy

1. Put the measurement in `dimensions.ts` with its source in a comment.
2. Build geometry from that constant — never from a number that looked right.
3. If it varies between people or between conditions, it is a parameter, not a bake.
4. Add a property test: what must stay true (the vessel tree never enters the avascular zone; the
   disc is nasal to the fovea and mirrors between eyes).

## The standalone build

`npm run build:standalone` emits `EyeExplorer-engine.html`: one file, everything inlined, opens
from a USB stick on a machine with no internet. The original hand-built `EyeExplorer.html` still
ships alongside it and is still what the Visualize page's "3D explorer" tab loads — it carries
disease scenarios and a diagnose flow the engine does not have yet. Replacing it is a decision for
a human once Phase 07 reaches parity.

## Interactive views

The main **Visualize → The eye** view offers whole-eye, cross-section, isolated cornea and
posterior retina views. Slice position clips the outer shell and retinal bowl; it is an open
cutaway, not a scan or a histological section. Separate parts uses illustrative spacing, labelled
at the control. Zoom, slice and separation update the mounted renderer without rebuilding it.
Dragging and arrow keys ease towards a rotation target; reduced motion applies rotation directly.
Rendering stops when movement settles and resumes on interaction. The retina reuses the local fundus painter with its eye-specific vessel layout. Surface reflections
come from a generated softbox environment, with no downloaded textures or environment maps.

## Blender surface detail

The whole static model is Blender-authored now, not just the iris: `assets-src/build-anatomy.py`
reads the same parameter data the browser exports (`assets-src/generated/params.json`) and
produces `app/src/engine/assets/anatomy.bin` + `anatomy.json` — quantised regular grids that
`engine/anatomy/model.ts` decodes into plain typed arrays. Both eye viewers adapt those arrays
through their own thin adapters; no Three instance crosses between them. The browser still
colours, sizes and deforms everything the contract keeps runtime-owned: iris colour and pupil,
vessel growth, the fundus, laterality, slices. The cornea uses the stored asphericity and joins
the scleral opening at the limbus; the anterior chamber is measured from the inner corneal apex.
The editable Blender scene and its Cycles studies are source assets, not the browser render —
see [the asset pipeline](asset-pipeline.md) for the rebuild commands and budgets.
