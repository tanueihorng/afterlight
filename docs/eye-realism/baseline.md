# Eye realism baseline — phase 11

Recorded 2026-09-13 on branch `main` before any phase-11 edit. This is what the two Visualize
eye viewers actually looked like, and what the environment could do, when phases 11–16 started.

## Environment

| Item | Value |
|---|---|
| Branch | `main` (dirty checkout preserved; see below) |
| Node | v24.11.1 |
| Blender | 5.2.1 LTS (`blender --version`, build 2026-08-25) — installed by the previous session |
| App Three.js | `three@^0.180.0` (npm) |
| Legacy explorer Three.js | r160, embedded in `EyeExplorer.html` as a data-URL module |
| Baseline gate | `npm run verify` — **passed clean** (exit 0). Initial JS 81.0 KB / 120 KB; CSS 6.8 KB / 20 KB; lazy chunks 11, Visualize 850.2 KB; no third-party requests |

### Dirty checkout at start (recorded, not reset)

Modified: `EyeExplorer-engine.html`, `EyeExplorer.html`, `app/e2e/engine.spec.ts`,
`app/package.json`, `app/src/components/EyeCanvas.tsx`, `app/src/components/EyeStudio.tsx`,
`app/src/engine/core/scene.ts`, `app/src/engine/materials/textures.ts`,
`app/src/lib/locales/en.ts`, `assets-src/ASSETS.md`, `assets-src/build-eye.py`,
`docs/asset-pipeline.md`, `docs/engine.md`, `docs/plan/README.md`, `docs/plan/STATUS.md`.
Untracked from the prior eye session: `app/scripts/sync-eye-assets.mjs`,
`app/src/engine/anatomy/surface.ts` (+ test), `app/src/engine/assets/` (iris-normal.png,
iris-relief.png, manifest.json), `app/src/engine/materials/iris-detail.ts`,
`assets-src/eye.blend`, `assets-src/eye-study.png`, `assets-src/browser-eye.png`,
`assets-src/preview-eye.py`, and the phase-11..16 briefs plus this document set.
Untracked and **out of scope**: `docs/Afterlight-User-Stories-and-Technical-Spec.docx`, its
`.pdf`, and `scripts/` (predates this work; not committed by these phases).

The prior session's work — Blender iris bake (723 KB of PNGs), aspheric corneal geometry,
`anteriorSurface()`, the embedded-assets sync and its checks — is the foundation phases 12+ build
on. It is committed as the recorded baseline before phase-11 work begins, in its own commit.

## Asset/build commands in use

```sh
blender --background --python assets-src/build-eye.py          # iris bake (Cycles, selected→active)
blender --background assets-src/eye.blend --python assets-src/preview-eye.py   # study render
cd app && npm run assets:embed   # bundle shared painter + PNGs into EyeExplorer.html (marked block)
npm run verify                   # gate; includes verify:assets (hash + drift checks)
npm run build:standalone         # single-file engine explorer → EyeExplorer-engine.html
```

## Reference model

