# Phase 04 — Daily loop & mobile

> **Goal:** the entry that takes thirty seconds on a laptop takes fifteen on a phone, in bed.

## Why it matters

The record only exists if the daily entry actually happens — on the day, from wherever the person
is, often at night, often one-handed, often when their vision is at its worst. The current layout is
a fixed desktop sidebar shell. On a phone it is unusable, which means the habit never forms, which
means there is no record, which means none of the rest of the app has anything to work with.

## Preconditions

Phase 03 (type scale, targets, focus behaviour settle the layout constraints).

## Scope

```
app/src/App.tsx                     responsive shell, bottom nav
app/src/styles.css                  breakpoints, safe areas, sheet styles
app/src/components/Sheet.tsx        new — bottom sheet replacing modals on small screens
app/src/pages/Today.tsx             restructured entry flow
app/src/pages/WhatISee.tsx          touch drawing
app/src/components/QuickEntry.tsx   new
app/src/lib/streak.ts               new — continuity, stated calmly
e2e/                                new — Playwright
```

## Tasks

1. **Responsive shell.** Below 900 px: sidebar becomes a bottom tab bar (Today, Timeline, Draw,
   More) respecting `env(safe-area-inset-*)`; above it, the current shell. One layout, two
   arrangements — not a separate mobile app.

2. **Sheets instead of modals.** On small screens every modal becomes a bottom sheet with a drag
   handle, opening at a height that keeps the primary action above the keyboard. Focus trapping and
   restore from Phase 03 must survive the change.

3. **Recompose Today around the decision.** The first thing on screen is the question and two large
   targets: **"Nothing different today"** and **"Something changed"**. Nothing-different is one tap,
   done, with an undo affordance. Something-changed opens a progressive flow — eye → what → compared
   to your usual → (optional) severity, note, drawing — where every step after the second is
   skippable and the "save" button is reachable at all times.

4. **Repeat-yesterday and quick chips.** Offer the person's own recent patterns as one-tap chips
   ("Floaters — same as usual, left"), built from their history, never from a generic list. This is
   the single biggest reduction in daily friction.

5. **Touch drawing.** Pointer events with pressure where available, palm rejection (ignore touches
   with large radius while a stylus is active), pinch-zoom on the canvas, and undo/redo with a
   two-finger tap. The canvas must be usable at phone size — reconsider stroke sizes and the tool
   palette layout for thumbs.

6. **Continuity, stated calmly.** `streak.ts` computes "you have recorded 23 of the last 30 days"
   and shows it as a plain sentence in Today's footer. **No streak flames, no guilt, no
   notifications.** A missed day is not a failure; the copy must never imply it is.

7. **Time honesty.** Entries record local date and an explicit "recorded at" time. Support logging
   for *yesterday* explicitly ("this started last night") — the current flow silently assumes today,
   which corrupts onset dates, which corrupts the brief.

8. **E2E tests.** Playwright covering: fresh install → onboarding → nothing-different day →
   something-changed day with a drawing → search for it → generate a brief. Run on a mobile viewport
   (iPhone 13) and a desktop one, in CI.

## Acceptance criteria

- [ ] "Nothing different today" is one tap from a cold app open on a 390 px viewport, with the
      target ≥ 44 px and reachable in the thumb zone.
- [ ] The full something-changed flow with a drawing completes in ≤ 6 taps plus the drawing itself.
- [ ] Playwright specs pass on mobile and desktop viewports in CI.
- [ ] No horizontal scroll at 320 px width on any page.
- [ ] Backdating an entry to yesterday produces the correct onset date in the brief (asserted).
- [ ] Phase 03 criteria still hold on the new layout (re-run the axe and keyboard tests).

## Risks & non-goals

- **Not** a native app, and no push notifications. If reminders are wanted, they belong to the
  operating system's calendar, not to a health app that would then have to ask for notification
  permission and risk alarming someone.
- Quick chips must come from the user's own history. Suggesting symptoms they have not reported
  risks putting words in a patient's mouth, which corrupts the record.

## Agent brief

> Execute `docs/plan/phase-04-daily-loop-mobile.md`. Add a responsive shell with a bottom tab bar and
> safe-area handling, convert modals to bottom sheets on small screens, recompose Today around a
> two-target decision with a progressive optional flow, add history-derived quick chips, make the
> drawing canvas genuinely usable by touch with undo/redo, add calm continuity copy with no streak
> mechanics, support explicit backdating, and add Playwright E2E on mobile and desktop viewports.
> Re-run the Phase 03 accessibility gates against the new layout.
