# Phase 15 — the legacy explorer on the same model, as built

Date 2026-09-13. The 3D explorer tab's anatomical presentation is now the original
Blender-authored model, decoded from the same binary as the app through a thin adapter
(`app/src/engine/legacy/afterlight-model.ts`, esbuild-bundled into `EyeExplorer.html` as a
second generated block beside the iris block). The page's own embedded Three r160 builds the
geometry from the adapter's plain arrays — no Three instance crosses the boundary. The sync
script now maintains both marked blocks, and `verify:assets` fails on drift in either.

## What changed in the explorer

- Replaced by model structures: primitive globe layers (sclera/choroid/retina spheres), the
  capsule nerve and cylinder sheath, the capsule muscles, the ciliary torus, the sphere lens,
  the sphere-cap cornea, and the lathe iris. Bindings (`sclera`, `nerve`, `lensMesh`, …) survive
  so labels, conditions and the tour keep their references.
- The model is mirrored (`eyeRoot.scale.x = −1`) so its authored nasal disc lands on the
  explorer's cut side — matching the page's existing composition and condition anchors.
- The cut slider now drives real capped sections: the adapter rebuilds caps from the same
  decoded arrays the geometry came from, reusing the page's pale cut material; the mirrored
  frame means the cap plane constant negates.
- The decorative torus eyelids, lashes and caruncle are removed from the presentation (the dry-eye
  condition's label list no longer names the eyelid). The model's real tapered muscle straps
  ride the surface toggle from `outerGroup`.
- The retina's inner surface now carries the shared fundus painter (painted once, default
  parameters) — disc, macula and avascular zone as in the app; the old flat macula/fovea
  overlay discs are retired, while the colour-fx disc/cup remain for the glaucoma condition.
- The iris keeps this page's painted texture and colour switch — the model's iris UVs follow
  the same polar convention, so `#eyeColor` repaints the model iris directly.
- The tear-film material survives as the dry-eye animation carrier; the wet look itself is the
  model cornea's clearcoat.

## Regression matrix (desktop, this machine)

| Entry point | Result |
|---|---|
| Explorer loads offline, eye-colour switch, cut slider to 100% (e2e) | pass |
| App mobile Visualize journey (slice/cornea/retina, no remount) | pass |
| Default view: globe + painted iris + muscle straps | capture: explorer-default.png |
| Cut 40% / 100%: capped bowl, lens and nerve visible | captures explorer-cut-*.png |
| `npm run verify` (incl. asset-drift checks for both blocks) | pass; budgets hold |
| Standalone engine build | 2.25 MB / 5 MB, regenerated |

Recorded cosmetic gaps: the corneal deep-dive lab's thin marker rings now stand slightly off
the model cornea's profile and catch the light as dashed arcs; some label anchors (macula,
optic nerve) point at regions that moved with the model by up to a few millimetres. Both are
presentation polish, not anatomy or behaviour; both are visible only when hunting them.

Both viewers now show the same original anatomy from the same bytes, at the same level of the
visual contract.
