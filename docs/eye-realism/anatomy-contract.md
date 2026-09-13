# Anatomy and asset contract — phase 11

The shared agreement between the Blender source scene, the app renderer (Three r180) and the
legacy explorer (Three r160). Phases 12–15 implement against this document; changes here are
contract changes and are recorded in `STATUS.md`.

## Units, axes, laterality

- **Millimetres everywhere in source data.** Scene units stay `mm(SCENE_SCALE = 10)` as today, so
  the globe is ~2.4 units across. The Blender scene works in millimetres (1 BU = 1 mm) and exports
  scene units.
- **Eye-local axes:** **+Z anterior** (corneal apex), **−Z posterior**, **+Y superior**, **+X
  nasal for a right eye** (mirrored for a left eye). The globe centre is the origin.
- **Laterality is a transform, not new geometry.** A left eye is `scale.x = −1` on the eye root;
  Three renders correct winding for negative determinant. Disc/fovea/vessel data are authored
  once, for a right eye. Export validators must assert disc nasal placement in this frame.
- **The default cutaway composition** matches the reference: corneal apex towards screen-right,
  optic nerve towards screen-left, cut plane vertical in view. With +Z anterior and the camera on
  the eye's temporal side, this is a fixed eye-root yaw (documented in
  [cameras.md](cameras.md) when phase 13 lands); it is a camera/root transform, never a rebuild.

## Structure IDs

Stable, lowercase, snake_case. These names appear as mesh names in the `.blend`, as keys in the
exported asset data, as `mesh.name` in both renderers, and in the picking/selection API. Renaming
one is a breaking contract change.

| ID | Solid? | Owner | Notes |
|---|---|---|---|
| `sclera` | yes | static | Outer ellipsoidal shell (24 × 23.5 × 23.0 mm) with corneal aperture (limbus Ø11.7) and posterior scleral canal (Ø ~1.9 mm). Thickness 1.0 mm posterior → 0.5 mm equator → ~0.4 mm approaching limbus. |
| `cornea` | yes | static | Anterior aspheric cap (R 7.8, Q −0.26) + posterior surface (R 6.5), 0.55 → 0.67 mm thick, rim joins the scleral aperture at the limbus. |
| `limbus_ring` | no | runtime overlay | Soft transition band (reuse existing ring; not a solid). |
| `iris` | yes | static mesh, runtime material | Annulus, Ø pupil margin → limbus, ~0.5 mm thick, polar UVs (see UV conventions). |
| `pupil` | no | runtime disc | Dark disc at the pupil aperture, scales with light. Kept as its own mesh so constriction stays a transform. |
| `lens` | yes | static | Biconvex: Ø 9 mm, thickness 4 mm, anterior R 10, posterior R 6, equator at the ciliary ring. |
| `ciliary_body` | yes | static | Triangular coronal cross-section revolved: from iris root to ora serrata (width ~5.9 mm nasal / 6.7 mm temporal — modelled as one ring at 6.0 mm). |
| `zonules` | no | runtime tubes | ~36 fibres, ciliary body → lens equator. Procedural curves, never baked. |
| `retina` | yes (thin) | static | Inner lining: ora serrata → disc margin, ~0.25 mm thick, inner surface carries the fundus painter by UV. |
| `choroid` | yes (thin) | static | Between retina and sclera, ora → canal, ~0.15 mm modelled (see magnification). |
| `optic_nerve` | yes | static | Core (Ø ~3.3 mm) + sheath (Ø ~4.6 mm) as separate meshes from the canal ~25 mm posteriorly with a gentle S-curve; both cut ends capped. |
| `muscle_superior` / `muscle_inferior` / `muscle_medial` / `muscle_lateral` | yes | static | Tapered straps: belly width ~10 mm, thickness ~3.8 mm, total ~40 mm from apex to insertion, tendon transition to a flattened insertion foot at the spiral of Tillaux. |
| `retinal_vessels` | no | runtime tubes | Grown at runtime by `anatomy/vessels.ts` (unchanged ownership), conformed to the retinal inner surface, clipped with the retina. |
| `vitreous` | optional | runtime | Very faint body hint for the explorer's existing vitreous condition; never opaque. |

