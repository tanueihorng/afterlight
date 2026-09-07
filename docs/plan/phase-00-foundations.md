# Phase 00 — Foundations & guardrails

> **Goal:** make the codebase testable, lintable, and impossible to regress silently — before any
> feature phase touches it.

## Why it matters

Everything after this depends on being able to change the app without quietly breaking the record.
Today there is a typecheck and a build, and nothing else. A bug in `brief.ts` that mislabels a
symptom as "unchanged" when it got worse would ship without anything noticing. That is the class of
failure this project cannot afford.

## Preconditions

None. This is the first phase.

## Scope

```
app/package.json                    scripts, dev dependencies
app/vitest.config.ts                new
app/eslint.config.js                new
app/.prettierrc                     new
app/src/test/setup.ts               new
app/src/test/factories.ts           new — record builders for tests
app/src/lib/*.test.ts               new — unit tests
app/src/components/ErrorBoundary.tsx new
app/src/App.tsx                     wire error boundary
.github/workflows/ci.yml            new
docs/contributing.md                new
```

## Tasks

1. **Test runner.** Add `vitest` + `@testing-library/react` + `@testing-library/user-event` +
   `jsdom` + `fake-indexeddb`. Configure `vitest.config.ts` with the jsdom environment and
   `src/test/setup.ts` (jest-dom matchers, `fake-indexeddb/auto`).

2. **Test factories.** `src/test/factories.ts` exports builders for every entity —
   `aSymptom({...})`, `aDrawing({...})`, `anAppointment({...})`, `anAllData({...})` — with sane
   defaults so a test can state only what it cares about. Every factory fills `id`, `created_at`,
   `updated_at`, `eye`, `source_type` correctly.

3. **Unit tests for the engines** — the logic where a bug is invisible but consequential:
   - `brief.test.ts`: an entry that got worse never lands in `unchanged`; `improved` requires a
     real severity decrease; an empty period yields empty sections, not fabricated ones;
     `defaultBriefRange` picks the previous appointment, not the next one; per-eye separation never
     leaks (a left-eye symptom never appears under right).
   - `search.test.ts`: `parseQuery` handles `"Aug 2026"`, `"2026-08"`, `"left eye"`, `"OD"`, and
     bare years; eye filters never drop `both`; date filters never widen; scoring puts a title match
     above a body match; a query matching nothing returns `[]`, never everything.
   - `ask.test.ts`: every intent returns citations when it returns content; the not-found path
     returns exactly `NOT_FOUND` and `found: false`; no handler ever returns text that is not
     derived from the passed `AllData` (assert by passing empty data and asserting not-found for
     each intent).
   - `util.test.ts`: date helpers across month/year boundaries and DST.
   - `store.test.ts`: `buildTimeline` orders correctly, dedupes nothing it shouldn't, and preserves
     `source_type` on every derived event.

4. **Component smoke tests.** `Today`, `TimelinePage`, `Appointments` (brief view) render against
   the demo dataset without throwing, and render an empty store without throwing. The empty case is
   the one that breaks in practice.

5. **Linting.** ESLint flat config with `typescript-eslint`, `eslint-plugin-react-hooks`,
   `eslint-plugin-jsx-a11y` (a11y rules as errors, not warnings — see Phase 03). Prettier for
   formatting, 100 columns, matching the existing style. Fix all resulting violations; do not
   disable rules to make them pass without a comment explaining why.

6. **Error boundary.** `ErrorBoundary.tsx` wraps the routed page area. On a crash it shows a calm
   message, the route that failed, a "copy error details" button, and — critically — a
   **"Export my records"** button that runs the existing export path, so a rendering bug can never
   trap someone's data. It must not send anything anywhere.

7. **Scripts.** In `app/package.json`:
   ```json
   "lint": "eslint .",
   "test": "vitest run",
   "test:watch": "vitest",
   "verify": "tsc -b && npm run lint && npm run test && npm run build"
   ```

8. **CI.** `.github/workflows/ci.yml` — on push and PR: install, `npm run verify`, upload the
   built `dist/` as an artifact. Cache npm. Node 20.

9. **Contributing doc.** `docs/contributing.md`: how to run, how to test, the non-negotiables from
   the plan README restated in one paragraph, and the rule that clinical wording needs human review.

## Acceptance criteria

- [ ] `npm run verify` passes from a clean clone (`rm -rf node_modules && npm ci`).
- [ ] ≥ 40 tests, covering every exported function in `brief.ts`, `search.ts`, `ask.ts`, `util.ts`.
- [ ] Deliberately breaking one comparison in `brief.ts` (e.g. flipping a severity `<` to `>`)
      makes at least one test fail. Verify this by actually doing it, then reverting.
- [ ] Throwing inside a page component shows the error boundary, and the export button in it
      produces a valid JSON file.
- [ ] CI is green on a PR.
- [ ] Zero ESLint errors; every `eslint-disable` carries a reason.

## Risks & non-goals

- **Not** adding E2E/browser tests yet — Phase 04 adds Playwright once the mobile layout settles.
- **Not** refactoring app logic. If a test reveals a bug, fix the bug in the smallest possible
  change and note it in the PR; do not restructure.
- Watch for `fake-indexeddb` and blob handling: `StoredFile` holds real `Blob`s. Test the DB layer
  with small blobs and assert round-trip integrity.

## Agent brief

> Execute `docs/plan/phase-00-foundations.md` in the Afterlight repo. Add Vitest, Testing Library,
> ESLint (with jsx-a11y as errors), Prettier, test factories, unit tests for `brief.ts`,
> `search.ts`, `ask.ts`, `util.ts`, `store.ts`, component smoke tests, an error boundary with a
> data-export escape hatch, an `npm run verify` script, and GitHub Actions CI. Do not change app
> behaviour except to fix bugs the tests reveal — list any such fix in the PR description. Prove the
> tests bite by temporarily inverting a comparison in `brief.ts` and confirming a failure.
