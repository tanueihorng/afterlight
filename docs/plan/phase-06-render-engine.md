# Phase 06 — Visualization I: a realistic eye renderer

> **Goal:** replace the schematic explorer with an anatomically credible, photoreal-leaning eye
> that a patient recognises as *an eye*, and that a clinician does not wince at.

## Why it matters

"Show me what happened to my eye" is one of the most common things a patient wants and almost never
gets. The current `EyeExplorer.html` is a good teaching toy — a single 1 MB file with embedded
Three.js, hand-tuned meshes, and 9 scripted scenarios. It cannot carry the disease library of
Phase 07, cannot be tested, cannot be code-split, and does not look like a human eye.

This phase is the foundation: a real engine with real materials and real anatomy. Phase 07 fills it
with disease.

## Preconditions

Phase 02 (code splitting and lazy loading exist).

## Scope

```
app/src/engine/                     new — the renderer, framework-agnostic TypeScript
  core/                             scene, camera rig, renderer, post-processing
  anatomy/                          geometry builders (globe, cornea, iris, lens, retina, vessels)
  materials/                        PBR + custom shaders
  presets/                          camera and lighting presets
  index.ts                          public API used by React
app/src/components/EyeCanvas.tsx    new — React wrapper (mount, resize, dispose, a11y)
app/src/pages/Visualize.tsx         consume the engine
app/scripts/build-standalone.mjs    new — emit the offline single-file explorer
docs/engine.md                      new — architecture, conventions, how to add anatomy
```

## Architecture decisions (fixed — do not relitigate)

- **Three.js only.** Add `three` as a real dependency, pinned. No react-three-fiber: the engine
  stays framework-agnostic TypeScript with an imperative API, wrapped by one thin React component.
  This keeps it testable and keeps the standalone build possible.
- **The standalone offline file survives.** `EyeExplorer.html` remains a deliverable — a clinic PC
  with no internet is a real use case. It becomes a *build output* (`npm run build:standalone`),
  not a hand-maintained artefact. The current file is preserved at `docs/legacy/EyeExplorer.html`
  until parity is reached.
- **Anatomy in millimetres.** All geometry uses real ocular dimensions, scaled once at the scene
  root. Axial length 24.0 mm, corneal anterior radius 7.8 mm, posterior 6.5 mm, central thickness
  0.55 mm, limbal diameter 11.7 mm, anterior chamber depth 3.1 mm, lens 9.0 × 4.0 mm, pupil
  2–8 mm, optic disc 1.8 mm at ~15.5° nasal and 1.5° superior to the fovea, foveal avascular zone
  ~0.5 mm. Every builder documents its source dimension. Personalisation later scales these; the
  defaults are a normal adult eye.

## Tasks

1. **Engine skeleton.** `core/`: WebGL2 renderer with ACES Filmic tone mapping, sRGB output, an
   orbit rig with damped controls and framing presets, resize observer, context-loss recovery, and
   a strict `dispose()` that releases every geometry, material and texture. A memory-leak test
   mounts and unmounts the canvas 50 times and asserts no growth in `renderer.info`.

2. **Globe and sclera.** Sclera as a lathe/ellipsoid with correct asymmetry (not a sphere), a real
   limbal transition, and a material with: subsurface-ish forward scattering approximation, fine
   collagen-fibre normal detail, and a procedurally generated **episcleral vessel network** — a
   branching L-system baked to texture at load, with per-instance seed so no two rendered eyes are
   identical. Vessel density and redness must be parameterisable (Phase 07 needs injection/redness).

3. **Cornea.** Transparent, refractive material: IOR 1.376, thin-film specular highlight, Fresnel
   rim, subtle asphericity (Q ≈ −0.26). It must refract the iris behind it — the single strongest
   cue that a render is a real eye rather than a ball with a picture on it. Include the tear film as
   a separate thin, animated specular layer with a slow break-up cycle (this doubles as the dry-eye
   visualisation in Phase 07).

4. **Iris.** This is where realism is won or lost. Procedural generation, not a stock texture:
   - radial stromal fibres with per-fibre thickness and colour jitter;
   - the **collarette** ridge at ~1/3 radius, with distinct pupillary and ciliary zones;
   - Fuchs' **crypts** (irregular openings) and **radial furrows** near the periphery;
   - a pigmented **pupillary ruff** at the margin;
   - a **limbal ring** with adjustable darkness;
   - depth via parallax-occlusion or a real displaced mesh, so the iris has thickness under the
     refracting cornea;
   - colour as a physically motivated two-layer model (anterior stromal melanin density + posterior
     epithelium), so brown / hazel / green / blue / grey come from one parameter set rather than
     four swapped textures.
   - **Pupil**: animated constriction/dilation 2–8 mm, driven by a "light" control, with the correct
     nonlinear response curve. A pupil that reacts is the second-strongest realism cue.