`Generic` marker: every exported structure carries `GENERIC_MODEL_BOUNDARY` unchanged — it stays
exported from `engine/index.ts` in the app and from its embedded copy in the explorer.

## Dimensions added in phase 11, with sources

New measurements for phases 12–13. Anything not found is **unresolved** and is not invented.

| Constant (mm) | Value | Source |
|---|---|---|
| Rectus insertions from limbus (MR / IR / LR / SR) | 5.5 / 6.5 / 6.9 / 7.7 (classic spiral of Tillaux) | EyeWiki, *Extraocular Muscles* (MILS) — <https://eyewiki.org/Extraocular_Muscles>; cadaveric means 5.28 / 5.72 / 6.40 / 6.78 in Kim 2024, <https://pubmed.ncbi.nlm.nih.gov/38708857/> — classic values used, delta noted |
| Rectus belly width at insertion | ~10 (MR); LR ~9.2 | EyeWiki, *Extraocular Muscles* |
| Rectus belly thickness (ultrasound) | ~3.6–4.0 | J Med Assoc Thai 90:307 — <http://www.jmatonline.com/PDF/90-PB-307-312.pdf> |
| Rectus total length | ~40 (SR ~41.8) | Haładaj 2019, *Transl Vis Sci Technol* (PMC6954479) — <https://pmc.ncbi.nlm.nih.gov/articles/PMC6954479/> |
| Rectus tendon length | MR ~3.7–4.5, SR ~5.5, LR ~8.8 | Haładaj 2019 (PMC6954479); EyeWiki |
| Muscle cone apex / annulus of Zinn | just anterior to optic canal, ~on the nerve axis posteriorly | standard orbital anatomy (Radiopaedia, *Optic nerve*) |
| Optic nerve intraorbital length | ~25 | Radiopaedia, *Optic nerve* — <https://radiopaedia.org/articles/optic-nerve>; Kenhub |
| Optic nerve diameter (core) | 3–3.5 intraorbital; 1.6 at disc | Wikipedia *Optic nerve* summary of standard texts; disc Ø from existing `dimensions.ts` |
| Optic nerve sheath Ø (ultrasound ONSD) | ~5–6 at ~3 mm behind globe | PMC6851876, normal-measurements review — <https://pmc.ncbi.nlm.nih.gov/articles/PMC6851876/>; modelled 4.6 tapering to ~5 near globe per ONSD convention |
| Ora serrata from limbus (posterior arc) | ~5.75 nasal / ~6.50 temporal | EyeWiki, *Eye in Numbers* — <https://eyewiki.org/Eye_in_Numbers>; modelled as one ring at 6.1 |
| Ciliary body radial width | ~5.9 nasal / 6.7 temporal; pars plana 3.5–4 | Guedes 2024 (PMC11130848); Lincke 2020 (PMC8166736); EntoKey *The ciliary body* |
| Choroid thickness | 0.17–0.22 histologic; 0.26–0.36 subfoveal in vivo; ~0.11 at ora | Entezari 2018 (PMC5782455); Ding 2011 (IOVS) |
| Scleral canal (optic disc) Ø | ~1.9 | consistent with existing disc constants; not re-derived |

**Illustrative magnification (labelled, reversible):** retina 0.25 and choroid 0.15 mm are
thinner than a convincing cutaway edge reads at orbit distance. The contract adds a
`layerMagnification` factor (default ×3, range ×1–×4) applied to these two walls only, labelled
in the UI as illustrative. True scale remains available at ×1. Muscles/nerve/cornea/lens are
always true scale. This factor is a material-and-geometry build parameter, owned by the renderer,
never silently changed.

**Unresolved (do not invent):** per-muscle cross-section shape variation, zonule count/fanning
(standard texts give patterns, not trustworthy counts — ~36 is an illustrative choice, labelled),
vortex vein positions (omitted from v1; noted as a future addition, not silently absent).

## Geometry authoring and the shared data path

**Decision: Blender is the author of the static base surfaces; TypeScript is the author of
everything runtime-parameterised.** This is the same split the repo already uses for the iris
bake, extended to the whole model.

1. `app/scripts/anatomy/export-params.mjs` writes `assets-src/generated/params.json` from
   `dimensions.ts` (single source of numbers) + the new constants above.
