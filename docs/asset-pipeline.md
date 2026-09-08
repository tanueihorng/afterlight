# Asset pipeline

Afterlight's eye is **procedural today**: geometry, iris, sclera and fundus are all generated on
the device at runtime, and no binary assets ship. This document is for the next step — baking
sculpted detail in Blender — and for anyone who needs to know why the split is where it is.

## The line

**Blender owns what is sculptural and fixed:**

- the base anatomy mesh, with clean topology and UVs
- sculpted detail baked to normal / AO / curvature maps: scleral collagen, iris stromal relief,
  crypts, furrows, the limbal falloff
- Phase 07's procedure animations, which are scripted sequences rather than states

**The engine owns everything continuous:**

- iris colour from the melanin model, pupil diameter, scleral vessel density
- the entire fundus — vessel tree, cup:disc ratio, macular pigment
- every Phase 07 severity parameter

Baking a parameter is a bug, not a shortcut. It produces a combinatorial explosion of assets and
kills the severity slider, which is the single most explanatory interaction in the app. The fundus
in particular stays procedural: Blender adds nothing to a view that is dominated by vessel growth
and lesion layers.

## Running it

Blender 4.x is required, and **only** to regenerate assets. A clone without Blender builds, tests
and runs everything — that is a hard requirement, checked by CI.

```bash
blender --background assets-src/eye.blend --python assets-src/build-eye.py
cd app && npm run verify:assets
```

The script models, bakes, decimates to three tiers, exports compressed glTF, and prints a hash for
every output. Nothing in it needs a human clicking in the UI, because an agent has to be able to
reproduce every byte.

## Formats and budgets

| | |
|---|---|
| Geometry | `.glb`, Draco compressed |
| Textures | KTX2/Basis where the browser can transcode, WebP otherwise; baked at 2K, shipped 2K (high) and 1K (medium/low) |
| Hosted build | assets ≤ 12 MB total, lazy-loaded behind the Visualize chunk, never on initial load |
| Standalone file | ≤ 5 MB, low tier, inlined, must render with the network blocked |

Everything ships locally. Nothing is fetched at runtime — not from a CDN, not from an asset host,
not lazily from a remote. That is non-negotiable #1 applied to bytes.

## Licensing

Self-authored or CC0 only. Every asset is listed in `assets-src/ASSETS.md` with its origin, author,
licence and hash, and `npm run verify:assets` fails the build if a committed file has drifted from
its manifest entry or has no licence line. An asset whose licence cannot be stated in one line is
removed.

## Current state

**No assets have been baked.** The pipeline is written and scripted but has never been run:
Blender was not installed on the machine where Phase 06 was built. The engine is fully procedural
in the meantime, which is a working state rather than a placeholder — the realism gain from baked
detail is real but incremental, and should be judged with a side-by-side comparison in the PR that
introduces it, as Phase 06's acceptance criteria require.
