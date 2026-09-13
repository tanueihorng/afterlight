# Eye asset pipeline

The eye combines **Blender-authored surface detail** with **interactive procedural anatomy**.
Blender 5.2 LTS was used for the first bake. Blender is required only to regenerate source assets;
the application builds and runs without it.

## Rebuild

From the repository root:

```sh
blender --background --python assets-src/build-eye.py
blender --background assets-src/eye.blend --python assets-src/preview-eye.py
cd app
npm run assets:embed
npm run verify
npm run build:standalone
```

`build-eye.py` reads the millimetre dimensions from `engine/anatomy/dimensions.ts`, constructs a
high-resolution iris sculpt and a polar-UV bake receiver, and uses Cycles selected-to-active
baking. The generated maps are neutral: tangent-space normals and a linear relief mask. Colour,
pupil size, surface-detail intensity, laterality and the entire fundus remain browser parameters.

`preview-eye.py` adds the full eye, cornea, lens, posterior bowl, camera and studio lighting to
`assets-src/eye.blend`. `eye-study.png` is a Cycles material study, **not a screenshot of the app**.
The render carries the same generic-model boundary as the browser. The source scene is editable;
it is not shipped as an immutable glTF eye, which would freeze the geometry used by the controls.

## Browser integration

`materials/iris-detail.ts` colours the neutral relief using the selected iris appearance.
The main renderer imports both PNGs inline in its lazy visualisation chunk. `assets:embed` bundles
the same painter, dimensions and PNGs into the root `EyeExplorer.html`. Its generated block has
explicit markers; edit the shared source rather than editing that block. `verify:assets` checks
both binary hashes and that the standalone embedded copy matches the source.

Both viewers retain their own interaction and condition logic. The main view uses damped,
on-continuous rendering and keyboard controls. The legacy explorer retains its existing tours,
condition views and layer controls. Their shared anterior dimensions provide an open limbus and
aspheric corneal surface, rather than a closed sphere enclosing the iris.

## Provenance and budgets

The self-authored maps and their SHA-256 hashes are listed in `assets-src/ASSETS.md`; no downloaded
photographs, models or environment maps are used. The source `.blend` stays outside the shipped
app. Two PNGs total approximately 710 KB before inlining. Both standalone viewers embed the bytes;
no network is needed to read their textures. The generated engine standalone retains its 5 MB
budget, and the application's initial-download budget remains enforced separately.

These are generic educational models. A material study is not clinical validation or a model of
a patient's eye. The clinical-review status is unchanged.
