# Eye asset pipeline

The eye combines **Blender-authored anatomy** with **interactive procedural detail**. Blender
5.2 LTS authors the full static model — sclera, cornea, iris, lens, ciliary body, zonules,
retina, choroid, optic nerve with sheath, and the four rectus muscles — and bakes neutral
surface detail. Blender is required only to regenerate source assets; the application builds
and runs without it.

## Rebuild

From the repository root:

```sh
cd app && node scripts/anatomy/export-anatomy-data.mjs   # params + vessel tree for Blender
blender --background --python assets-src/build-anatomy.py  # full model, export, renders
cd app && npm run verify                                  # includes the asset hash checks
npm run build:standalone
```

`export-anatomy-data.mjs` bundles `dimensions.ts` and writes `assets-src/generated/params.json`
plus the seeded vessel tree mapped onto the retina — Blender reads the same numbers the browser
uses, so there is no second anatomy table to drift.

`build-anatomy.py` executes the preserved iris-bake pipeline (`build-eye.py`) first, then authors
every static structure from `params.json`, validates topology (watertight solids, outward
winding, finite bounds), exports quantised grid vertices to
`app/src/engine/assets/anatomy.bin` + `anatomy.json`, renders four studies into
`assets-src/renders/`, and saves the editable `assets-src/eye.blend` with named collections
(Globe, Anterior, Retina, Nerve, Muscles, Vessels, Studio) and four cameras.

Every solid is assembled from regular grid patches whose shared border rows carry identical
coordinates, so wall thickness is real geometry and openings (limbus, scleral canal, disc) are
built into the grids — the browser regenerates indices from `rows × cols` and welds coincident
vertices by position. Colour, pupil size, vessel density, laterality and every condition delta
stay runtime parameters; nothing about severity is baked.

The generated maps are neutral: the iris bake's tangent-space normals and linear relief mask,
plus the model grids. The Cycles renders in `assets-src/renders/` are material studies for
structural review — **not screenshots of the app** — and carry the same generic-model boundary
as the browser.

## Browser integration

`engine/anatomy/model.ts` decodes the binary into plain typed arrays (no Three import), so the
app (Three r180) and the legacy explorer (embedded r160) each adapt the same data through their
own thin adapter — no Three instance crosses that boundary. `materials/iris-detail.ts` colours
the neutral relief from the live iris controls. `assets:embed` bundles the shared painter and
PNGs into the root `EyeExplorer.html` in a marked block; `verify:assets` checks both PNG hashes
and that the embedded copy matches the source.

## Provenance and budgets

The self-authored assets and their SHA-256 hashes are listed in `assets-src/ASSETS.md`; no
downloaded photographs, models or environment maps are used. The source `.blend` stays outside
the shipped app. Budgets measured at the phase-12 export: geometry data ~0.6 MB binary
(~0.8 MB inlined base64), iris PNGs ~0.7 MB, inside the 12 MB lazy renderer and 5 MB
standalone caps with room for Three itself. The application's initial-download budget remains
enforced separately.

These are generic educational models. A material study is not clinical validation or a model of
a patient's eye. The clinical-review status is unchanged.