Target: [Eye Anatomy by MotionCow on Sketchfab](https://sketchfab.com/3d-models/eye-anatomy-5dac474887174eb78cb7ffce6bd9ce3a)
("Realistic cross-section of the Eye", ~64.9k triangles / 51.7k vertices, licence held by
MotionCow — a commercial asset; the user explicitly rejected buying or embedding it).

**Evidence gap:** the interactive Sketchfab viewer could not be inspected from this environment —
only the page metadata was readable. The visual target is therefore the written description in
`docs/plan/EYE-REALISM-HANDOFF.md` ("The user's request" and "Visual completion contract"),
plus the triangle count above as a complexity reference. No download was made and none is wanted.

## Baseline captures

Captured with `app/scripts/capture-eye-views.mjs --tag baseline` against the production build
(`vite preview --port 4173`), viewport 1280×800 @1x, Chromium with SwiftShader software GL.
Images in [captures/baseline/](captures/baseline/); machine-readable data in
[captures/baseline/capture-report.json](captures/baseline/capture-report.json).

Timings on this machine are **software-rendered and relative**: useful for comparing like with
like across phases on this same machine, not as device performance evidence. Measured: a 10-step
keyboard slice sweep on the app cross-section took 652 ms end-to-end (~65 ms/step, dominated by
the 60 ms scripted waits); the engine correctly stops rendering when settled — idle frames
sample 0 draw calls, which is the demand-render behaviour working.

### Assessment against the visual completion contract

**App viewer — The eye tab** (`app-eye-*.png`):

- *Whole eye*: a frontal white sphere with an iris. No scleral vessels visible at this exposure,
  no nerve, no muscles, no orbit. Reads as "a ball with a picture on it" — the exact failure the
  handoff names. Item 1 ✗.
- *Cross-section*: cutaway shows an orange retinal bowl with a few thin painted vessels and a
  visible white shell lip — the best thing here. But: one retinal surface, no choroidal band, no
  distinct layered cut edges; iris + lens float as a detached stack with a visible gap (item 1
  "nested floating spheres" ✗); shell cut edge is thin and the retinal surface meets it with no
  tissue band (item 2 ✗); lens is a plain scaled sphere, corneal bulge present but the
  iris–lens relationship is not readable (item 3 partial ✗); no vessels on the inner surface as
  geometry, nothing connecting to a disc — the disc is not modelled at all (item 4 ✗); no nerve,
  no muscles anywhere in the frame (item 5 ✗); lighting is soft and restrained (item 6 ~).
- *Cornea*: iris disc alone on a black field; the cornea itself is nearly invisible, so the view
  shows almost nothing of what it names (items 3, 7 ✗).
- *Retina*: the fundus painter flat-on — genuinely decent (arcades, avascular zone, disc). It is
  a painted sphere interior, not a bowl you can orbit into with attached vessel geometry (item 4
  partial).
- *Slice sweep*: open shells — clipping leaves hollow edges by design today (item 7 partial;
  the behaviour is smooth and does not remount, which phases 13–14 preserve).

**Legacy explorer tab** (`explorer-*.png`):

- *Default*: white sphere with skin-toned torus-crescent eyelids arching over and under —
  decorative, and they obscure the globe (Phase 15 must remove them from this presentation).
  Muscle capsules peek from behind the top lid. Frontal iris with a torus limbus.
- *Cut 40%*: the cut opens the right hemisphere onto a flat orange bowl. Floating in it: a pale
  capsule and pink curved shells — sliced-open torus/capsule fragments with hollow zero-thickness
  edges. This is the "nested floating spheres"/debris look (items 1–2 ✗).
- *Cut 100%*: fully open bowl; muscle capsules sliced lengthwise showing open hollow channels
  (unsealed clipping, items 2, 5 ✗); the optic nerve is a thin rod with a ball end — a capsule,
  not a shaped nerve with sheath (item 5 ✗); lens is a small sphere with a visible crescent gap
  from the iris (items 1, 3 ✗); single-surface bowl with no choroid/retinal distinction (item 2 ✗).
- What works and must be preserved: the condition scenarios (dry eye, abrasion, cataract,
  glaucoma, PVD/floaters, tear, detachment…), guided tour, diagnose flow, labels, keyboard
  shortcuts, accessible name, offline operation, and the boundary statement.

### Scorecard at baseline

| # Contract item | App | Explorer |
|---|---|---|
| 1 cohesive globe + retinal bowl | ✗ | ✗ |
| 2 distinct continuous cut edges, no holes | ✗ | ✗ |
| 3 corneal bulge + biconvex lens behind iris | partial | ✗ |
| 4 vessels attached to inner surface, tied to disc | ✗ | ✗ |
| 5 shaped nerve/sheath + tapered muscles | ✗ (absent) | ✗ (capsules) |
| 6 soft neutral lighting, restrained highlights | ~ | ~ |
| 7 smooth orbit, near-detail, live slicing | ~ | ~ |
| 8 generic boundary in every view | ✓ | ✓ |

## What Phase 11 hands to Phase 12

- The contract: [anatomy-contract.md](anatomy-contract.md) — structure IDs, dimensions with
  sources, section design, parameter ownership, shared-data path.
- Both viewers' integration points and condition hooks inventoried (in the contract).
- A reproducible capture command for every later comparison: `node scripts/capture-eye-views.mjs
  --tag <phase>` from `app/`, against `vite preview --port 4173`.
- Baseline GPU budget to stay honest about the 12 MB lazy / 5 MB standalone limits: Visualize
  chunk 850 KB today; iris PNGs 723 KB inlined; geometry data budget for phases 12–15 is set in
  the contract (≤ 2.5 MB base64 embedded), which keeps the standalone under its cap with margin.

**Not done in phase 11, deliberately:** no geometry was changed (read-only phase); per-frame
triangle/draw-call counts were sampled only where the demand renderer was still drawing — from
phase 13 the engine will expose its `renderer.info` through a small diagnostics accessor so the
number is exact rather than intercepted; phone-viewport captures belong to phase 16 per its brief.