5. **Lens, vitreous, chambers.** Crystalline lens with gradient-index shading and adjustable
   nuclear/cortical opacity (cataract, Phase 07). Vitreous as a volume with configurable particulate
   density and a posterior hyaloid surface that can detach (PVD) — the floaters the user actually
   experiences must be renderable here.

6. **Retina and fundus.** The interior must be viewable in two ways: cross-section, and a **fundus
   view** as an ophthalmoscope sees it. Build the fundus procedurally:
   - choroidal background with tessellation and adjustable pigmentation (fair → deeply pigmented);
   - RPE granularity;
   - the **vessel tree** grown by a branching algorithm from the disc — superotemporal,
     inferotemporal, superonasal, inferonasal arcades with correct arching around the macula,
     artery/vein pairing, vein/artery calibre ratio ~2:3, and light reflex stripes on arterioles;
   - optic disc with a real cup, rim tissue, and adjustable cup:disc ratio (glaucoma, Phase 07);
   - macula with xanthophyll pigment gradient, foveal reflex, and an avascular zone the vessel
     algorithm respects;
   - RNFL striations near the disc.
   Every parameter above must be a named, documented input — Phase 07 is built entirely out of them.

7. **Lighting and post.** Studio HDRI-style environment (generated, not fetched — no network),
   three-point key/fill/rim, plus a slit-lamp preset and an ophthalmoscope preset. Post chain:
   SSAO, bloom limited to the tear-film and corneal specular, subtle depth of field, optional film
   grain. Everything must remain legible with `prefers-reduced-motion` and glare-comfort mode
   (Phase 03) — provide a "reduce brightness" path that dims the render, not just the UI.

8. **Personalisation, honestly bounded.** The patient may set: iris colour parameters, limbal ring
   strength, scleral vessel density, fundus pigmentation, and which eye is shown — so the render
   resembles *their* eyes rather than a stock model. Optionally, an **iris photo** may be loaded to
   sample colour parameters only (processed entirely on-device, never stored as an image unless the
   patient explicitly saves it to their record). The result is a resemblance, and the UI must say
   so: **"Tuned to look like your eyes. Still a generic model — not your anatomy."**

9. **Performance and fallbacks.** Target 60 fps on a 2020 mid-range phone at the default preset.
   Quality tiers (low/medium/high) auto-selected from a capability probe and overridable. Textures
   generated at load into a cache keyed by parameters. If WebGL2 is unavailable, fall back to the
   Phase-07 2D SVG diagrams rather than a black box, and say why.

10. **Standalone build.** `build-standalone.mjs` bundles engine + a minimal UI + inlined Three.js
    into one HTML file, reproducing today's offline capability, with a size budget (≤ 3 MB) and a CI
    check that it opens and renders in a headless browser.

## Acceptance criteria

- [ ] Side-by-side with reference photographs of a human eye (include them in the PR), the render is
      recognisably an eye: refracted iris, correct limbus, visible stromal detail, plausible vessels.
- [ ] Pupil animates smoothly 2–8 mm; iris parameters produce the full natural colour range from one
      model.
- [ ] Fundus view produces anatomically plausible arcades that respect the avascular zone, with an
      adjustable cup:disc ratio, verified against reference images by a human reviewer.
- [ ] 60 fps at medium quality on a mid-range phone; documented frame timings for low/medium/high.
- [ ] Mount/unmount 50× with no GPU memory growth; context loss recovers without a reload.
- [ ] `npm run build:standalone` emits a ≤ 3 MB single file that renders offline in headless CI.
- [ ] The generic-model boundary is visible in every view, including fullscreen and screenshots.
- [ ] Lazy-loaded: opening any page other than Visualize does not download the engine chunk.

## Risks & non-goals

- **Realism raises the stakes on the disclaimer.** The more convincing the render, the easier it is
  for a patient to believe they are seeing their own retina. Every escalation in realism must be
  matched by clearer framing. This is not optional polish; it is the safety property of the phase.
- **Not** reconstructing anatomy from the patient's OCT or fundus images. That is a research project
  with a much higher evidence bar. Personalisation here is cosmetic parameter-matching only, and the
  copy must not blur that line.
- Do not fetch HDRIs, textures or models from a CDN. Everything generates locally or ships inlined.
- Scope discipline: this phase builds the *engine and the normal eye*. Disease belongs to Phase 07.

## Agent brief

> Execute `docs/plan/phase-06-render-engine.md`. Build a framework-agnostic Three.js engine under
> `app/src/engine/` with millimetre-accurate anatomy, a refractive cornea and animated tear film, a
> fully procedural iris (stroma, collarette, crypts, furrows, ruff, limbal ring, two-layer melanin
> colour model, reactive pupil), lens and vitreous with parameterised opacity and particulates, and
> a procedural fundus with an algorithmically grown vessel tree, adjustable cup:disc and macular
> pigment. Add locally generated lighting environments, a post chain, quality tiers with a
> capability probe, strict disposal, context-loss recovery, cosmetic personalisation with an
> explicit "not your anatomy" boundary, and a standalone single-file build. Include reference-photo
> comparisons and frame timings in the PR.
