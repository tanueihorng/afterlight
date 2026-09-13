# Phase 13 — the browser renderer on the original model, as built

Date 2026-09-13. The app's **The eye** tab now renders the Blender-authored model directly — no
`?render=blender` switch, no fallback to the old nested spheres. Captures:
[captures/phase13/](captures/phase13/) (1280×800, production build, SwiftShader software GL).

## What replaced what

- `core/scene.ts` was rebuilt on `anatomy/model-assets.ts`: every structure decodes from the
  committed binary into typed arrays and adapts to Three r180 `BufferGeometry` per structure,
  with material groups per slot (tissue vs cut face). Laterality is a mirror transform on the
  eye root — the model is authored right-eye, exactly as the contract specifies.
- Live parameters stay live: iris colour/pupil (painted into the polar iris texture with a
  runtime pupil zone over the fixed 0.7 mm geometric aperture), fundus texture, scleral
  vessels, vessel tree, light level. `setAppearance()` retunes materials without rebuilding;
  EyeCanvas no longer remounts on appearance sliders.
- Sections: `anatomy/section.ts` computes the plane section of each sliced solid by walking its
  triangles, chains crossing segments by mesh edge (exact — no quantised point keys), and fills
  the loops: a lone loop ear-clips flat, nested loops become the wall band. Caps reuse each
  structure's pale cut material, so the rim reads sclera/choroid/retina as distinct bands.
  Slice 0 = intact, 0.5 = mid-cut, 1 = deep cut; the plane is the local vertical one, rotated
  with the eye as before. Vessels clip with the retina's plane.
- Vessels: `anatomy/vessels3d.ts` extrudes the seeded tree (same code as the fundus painter) as
  smoothed tubes on the inner retina — arteries and veins split by material, tubes hugging the
  surface, tips tapering to nothing, fine generations left to the painted texture. The FAV
  steering in `vessels.ts` now arcs vessels around the macula progressively (which also calms
  the painted fundus).
- Lighting keeps the generated softbox environment and key/fill/rim, with a soft anterior fill
  so the cut bowl reads. The tear-film sphere was dropped; the cornea's clearcoat carries the
  wet look (fewer stacked transparencies, per the contract's ordering concern).

## Contract check (browser, not Blender)

1. **Cohesive globe + retinal bowl** ✓ — one continuous model; no nested floating spheres.
2. **Distinct continuous cut edges, no holes** ✓ — capped sections; `section.test.ts` proves
   watertight caps (plane-exact vertices, no degenerate triangles, extremes/tangents safe,
   sweeps don't grow buffers) and the e2e sweep test asserts no resource growth.
3. **Corneal bulge joining the limbus, biconvex lens behind the iris** ✓ — visible in the
   cross-section capture with the lens translucent.
4. **Vessels attached to the inner surface, tied to the disc** ✓ — tubes converge on the
   geometric nerve head at `manifest.disc3d`; the fundus close-up shows disc, cup and arcades.
5. **Shaped nerve/sheath and tapered muscles** ✓ — sheath/core with the lengthwise cut capped
   (tested explicitly), muscle straps with tendon slots and directional fibre bump.
6. **Soft neutral lighting, restrained highlights** ✓.
7. **Smooth orbit, useful near-detail, live slicing** ✓ — demand rendering preserved; slice
   sweeps rebuild only caps (10-step keyboard sweep ≈ 1.0 s software-rendered).
8. **Generic boundary in every view** ✓ — unchanged copy, aria-label and figcaption (e2e).

Measured: Visualize lazy chunk 1.37 MB (includes the 0.8 MB model data) of the 12 MB cap;
standalone engine build 2.25 MB of 5 MB; initial JS unchanged at 81 KB. `npm run verify` clean
(570 unit tests, assets hash-verified, budgets hold); the 7 desktop engine e2e tests pass
serially — parallel SwiftShader contexts starve each other, which is a test-environment
accommodation, not an assertion change.

## Known gaps carried to phase 14/16

- The fundus close-up shows a sparse frond of real tree branches ~1.5–2.5 mm temporal of the
  fovea; tree- and FAV-correct, but at that scale the sparsity reads as a blemish. Recorded
  rather than hidden; candidate fixes are denser painting or gentler tube taper.
- The cut rim's choroid band still reads darker than the sclera/retina bands; material tuning,
  not geometry.
- Pupil disc and the painted pupil zone can show a faint double edge through the refractive
  cornea at some angles (physical refraction of the offset discs).
