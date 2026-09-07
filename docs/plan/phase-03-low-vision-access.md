# Phase 03 — Accessibility for low vision

> **Goal:** the app must be usable by someone whose vision is the reason they are using it.

## Why it matters

This is the phase that decides who Afterlight is for. Its users have retinal detachments, macular
disease, field loss, glare sensitivity and fluctuating acuity. A "beautiful, restrained" interface
with 0.82 rem muted grey labels is unusable for a meaningful fraction of them — including its
author on a bad day. Accessibility here is not compliance. It is the product working at all.

Treat WCAG 2.2 AA as the floor, not the target. The target is: **usable at 300% zoom, with 3% of
the visual field, with a screen reader, one-handed, at 2am.**

## Preconditions

Phase 00 (jsx-a11y lint as errors).

## Scope

```
app/src/styles.css                      type scale, contrast themes, focus, targets
app/src/lib/prefs.ts                    new — accessibility preferences
app/src/components/A11ySettings.tsx     new
app/src/components/VoiceEntry.tsx       new — optional speech input
app/src/components/*                    focus management, labels, live regions
app/src/pages/*                         heading order, landmarks, skip links
app/src/test/a11y.test.tsx              new — automated audits
docs/accessibility.md                   new — stated commitments
```

## Tasks

1. **Fluid type scale.** Replace hard-coded `rem` sizes with a token scale
   (`--fs-xs … --fs-3xl`) driven by a user-set base size (100 / 125 / 150 / 200%) stored in prefs
   and applied on `:root`. Nothing below `--fs-sm` (0.875 rem at 100%) may carry meaning; the muted
   `0.72 rem` badges and captions in the current UI must be re-tiered. Layout must survive 200% base
   plus 200% browser zoom without horizontal scrolling or clipped text (WCAG 1.4.10 reflow).

2. **Contrast themes.** Ship four: Dark (current), Light (current), **High contrast dark**, **High
   contrast light**. All body text ≥ 7:1 (AAA) in the high-contrast themes and ≥ 4.5:1 everywhere
   else; all non-text UI (borders, focus rings, chart strokes, eye-panel accents) ≥ 3:1. Write a
   contrast test that walks the token pairs and fails the build on a violation — do not eyeball it.

3. **Never colour alone.** Audit every place meaning is carried by hue: the right/left eye panels,
   source badges, status badges, the retina diagram's alert stroke, brief sections. Each needs a
   shape, icon, label or pattern as well. Someone with colour vision changes after retinal disease
   must lose nothing.

4. **Focus and targets.** Visible focus ring ≥ 3:1 against both the element and its background, on
   every interactive element, never removed. Minimum target 44×44 CSS px (WCAG 2.5.8 is 24, but the
   audience justifies 44). Fix the current `minHeight: 28–32` buttons.

5. **Screen-reader completeness.** Landmarks (`banner`, `navigation`, `main`), a skip link, correct
   heading order per page, `aria-current` on nav, labelled form controls with described errors,
   `aria-live="polite"` announcements for save/search-result-count/brief-generated, and focus moved
   to the dialog on open and restored on close. The drawing canvas needs a genuine alternative: an
   accessible text description of every mark ("small dark dot, upper-left quadrant") plus a
   non-drawing way to record the same information.

6. **Reduced motion & glare comfort.** Honour `prefers-reduced-motion`. Add prefs for reduced
   motion, dimmed imagery, and a **glare-comfort** mode that lowers maximum luminance and disables
   large bright surfaces — for photophobia, which is common post-vitrectomy.

7. **Voice entry (optional, local).** `VoiceEntry` uses the Web Speech API where available for the
   free-text description fields only. Must be explicitly opt-in, clearly labelled as using the
   browser's speech engine (**which may process audio off-device — state this plainly**), and fully
   removable. Never the only way to do anything.

8. **Automated audits.** `vitest-axe` (or `axe-core` directly) over every page and every modal, at
   default and 200% base size, in all four themes. Zero violations, no exceptions list. Add a
   keyboard-only integration test that completes the full daily entry, opens the palette, runs a
   search, and generates a brief without a single mouse event.

9. **Accessibility statement.** `docs/accessibility.md` — what is supported, what is known-broken,
   and how to report a barrier. Link it from Settings.

## Acceptance criteria

- [ ] Zero axe violations across all pages, modals, themes and both type extremes.
- [ ] Keyboard-only test completes daily entry → search → brief.
- [ ] Contrast token test passes at AAA for high-contrast themes, AA elsewhere.
- [ ] At 200% base type + 200% browser zoom on a 1280×720 viewport: no horizontal scroll, no
      clipped or overlapping text on any page.
- [ ] Every interactive target ≥ 44×44 px (assert in a test that walks rendered elements).
- [ ] Screen-reader pass (VoiceOver on macOS/iOS, NVDA on Windows) documented in the PR: every
      page's purpose, every form's state, and the drawing's content are all conveyed.
- [ ] `prefers-reduced-motion` disables all non-essential animation.

## Risks & non-goals

- The visual identity must survive this. High contrast is an additional theme, not a replacement for
  the calm default. Resist flattening everything to black-on-white.
- Voice entry has a genuine privacy cost (cloud speech engines). If that cannot be stated honestly
  in one sentence in the UI, ship the phase without it.
- Do **not** add an accessibility overlay widget. They are harmful; build the real thing.

## Agent brief

> Execute `docs/plan/phase-03-low-vision-access.md`. Introduce a user-scalable type scale, four
> themes including two high-contrast ones with an automated contrast test, remove all
> colour-only meaning, enforce 44 px targets and visible focus, complete screen-reader semantics
> including a real text alternative for the drawing canvas, honour reduced motion, add glare-comfort
> and dimmed-imagery preferences, wire axe audits and a keyboard-only end-to-end test into CI, and
> write `docs/accessibility.md`. Report the manual VoiceOver/NVDA findings in the PR.