2. `assets-src/build-anatomy.py` reads that JSON (never hand-copies numbers), authors every
   static structure in Blender, and exports:
   - `app/src/engine/assets/anatomy.bin` — per-structure quantised vertex data (int16 positions +
     per-structure bbox, int16 UVs), regular grid topology (rows × cols) so the browser generates
     indices and stride-LODs itself.
   - `app/src/engine/assets/anatomy.json` — manifest: structure IDs, grid dims, bbox scales,
     material slots, section descriptors (see below), byte offsets. Hashed in `ASSETS.md` and
     checked by `verify:assets`.
   - Baked detail maps (existing iris pair; new only where they earn their bytes at browser scale).
3. Runtime-owned geometry stays in TS: retinal vessels (seeded tree, severity-sensitive),
   zonule tubes, section caps, pupil disc. None of it may be baked into a frozen model.
4. **Both viewers consume the same decoded data.** The decoder (binary → Float32Array views) is
   plain TypeScript with no Three import, bundled by esbuild into `EyeExplorer.html`'s marked
   block (mechanism already proven by `sync-eye-assets.mjs`) and imported directly by the app.
   Each renderer converts arrays to its own THREE version's `BufferGeometry` through a thin
   adapter. **No THREE instance crosses the boundary** — the two Three versions (r160 vs r180)
   never share objects.
5. No runtime fetch: everything is import-inlined or embedded; `nonetwork` keeps checking the
   built output. Budgets: new embedded geometry ≤ 2.5 MB base64; the Visualize lazy chunk and
   the 5 MB standalone are re-measured every phase.

### Grid topology and UV conventions

- Every static surface is exported as a **regular grid**: `rows × cols`, `u = cols` direction
  (around the axis), `v = rows` (along the meridian). The browser builds indices from the two
  numbers — the binary carries none — and can build a coarser LOD by striding.
- **Iris UVs stay polar** (u = angle, v = radial pupil-margin → limbus) exactly as the existing
  painter expects; validated by test at export.
- Retina UVs follow the existing fundus-painter mapping (the painter's normalised disc/fovea
  coordinates, x mirrored for laterality at paint time, not at mesh level).
- Muscles carry `v` along the belly so a fibre-striation bake, if added, reads directionally;
  `u` across the width.

### Section (slice) design — how cut edges stay closed

- The cut plane is always `x = c` in eye-local space (today's plane, rotated with the eye root —
  unchanged).
- Each solid structure exports a **section descriptor**: `{ kind: "solid" | "shell", ... }` from
  which the browser regenerates a **cap mesh** whenever the slice value changes:
  - *Surfaces of revolution* (sclera, cornea, lens, retina, choroid, ciliary body): the cap is
    the analytic annulus/band between the outer and inner profiles' intersection loops at `x = c`,
    emitted as a quad strip with per-vertex normals in the plane. Tissue bands stay distinct
    because each layer emits its own cap with its own material.
  - *Offset tubes* (nerve core/sheath, muscles, zonules): cap = closed planar loop of the tube's
    cross-section at the plane (ellipse for oblique cuts, stadium for lengthwise cuts), as a
    triangulated fan/strip. A muscle sliced along its length shows a capped face, not an open
    channel.
  - *Runtime vessels* clip with the retina's own clipping plane (accepted for hair-thin tubes;
    the handoff allows this).
- Slice extremes and tangent cuts: when the plane leaves a structure's bbox the cap is removed
  and the structure is either whole (plane outside) or hidden (fully cut). Degenerate loops
  (|c| within one vertex of tangent) clamp to the tangent value. `slice = 0` shows the intact
  exterior; `slice = 1` opens the full hemisphere.
- Caps are rebuilt only for structures whose bbox the plane intersects, cached per quantised
  slice step, and disposed on change (tested — phase 13's acceptance explicitly covers repeated
  replacement/disposal).

### Material slots

Slot names are stable strings; each renderer maps them to its own material implementation:

` sclera_outer, sclera_cut, cornea_front, cornea_cut, iris_front, lens_body, lens_cut,
retina_inner, retina_cut, choroid_body, choroid_cut, nerve_core, nerve_sheath, nerve_cut,
muscle_belly, muscle_tendon, muscle_cut, zonule, vitreous `

