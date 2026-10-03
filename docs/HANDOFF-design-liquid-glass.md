# Handoff — liquid-glass redesign and phone fixes

Branch: `design-liquid-glass` (branched from `phase-11-baseline-contract`).
Last commit: `647d8d1` "design: liquid glass redesign, three-colour themes, Today dashboard" — pushed
to `origin/design-liquid-glass`. No PR opened.

## Done and pushed (647d8d1)

- Liquid-glass design system in `app/src/styles.css`: glass tokens, drifting aura, Bricolage
  Grotesque + DM Sans bundled in `app/src/assets/fonts/` (OFL licences alongside), precached by
  `scripts/build-sw.mjs`.
- Shell (`App.tsx`, `components/Chrome.tsx`, `components/Icon.tsx`): top floating dock with sliding
  blob on desktop (5 routes + More popover), glass bottom tab bar on phones, Search / Ask /
  Appearance buttons in the header.
- Eight three-colour themes (`--accent-strong/-2/-3`, `data-accent`), light/dark, glass/solid
  (`solid_surfaces`); picker in the Appearance popover and Settings → Display. New optional
  `AppMeta` fields `accent`, `solid_surfaces` (no migration — optional prefs, same as `glare_comfort`).
- Today dashboard (`pages/Today.tsx`, `lib/dashboard.ts` + tests): greeting + mascot
  (`components/Lumi.tsx`, user-owned image `assets/mascot.webp`), compact shortcut pills, 14-day
  strip (missing days hatched and labelled), last acuity per eye with provenance, recent entries,
  next visit.
- Contrast tests extended to every theme colour (`lib/contrast.test.ts`).

## Phone-audit fixes 1–3 — done (second commit on this branch)

1. **Bottom tab bar at large text.** `applyPrefs` sets `data-text="large"` at type scale ≥ 1.25;
   the tab bar is flex with shrinkable tabs; at large text the tab labels and header brand name
   become visually hidden (still the accessible names) and icons grow. Test: `e2e/mobile.spec.ts`
   "keeps every tab on screen at every text size".
2. **3D explorer on phones** (`EyeExplorer.html`, repo root; synced to git-ignored `app/public/`).
   ≤1020px: `minmax(0,1fr)` column, wrapping top bar, `#rail{min-width:0}`; the closed guide fades
   in place (`opacity/visibility`, small vertical nudge) instead of waiting off the right edge;
   ≤640px: top-bar subtitle hidden, bottom dock wraps. Test: `e2e/mobile.spec.ts` "fits the 3D
   explorer to the screen, with no Diagnose tab".
3. **Diagnose tab removed inside the app** (breaks non-negotiable 3 — it ranks conditions from
   symptoms). `EMBEDDED = window.self !== window.top` removes the tab, hides `#tabDx`, relabels the
   toggle "📖 Guide", drops the D shortcut, skips `buildDiagnose()`. Standalone file unchanged
   (it still has the original display bug: `showTab` sets `style.display=''`, which falls back to
   `#tabDx{display:none}`). Test: `e2e/verify/visualize.spec.ts` (waits for the explorer to boot).

Also: `App.tsx` sets `data-scene="3d"` on the Visualize route, where the aura and glass blur are
switched off — re-blurring a live WebGL canvas every frame is expensive on slow devices.
`e2e/engine.spec.ts` "does not leak GPU resources" now opens Visualize through the dock's More menu.

### Known flaky, not a regression

Desktop `e2e/verify/visualize.spec.ts` tests intermittently time out waiting for a Visualize tab
button to be "stable". The pre-redesign commit `5816856` fails 4 of the same 6 tests the same way
on this machine (software WebGL in headless Chromium), so this predates the redesign.

## How to verify

`npm run verify` is blocked by a **pre-existing, unrelated** failure: `app/src/lib/store.ops.test.tsx`
(uncommitted work from before this branch) uses `React.useState` without importing React → tsc
error and 4 failing tests. Until that is fixed, run the gate by hand from `app/`:

```bash
node scripts/sync-explorer.mjs
npm run lint && npm run guard && npm run verify:assets && npm run changelog:check
npx vitest run            # expect only store.ops.test.tsx to fail
npx vite build && node scripts/build-sw.mjs && npm run bundle && npm run nonetwork
npx vite preview --port 4173 --strictPort   # separate terminal; playwright reuses it
npx playwright test e2e/mobile.spec.ts e2e/verify/visualize.spec.ts e2e/engine.spec.ts --workers=2
```

`playwright.config.ts`'s webServer runs `npm run build` (which runs tsc) and so cannot start while
the store.ops error exists — hence the manual preview server. `perf.bench.test.ts` flaked once
under load and passed on rerun.

## Do not commit with this work

These files were already modified before this session and belong to other work:
`app/e2e/{daily-loop,offline}.spec.ts`, `app/e2e/verify/{appointments,helpers,onboarding,persistence,self-tests,settings,timeline,today}.spec.ts`,
`app/playwright.config.ts`, `app/src/components/EyeCanvas.tsx`, `app/src/lib/{db.ts,store.tsx,store.ops.test.tsx}`,
`app/src/pages/TimelinePage.tsx`, `docs/plan/STATUS.md`, `docs/verification/{DEFECTS,VERIFICATION}.md`,
and the untracked debug/test files. Commit only files belonging to this redesign.

## Still open beyond fixes 1–3

- **Clinical review** (finding 4): `docs/clinical-review.md` is NOT REVIEWED; the explorer's Guide
  text gives emergency directions, reassurance ("one of the safest…operations") and surgery claims.
  Needs a clinician; the `clinical-copy-reviewer` agent can list the lines.
- Run the `a11y-auditor` agent on the redesign before opening a PR (CLAUDE.md asks for it).
- Mascot no longer blinks (raster image); redraw as SVG if wanted.
- A manual audit left one temporary DoctorQuestion in *that auditor's* browser data; the user
  deletes it in-app.
