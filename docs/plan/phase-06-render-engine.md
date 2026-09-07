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
app/src/engine/assets/              new — committed baked assets + generated loader manifest
assets-src/eye.blend                new — the authoring file (source of truth for geometry)
assets-src/build-eye.py             new — headless bpy script: model, bake, export, report hashes
assets-src/ASSETS.md                new — asset manifest: origin, licence, hash, regeneration steps
app/scripts/verify-assets.mjs       new — hash check; fails if committed assets drifted from source
docs/engine.md                      new — architecture, conventions, how to add anatomy
docs/asset-pipeline.md              new — how to install Blender and regenerate assets
```

## Architecture decisions (fixed — do not relitigate)

- **Three.js only.** Add `three` as a real dependency, pinned. No react-three-fiber: the engine
  stays framework-agnostic TypeScript with an imperative API, wrapped by one thin React component.
  This keeps it testable and keeps the standalone build possible.
- **The standalone offline file survives.** `EyeExplorer.html` remains a deliverable — a clinic PC
  with no internet is a real use case. It becomes a *build output* (`npm run build:standalone`),
  not a hand-maintained artefact. The current file is preserved at `docs/legacy/EyeExplorer.html`
  until parity is reached.
- **Hybrid authoring: Blender for the sculptural, procedural for the parameterised.** This line is
  the architecture, and it is not negotiable per-feature:
  - **Blender owns** the base anatomy mesh (sclera, corneal bulge, limbal transition, lens,
    eyelids, caruncle) with clean topology and UVs, the baked detail maps (scleral collagen, iris
    stromal relief, crypts, furrows, limbal falloff — sculpted high-poly baked to
    normal/AO/curvature), and the Phase 07 procedure animations, which are scripted sequences
    rather than states.
  - **The engine owns** everything continuous: iris colour from the melanin model, pupil 2–8 mm,
    scleral vessel density, the fundus vessel tree, and every Phase 07 severity parameter
    (cup:disc, drusen load, detachment extent, cataract density). Baking a parameter is a bug —
    it produces a combinatorial explosion of assets and kills the severity slider, which is the
    most explanatory interaction in the app.
  - **The fundus is procedural, entirely.** Blender adds nothing to the retinal view, which is
    dominated by vessel growth and lesion layers. Do not model it.
- **Everything ships locally. Nothing is fetched at runtime.** Assets are bundled with the app,
  served from its own origin, and precached by the Phase 02 service worker. No CDN, no asset host,
  no lazy download from a remote. The app must render the eye with the network disabled, on first
  run, forever. This is non-negotiable #1, and it applies to bytes as much as to data.
- **Contributors do not need Blender.** Baked assets are committed. Blender is required only to
  *regenerate* them, and `verify-assets.mjs` proves the committed files still match the source.
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

10. **Blender asset pipeline (scripted, reproducible, offline).**
    - `assets-src/eye.blend` holds the authored geometry. `assets-src/build-eye.py` runs headless —
      `blender --background eye.blend --python build-eye.py` — and does the whole job: applies
      modifiers, bakes the high-poly detail to maps, decimates to the target tiers, exports glTF,
      compresses, and prints a hash for every output. Nothing in the pipeline may require a human
      clicking in the UI; an agent must be able to regenerate every byte.
    - **Formats:** geometry as `.glb` with Draco or meshopt compression; textures as KTX2/Basis
      with a WebP fallback for browsers without transcoder support. Bake at 2K, ship 2K for the
      high tier and 1K for medium.
    - **Tiers.** Three geometry/texture tiers matching the quality tiers in task 9. The capability
      probe picks one; the user can override.
    - **Licensing, recorded.** `assets-src/ASSETS.md` lists every asset with its origin, licence,
      author and hash. Self-authored or CC0 only — nothing with unclear provenance ships in a
      public medical repo, ever. An asset whose licence cannot be stated in one line is removed.
    - **Drift check.** `app/scripts/verify-assets.mjs` recomputes hashes of the committed assets
      against `ASSETS.md` and fails the build on a mismatch, so committed binaries can never
      silently diverge from their source. Runs in CI. Blender itself is **not** in CI — the check
      is a hash comparison, not a rebuild.
    - **Blender is optional for development.** `docs/asset-pipeline.md` explains installing Blender
      (4.x) and regenerating; everyone else just builds.

11. **Standalone build, still offline.** `build-standalone.mjs` bundles engine + a minimal UI +
    inlined Three.js into one HTML file that opens from a USB stick on a clinic PC with no
    internet — the capability today's `EyeExplorer.html` has, which must not be lost.
    - **Budgets, revised for baked assets:** the hosted/PWA build may ship up to **12 MB** of
      assets total (lazy-loaded with the Visualize chunk, precached by the service worker, never
      on the initial load). The **standalone single file stays ≤ 5 MB** and therefore uses the
      *low* tier: inlined 1K textures and decimated geometry, or fully procedural geometry where
      inlining would blow the budget. Reaching the budget by degrading the standalone tier is
      correct; reaching it by fetching assets at runtime is a failure.
    - CI check: the standalone file opens and renders in a headless browser **with the network
      blocked**, and stays under budget.

## Acceptance criteria

- [ ] Side-by-side with reference photographs of a human eye (include them in the PR), the render is
      recognisably an eye: refracted iris, correct limbus, visible stromal detail, plausible vessels.
- [ ] Pupil animates smoothly 2–8 mm; iris parameters produce the full natural colour range from one
      model.
- [ ] Fundus view produces anatomically plausible arcades that respect the avascular zone, with an
      adjustable cup:disc ratio, verified against reference images by a human reviewer.
- [ ] 60 fps at medium quality on a mid-range phone; documented frame timings for low/medium/high.
- [ ] Mount/unmount 50× with no GPU memory growth; context loss recovers without a reload.
- [ ] `npm run build:standalone` emits a ≤ 5 MB single file that renders in headless CI **with the
      network blocked**, from a `file://` path as well as over http.
