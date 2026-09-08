# Accessibility

Afterlight is used by people with retinal detachments, macular disease, glaucoma, field loss,
glare sensitivity and acuity that changes from day to day. Accessibility here is not a compliance
exercise — it decides whether the app works at all for the people it was built for.

WCAG 2.2 AA is the floor. The target is: **usable at 300% zoom, with a small part of the visual
field, with a screen reader, one-handed, at 2am.**

## What is supported

**Text size.** Settings → Display offers Normal, Large, Larger and Largest (100–200%). This scales
the entire interface, and your browser's own zoom works on top of it. Every page has been checked
at 200% text with the viewport at 640px — equivalent to a 1280px window at 200% browser zoom —
with no horizontal scrolling and no clipped text.

**Contrast.** Four themes: Dark, Light, High contrast dark, High contrast light. Body text meets
4.5:1 in the standard themes and 7:1 (AAA) in the high-contrast ones; borders, focus rings and
diagram strokes meet 3:1 and 4.5:1 respectively. These ratios are computed from the real design
tokens by a test that fails the build, not judged by eye.

**Never colour alone.** Every badge carries its meaning as text — the eye ("Left (OS)"), the source
("Patient reported", "Clinician documented"), the status. Colour reinforces; it never carries the
meaning on its own.

**Keyboard.** Everything is reachable and operable without a mouse. A skip link jumps to the main
content. Focus is always visible, at 3px (4px in high contrast) and never removed. Dialogs take
focus when they open, keep Tab inside while they are open, close with Escape, and return focus to
whatever opened them. A test walks the full daily entry, opens dialogs and generates an appointment
brief using only the keyboard.

**Targets.** Every interactive control is at least 44×44px — larger than WCAG 2.5.8 requires,
because of who is using it.

**Screen readers.** Landmarks, headings in order, labelled controls, and polite announcements when
a record saves, a search returns results, or a brief is generated. Navigation labels stay in the
accessibility tree even when the sidebar collapses to icons.

**Drawings in words.** The "What I See" canvas is invisible to a screen reader, so every drawing
also exists as text: a summary ("Patient drawing of the Left (OS) field of view: 2 dots, 1 shadow")
and a mark-by-mark description ("small dark dot upper right, faint"). This is on the page for
everyone, not hidden — reading back what you drew is useful sighted too. Drawing is never required:
a written description in the notes field is a first-class entry.

**Motion and glare.** `prefers-reduced-motion` is honoured automatically. Settings adds an explicit
reduced-motion switch, a glare-comfort mode that lowers overall brightness (photophobia is common
after vitrectomy), and an option to dim scans and illustrations.

Preferences are stored in your record, so they survive an export and follow you to a new device.

## Known gaps

Written down rather than quietly omitted.

- **No end-to-end screen-reader test.** Automated audits (axe) run over every page, every dialog,
  all four themes and the largest text size, and a keyboard-only journey test runs in CI. Real
  VoiceOver and NVDA passes are done by hand and are not automated.
- **The 3D explorer is not accessible.** The Visualize page's WebGL explorer cannot be operated by
  keyboard or described to a screen reader. The 2D condition diagrams alongside it carry text
  descriptions, and the explorer is educational rather than part of your record, but this remains a
  real gap.
- **No voice entry.** It was considered and deliberately not shipped: the browser Speech API sends
  audio to a third-party service in most browsers, which would break the promise that nothing leaves
  your device. Your operating system's own dictation works in every text field in Afterlight and
  keeps that promise. If an on-device browser speech API becomes widely available, this changes.
- **Mobile layout is not finished.** The interface adapts down to a narrow window, but the phone
  experience is the subject of its own work (Phase 04 in `docs/plan/`).

## Reporting a barrier

If something here is unusable for you, please open an issue and say what you were trying to do and
what got in the way. Accessibility barriers are triaged ahead of features.
