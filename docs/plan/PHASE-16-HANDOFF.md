# Phase 16 handoff — where things stand and what remains

Written 2026-09-13 when the session paused, mid-phase-16. Phases 11–15 are **implemented,
verified and committed** on branch `phase-11-baseline-contract` (one commit per phase). Phase 16
is started but not finished. Read `AGENTS.md`, `docs/plan/EYE-REALISM-HANDOFF.md`, then
`docs/eye-realism/` — baseline.md, anatomy-contract.md, phase-12-blender.md,
phase-13-browser.md, phase-15-explorer.md are the evidence trail.

## Remaining work (in order)

1. **Final captures.** The `captures/final/` set was deleted: the first attempt captured stale
   compositor frames (SwiftShader was starved — the dev machine was under load, ~1 frame/s) and
   then mis-located clips after `focus()` scrolled the page. Retake with:
   `cd app && (npx vite preview --port 4173 --strictPort &)`, then a Playwright script that
   `scrollIntoViewIfNeeded()`s the canvas before **every** `canvas.screenshot()` (element shots
   with 20s+ timeouts and a retry loop; viewport clips go stale once anything scrolls).
   Needed set: both viewers × {default cutaway, exterior, cornea, retina, exploded, after-reset},
   app slice positions 0/.25/.5/.75/100 (drive the slider with `evaluate` + `input` event),
   left-eye cross-section (toggle "Left (OS)"), and an explorer cut at 40/100 for parity.
   Compare each against `captures/baseline/` and `captures/phase13..15/`.
2. **`docs/eye-realism/acceptance.md`** — the phase-16 deliverable: every item of the visual
   completion contract (handoff §Visual completion contract, items 1–8) assessed explicitly per
   viewer with capture links, plus measured facts: initial JS 81.2 KB / 120 KB; Visualize lazy
   chunk ~1.37 MB of 12 MB; standalone 2.26 MB of 5 MB; slice sweep ~1.0 s / 10 steps keyboard;
   triangles ~518k per frame in cross-section (from the capture script's GPU sampler). Hardware
   context: one machine, Chromium + SwiftShader **software** GL — record all timing as relative;
   phone-frame captures via the `mobile` Playwright project if attempted, and mark real-device
   performance **unverified** (no handset was available; that gap is expected and must be stated).
3. **Full `npm run e2e`** from `app/` for the final record. Known state: the engine suite is
   serialised and retry-tolerant; it passed fully twice and flaked in other runs on screenshot
   stability under memory pressure — every test also passes solo. Record actual outcomes
   honestly; do not weaken assertions to get green. Explorer offline e2e and the mobile
   journey passed at phase 15.
4. **Uncommitted:** `EyeExplorer-engine.html` (regenerated standalone, 2.26 MB — commit it with
   phase 16). Nothing else in `app/` or `docs/` is dirty.
5. **STATUS.md**: mark phase 16 done only when its criteria hold; list what did not (real-device
   perf, anything else).
6. **Commit** as `phase-16: …`. **Do NOT commit** `docs/Afterlight-User-Stories-and-`
   `Technical-Spec.docx/.pdf` or root `scripts/` — they predate this work and the handoff says
   to leave them untracked. (`git add -A -- app docs` sweeps the docx/pdf in — unstage them,
   this bit twice.)
7. Do **not** publish, do **not** run `npm run release` (clinical review is deliberately NOT
   REVIEWED), do not mark clinical copy approved. The fifteen structure descriptions and all
   atlas copy remain awaiting sign-off in `docs/atlas-review.md`.

## Known cosmetic gaps (recorded, not hidden)

- App fundus close-up: a sparse frond of real vessel-tree branches ~1.5–2.5 mm temporal of the
  fovea reads slightly knotted at zoom (tree- and FAV-correct; candidate fix: denser painting or
  gentler taper).
- Choroid cut band reads darker than the sclera/retina bands at the rim (material tuning).
- Faint pupil double edge visible through the refractive cornea at some angles.
- Explorer: corneal deep-dive lab marker rings stand off the model cornea and catch light as
  dashed arcs; a few label anchors (macula, optic nerve) drift up to a few mm from the model's
  moved anatomy.

## Environment gotchas learned the hard way

- `vite preview` serves `dist/` — after touching `EyeExplorer.html` (root) you must run
  `node scripts/sync-explorer.mjs` **and** `npm run build` before captures/e2e see it.
- Playwright's `webServer` reuses an already-running server: kill `vite preview` or you test the
  stale build.
- The engine e2e suite is `serial` on purpose; parallel SwiftShader contexts starve past the
  canvas waits. Screenshot assertions retry; keep it that way.
- vitest cannot serve `*.bin?inline` — the model ships as generated `anatomy-data.ts`
  (data-URL module); don't reintroduce the binary import.
- The full Blender rebuild is `blender --background --python assets-src/build-anatomy.py` after
  `node scripts/anatomy/export-anatomy-data.mjs`; it takes minutes and rewrites the iris bake
  (re-run `npm run assets:embed` if `verify:assets` complains about drift).
- When the machine is loaded (the agent harness itself takes ~70% CPU), SwiftShader screenshots
  starve — captures taken under load show repeated stale frames. Prefer quiet-machine runs.

## Second pause (2026-09-13, 22:0x)

- Added `app/scripts/capture-eye-final.mjs` (uncommitted): settle-checked captures for both
  viewers on desktop and phone, plus idle/interaction frame timing, reduced motion, standalone
  files opened offline, and an offline reload of Visualize after installation. Run it with
  `npx vite preview --port 4173 --strictPort` up; it writes `docs/eye-realism/captures/final/`.
  It was stopped after 4 of its shots (exterior/cutaway/cornea/retina, desktop app) — rerun
  it fully; the partial set is not evidence yet.
- `docs/engine.md` and `docs/asset-pipeline.md` updated (layout, slice modes, rebuild order,
  parameter ownership); measured-limits section still to add from the capture report.
- Found while inspecting: the default cutaway still shows the sliced muscle straps as open pink
  sheets/shards at the cut and a pink cylinder crossing the vitreous — identical in
  `captures/phase13/app-eye-cross_section.png`, so not a regression, but it bears on contract
  items 1, 2 and 5 and must be assessed honestly (likely a phase-13-owned fix: cap or hide
  muscle sections, identify the cylinder).
- The lazy 12 MB renderer cap is reported but not enforced by `check-bundle.mjs` (Visualize
  chunk 1.37 MB gzip / 2.41 MB raw). Note it in the acceptance report.