- [ ] The hosted build renders the eye with DevTools set to offline, on a cold profile after the
      service worker has installed. Zero network requests to any third-party origin, verified with
      a screenshot of the network panel.
- [ ] `blender --background assets-src/eye.blend --python assets-src/build-eye.py` regenerates
      every committed asset, and `npm run verify:assets` passes on the result — run it and paste
      the hashes.
- [ ] `ASSETS.md` states origin, licence and author for every shipped asset; no asset lacks a line.
- [ ] Baked-detail comparison: side-by-side stills of procedural-only versus baked sclera and iris
      at the same camera, in the PR, so the realism gain is visible and the cost is justified.
- [ ] A fresh clone with no Blender installed builds, tests and runs the full renderer.
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
- **Baked assets can rot.** A committed `.glb` nobody can regenerate is dead weight and a licence
  risk. If the `.blend` and the script cannot reproduce it, it does not ship.
- **Blender is a real skill cost.** Keep the authored geometry deliberately minimal — the base
  globe and the detail bakes, nothing more. Every extra modelled feature is a thing that must be
  re-authored by hand later, whereas procedural anatomy is a parameter an agent can change.
- **Do not let assets creep onto the critical path.** They load with the Visualize chunk. If the
  daily loop ever waits on a texture, the phase has failed non-negotiable #7.
- Scope discipline: this phase builds the *engine and the normal eye*. Disease belongs to Phase 07.

## Agent brief

> Execute `docs/plan/phase-06-render-engine.md`. Build a framework-agnostic Three.js engine under
> `app/src/engine/` with millimetre-accurate anatomy, a refractive cornea and animated tear film, a
> fully procedural iris (stroma, collarette, crypts, furrows, ruff, limbal ring, two-layer melanin
> colour model, reactive pupil), lens and vitreous with parameterised opacity and particulates, and
> a procedural fundus with an algorithmically grown vessel tree, adjustable cup:disc and macular
> pigment. Add locally generated lighting environments, a post chain, quality tiers with a
> capability probe, strict disposal, context-loss recovery, cosmetic personalisation with an
> explicit "not your anatomy" boundary, and a standalone single-file build.
>
> Add the hybrid Blender track: `assets-src/eye.blend` plus a headless `bpy` script that models,
> bakes detail maps, decimates to three tiers, exports compressed glTF/KTX2 and reports hashes; a
> licence-complete `ASSETS.md`; and `verify-assets.mjs` wired into CI as a hash check (never a
> Blender rebuild). Blender owns the base mesh, the baked detail and the procedure animations only
> — iris colour, pupil, vessels, fundus and every severity parameter stay procedural. Everything
> ships locally: no runtime fetch, hosted assets ≤ 12 MB lazy-loaded behind the Visualize chunk,
> standalone single file ≤ 5 MB rendering with the network blocked. A clone without Blender must
> still build and run. Include reference-photo comparisons, procedural-vs-baked stills, frame
> timings and the asset hashes in the PR.