Cut-face slots are desaturated/lighter variants of their tissue so the wall reads as a cut solid;
they are per-structure so the three-layer band (sclera/choroid/retina) stays distinct at the rim.

## Parameter ownership (what may never be frozen)

| Parameter | Owner | Acts on |
|---|---|---|
| Iris colour/melanin/warmth/limbal ring/fibre detail | runtime (`materials`) | iris material |
| Pupil diameter | runtime | `pupil` transform + iris texture |
| Fundus appearance, pigmentation, laterality | runtime (`fundus.ts`) | retina material |
| Vessel calibre/tortuosity/density/generations | runtime (`vessels.ts`) | `retinal_vessels` tubes |
| Scleral vessel redness | runtime (`textures.ts`) | sclera material |
| Condition deltas (all 50 atlas profiles) | runtime | parameters above only — no condition may swap or reshape static meshes |
| Slice, separation, layer visibility, magnification | runtime | transforms + caps + visibility |
| Light level | runtime | pupil + exposure |

Blender bakes **neutral** detail only: fine fibre/relief structure that does not encode colour,
severity, pupil size or laterality. The existing iris bake already follows this rule.

## Condition-hook mapping (legacy → replacement)

Every legacy explorer hook survives into the shared model:

| Legacy hook | Acts today on | Replacement |
|---|---|---|
| `fx.dry` dry-eye patches | separate patch meshes on cornea | same approach, repositioned onto exported `cornea` surface by ID |
| `fx.abras` abrasion | curve tube + sprite on cornea | unchanged, anchored to `cornea` |
| `fx.cat` cataract | lens material colour/opacity | `lens_body` slot |
| `fx.cup` glaucomatous cupping | disc `innerDisc` meshes | disc is part of the fundus painter + `retina` material; cup geometry becomes a shallow disc depression parameter on the painter (visual), not new meshes |
| `fx.flo` floaters | icosahedra group | unchanged (vitreous content, not anatomy) |
| `fx.tear` retinal tear | disc patch on bowl | anchored to `retina` inner surface by the painter's coordinates |
| `fx.det` detachment | dome mesh | unchanged approach; anchored to `retina` |
| `cut` slider + `CLIP[0]` | raw clipping planes | slice controls drive cap-generating sections (both viewers) |
| `K.surface` outer group toggle | `outerGroup` visibility | layer visibility keyed by contract IDs |
| tours/scenarios `cam`, `lab`, labels | camera + label anchors | re-anchored to structure IDs (phase 15 regression matrix) |
| app `ViewMode` ×4 | visibility lists | same four modes remapped to contract IDs; fundus mode stays the flat ophthalmoscopic view |

## Disposal ownership

- The **scene** owns and disposes: geometries it builds from shared arrays (per mount), runtime
  materials, textures, caps, environment. Unchanged from today's tested behaviour.
- The **decoder's output arrays** are immutable and may be shared across scene instances — they
  are module-level constants, never per-mount allocations, never mutated, never disposed.
- Caps and any buffer built per slice value are tracked and disposed on replacement; tests assert
  no growth across sweeps (phase 13).

## Comparison setup (used by every later phase)

- **Hardware context:** this machine, Chromium + SwiftShader software GL; timings are relative
  only. Phase 16 records whatever real hardware is available and marks the rest unverified.
- **Fixed cameras** (phase 13 implements; recorded here as the contract): default cutaway ¾
  temporal view per the composition rule above; exterior frontal; cornea close-up at the anterior
  segment bounds; retina close-up inside the bowl at the posterior pole. Exact values in
  `cameras.md` when they land.
- **Capture matrix:** both viewers × {default cutaway, exterior, cornea, retina, slice 0/.25/.5/
  .75/1, left eye, exploded} — phase 16 runs the full matrix; phases 12/13 capture their own
  subsets. Command: `node scripts/capture-eye-views.mjs --tag <phase>`.
- **Metrics recorded per phase:** per-frame draw calls + triangles (from the capture script's
  instrumented frame sampler during interaction), embedded asset bytes, standalone size, lazy
  chunk size, slice-sweep latency. `renderer.info` becomes an exact accessor in phase 13; until
  then the WebGL wrapper sampling stands.
