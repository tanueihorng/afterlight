# Phase 02 — Performance & scale

> **Goal:** ten years of daily entries, hundreds of drawings and a hundred scans, still instant.

## Why it matters

The value of this record compounds with time — which means the app gets slower exactly as it gets
more valuable. Today every page recomputes `toAllData(store)` and rebuilds the entire timeline on
every render, holds every blob thumbnail in memory, and ships the 1 MB 3D explorer inside the main
page load. That is fine at 200 records and unusable at 20,000.

## Preconditions

Phase 00 (tests), Phase 01 (schema stable).

## Scope

```
app/src/lib/store.tsx           selector-based store, memoised derivations
app/src/lib/indexes.ts          new — derived indexes (by date, eye, type)
app/src/lib/thumbs.ts           new — worker-based thumbnail pipeline
app/src/workers/image.worker.ts new
app/src/pages/TimelinePage.tsx  windowed rendering
app/src/pages/Imaging.tsx       lazy blob URLs, revocation
app/src/pages/Visualize.tsx     lazy-load the explorer
app/vite.config.ts              chunking, PWA
app/src/lib/perf.ts             new — dev-only timing helpers
```

## Tasks

1. **Stop rebuilding the world.** Replace the "whole store object" context with a store exposing
   stable slices plus `useSelector`-style subscription (either `useSyncExternalStore` or a tiny
   context-per-slice split). Memoise `buildTimeline` on a content hash of the entity lists, not on
   object identity. `toAllData` must not allocate a new object on every render.

2. **Derived indexes.** `indexes.ts` builds, once per data change:
   `byDate: Map<'YYYY-MM-DD', TimelineEvent[]>`, `symptomsByEye`, `symptomsByType`,
   `imagingByModality`, `firstSeen: Map<symptom_type+eye, iso>`. Search, ask, brief and timeline all
   read the indexes instead of scanning arrays. Keep the index build pure and tested.

3. **Windowed timeline.** Render only the visible day-groups plus a small overscan
   (`IntersectionObserver` or a minimal virtualiser — do not add a heavy dependency for this).
   Preserve: keyboard navigation, `Cmd+F` browser find on the loaded window, and a "jump to date"
   control that works without scrolling through everything.

4. **Image pipeline in a worker.** Move thumbnail generation, EXIF orientation handling and
   downscaling into `image.worker.ts` using `createImageBitmap` + `OffscreenCanvas`. Store
   thumbnails as compressed blobs (WebP where supported, JPEG fallback), not data URLs — data URLs
   in IndexedDB are ~33% larger and are parsed on every read. Migrate existing data-URL thumbnails
   in a Phase-01-style migration.

5. **Blob URL discipline.** Create object URLs lazily when an image enters the viewport and
   `URL.revokeObjectURL` on unmount. Add a dev-mode assertion that counts live object URLs and warns
   past a threshold — leaked blob URLs are the most likely memory bug here.

6. **Code splitting.** `React.lazy` the Visualize page and the 3D explorer, the drawing canvas, and
   the imaging comparison view. Target: initial JS ≤ 120 KB gzip, and the explorer loaded only when
   the user opens it. Configure `manualChunks` for React and the renderer.

7. **PWA / offline install.** Add a minimal service worker (Workbox or hand-rolled — precache the
   app shell, never cache user data) plus a manifest with maskable icons, so Afterlight installs to
   a phone home screen and opens offline. Show the install prompt only from Settings, never
   interrupt the daily loop.

8. **Perf budget in CI.** Fail the build if the initial JS bundle exceeds budget. Add a synthetic
   benchmark test: seed 20,000 symptoms, 500 drawings and 200 imaging records, then assert
   timeline build < 150 ms, search < 50 ms, brief generation < 100 ms on CI hardware.

## Acceptance criteria

- [ ] With the 20k-record synthetic dataset: Today, Timeline and Search all interact at ≥ 50 fps,
      and the timings above hold in the benchmark test.
- [ ] Initial JS ≤ 120 KB gzip; the explorer chunk loads only on `#/visualize`.
- [ ] Memory does not grow across 200 navigations between Imaging and Timeline (measure with the
      DevTools heap snapshot before/after; document the numbers in the PR).
- [ ] The app opens and records an entry with the network disabled, then still works after a reload.
- [ ] No functional regression: full test suite green, demo data unchanged.

## Risks & non-goals

- Do **not** introduce a state-management library. The store is small; the fix is memoisation and
  subscription granularity, not Redux.
- Virtualisation must not break screen-reader navigation or in-page find. If a virtualiser conflicts
  with Phase 03's requirements, Phase 03 wins — render more, not less.
- Service workers can serve stale app code. Version the cache and add an "update available, reload"
  affordance in Settings; never auto-reload mid-entry.

## Agent brief

> Execute `docs/plan/phase-02-performance.md`. Make the store selector-based and memoised, add
> derived indexes used by search/ask/brief/timeline, window the timeline, move image processing into
> a worker with blob thumbnails and strict object-URL lifecycle, code-split the explorer and canvas,
> add a PWA shell that never caches user data, and add a seeded 20k-record benchmark plus a bundle
> budget to CI. Report before/after numbers for bundle size, timeline build time and heap growth.
