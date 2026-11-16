# Phase 18 — Native dialog and popover

**State:** see `STATUS.md`. Source: the Modern Web Guidance audit in `docs/future.md`
(2026-11-16), guides `dialog`, `light-dismiss-a-dialog`, `prevent-page-scroll-under-modal-dialog`,
`animate-to-from-top-layer`, `menu`.

## Why

Five overlays are hand-built `role="dialog"` divs, each re-implementing what `<dialog>` +
`showModal()` gives natively: top layer, an inert page (including to screen readers' virtual
cursor, which a Tab trap never covered), Escape and the mobile back gesture, `::backdrop`.
The header menu hand-rolls light dismiss that `popover="auto"` provides. Less code that
re-implements the platform is less code that can drift from it.

## Scope

`app/src/components/ui.tsx` (`Modal`, `useDialogFocus`), `Sheet.tsx`, `CommandPalette.tsx`,
`Onboarding.tsx`, `Chrome.tsx` (`Popover`), `pages/Appointments.tsx` (`PresentMode`), `App.tsx`
(onboarding `inert`), overlay rules in `styles.css` and `print.css`, `src/test/setup.ts`, the
unit and e2e tests that touch dialogs, `docs/accessibility.md`.

Out of scope: dialog contents, copy, data, any non-negotiable.

## Tasks

1. One hook owns the native contract: open with `showModal()` on mount, `close()` on unmount,
   Escape/back through the `cancel` event, click-outside by pointer position (works in Safari,
   which has no `closedby`), focus into the dialog, focus back to the opener. Delete the manual
   Tab trap, Escape stack and `role`/`aria-modal`.
2. Move `Modal`, `Sheet`, `CommandPalette`, `Onboarding` and `PresentMode` onto it. The dialog
   element is the visible box; the dim moves to `::backdrop`. Tall dialogs scroll inside
   themselves. Scroll chaining stopped with `overscroll-behavior`, never a body lock.
3. Onboarding: no Escape (as now); drop the shell `inert` toggle, which `showModal()` replaces.
4. `PresentMode`: Escape still backs out of a zoom before leaving.
5. Entry animation with `@starting-style`, transforms only under
   `prefers-reduced-motion: no-preference` and not under `data-motion="reduced"`.
6. `Popover` → `popover="auto"` + `popovertarget`. Keep its current positioning (anchor
   positioning is Safari 27 only).
7. jsdom has no `showModal` or popover: add a minimal test shim that mirrors the browser
   contract, and keep the real-browser proof in Playwright.

## Acceptance criteria

- No `role="dialog"`, `aria-modal`, Tab-trap or body-overflow code remains in overlays.
- Keyboard: focus enters, Tab cannot leave, Escape closes (except onboarding), focus returns.
  Nested dialogs: Escape closes only the top one.
- Click outside closes `Modal`, `Sheet`, palette; not onboarding or the presentation view.
- Phone layout still a bottom sheet; four themes and largest text still fit.
- `npm run verify` clean; dialog-touching e2e specs pass on desktop and phone.
