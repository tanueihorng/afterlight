# Future enhancements

Ideas discussed but not planned. Nothing here is a commitment, and nothing here overrides the
non-negotiables in [`AGENTS.md`](../AGENTS.md). An idea moves out of this file when it becomes a
phase brief in [`plan/`](plan/README.md) or is rejected (record why).

Each entry: the idea, what was decided so far, what blocks it, and the open questions.

---

## AI assistant over the record (LLM "ask")

_Discussed 2026-10-01._

**Idea.** Let the user ask natural-language questions across their whole record ("when did the
distortion start, and what changed after the March appointment?"), including images and scanned
reports, with every answer citing the entries it came from.

**Decided so far.**

- **No fine-tuning.** Fine-tuning teaches style, not facts; the record changes daily; a tuned model
  cannot cite provenance and cannot forget a deleted entry. Use retrieval (or whole-record context)
  with a strong general model instead. Revisit LoRA only for a specific, repeatable failure that
  prompting and retrieval cannot fix.
- **Hosted API, not a local model.** The development Mac cannot run a capable local model.
- **Whole-record context before RAG.** One person's diary likely fits in a ~1M-token context. Send
  the record with prompt caching; add a search index only if the record outgrows it.
- **Must be multimodal** (photos, Amsler drawings, scanned reports, PDFs).

**Candidate models** (prices per 1M tokens, input / output, as researched 2026-10-01 — re-check
before building):

| Model | Price | Cached input | Inputs | Notes |
|---|---|---|---|---|
| GPT-6 Luna (OpenAI) | $0.10 / $0.50 | $0.01 | text, images | US-hosted; efficiency tier |
| DeepSeek V4.1 Flash | $0.15 / $0.60 off-peak (2× peak) | $0.003 | text, images | Open weights; first-party API in China |
| GLM-5.3 Flash (Zhipu) | $0.15 / $0.50 | $0.03 | text, images, video | Open weights; first-party API in China |
| Claude Sonnet 5.5 | $2 / $10 | $0.20 | text, images, PDF | US-hosted; stronger reasoning tier |
| Claude Haiku 4.5 | $1 / $5 | — | text, images, PDF | For bulk tagging / extraction |

At personal scale cost is negligible for all of them (~$0.002–0.05 per question with caching).
**Choose on data jurisdiction and answer accuracy, not price.** For DeepSeek / GLM, use a
non-China host of the open weights rather than the first-party API. Prefer providers with
zero-data-retention and no training on inputs.

**Blocked by.**

- **Non-negotiable 1 (local-first, no third-party requests).** Any hosted model sends health data
  off the device. Shipping this in the app requires rewriting that invariant first — e.g. an
  explicit, per-request opt-in that shows exactly what will be sent — plus a guard exception.
  Options considered: (a) stay non-LLM and improve `lib/ask.ts`; (b) opt-in AI with consent
  preview; (c) bring-your-own API key, device-to-provider, no Afterlight backend.
- **Non-negotiable 3 (no interpretation).** Model output must be constrained to organising and
  quoting the record, reviewed by `clinical-copy-reviewer`, and every claim must cite its source
  entry (non-negotiable 2).

**Next step when picked up.** Build a small eval: 10–20 real questions with known answers from an
exported record, run through each candidate (e.g. via one OpenRouter script), score date accuracy
and citation correctness. Pick the cheapest model that gets them right.

---

## Modern Web Guidance audit (native dialog, popover, theming)

_Discussed 2026-11-16._ Source: [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance)
(242 guides, read from a local clone; its `legacy-scan` CLI was not run).

**Idea.** Swap hand-built UI plumbing for platform features where the guides say the browser now
does it better, without breaking the non-negotiables.

**Found, worth doing (small, low risk).** _Done 2026-11-16: all three fixed, with tests._

- **Startup theme flash.** `index.html` ships `data-theme="dark"` and `theme-color #0a0e16`, but
  the default theme is `light` (`lib/prefs.ts`) and prefs apply only after IndexedDB loads, so
  first paint is dark and the browser chrome stays dark in every theme. Add
  `<meta name="color-scheme">`, match the HTML default to the real default, and update
  `theme-color` in `applyPrefs`. Guides: `dark-mode`, `browser-ui-theming`.
- **IME Enter bug.** The new-question input (`pages/Appointments.tsx:334`) saves on raw `Enter`,
  which also ends a CJK composition: half-typed text gets saved. Use a `<form>` submit or check
  `isComposing` / `keyCode === 229`. Guide: `ime-safe-enter-submit`.
- **Body scroll lock.** The presentation view sets `document.body.style.overflow = "hidden"`; the
  guide says use `overscroll-behavior: contain` on the dialog and its `::backdrop` instead. Guide:
  `prevent-page-scroll-under-modal-dialog`.

**Found, a phase of its own (structural).** _Became phase 18 (`docs/plan/phase-18-native-dialog.md`), 2026-11-16._

- **Native `<dialog>`.** Five overlays are hand-built `role="dialog"` divs with their own focus
  trap, Escape stack, focus return and `inert` toggling: `Modal` (`components/ui.tsx`), `Sheet`,
  `CommandPalette`, `Onboarding`, and the brief's presentation view. `showModal()` gives all of
  that natively plus top layer and `::backdrop`. `closedby="any"` has no Safari support, so keep
  a click-outside fallback. Touches a11y and keyboard tests; needs the `a11y-auditor`.
- **Native popover.** The header `Popover` (`components/Chrome.tsx`) hand-rolls outside-click and
  Escape. `popover="auto"` + `popovertarget` does it natively (Baseline 2025-01, iOS 18.3+).
  Keep the current absolute positioning: anchor positioning is only in Safari 27.
- **Overlay animation** with `@starting-style` + `transition-behavior: allow-discrete` once the
  above land. Guide: `animate-to-from-top-layer`.

**Minor.** _Done 2026-11-18._ Atlas and palette search aren't inside `<search>` (now
`role="search"`, named; React 18's types lack the element); `.quick` hides its scrollbar on
phones (now thin and themed); two duplicate `prefers-reduced-motion` blocks in `styles.css`
(one removed).

**Deliberately not adopted.** Temporal (no Safari), CSS anchor positioning (Safari 27 only),
`interestfor` tooltips and `popover="hint"` (Chromium/Firefox only), `ariaNotify()` (Baseline only
since 2026-09), `<meta name="text-scale">` (Chromium only; the app already has its own type scale
and leaves the root font size at 100%), WebMCP and built-in AI (non-negotiables 1 and 3),
passkeys (there are no accounts).

**Already in line with the guides.** Root `font-size: 100%` with a rem-based scale,
`:focus-visible`, per-theme `color-scheme`, reduced-motion handling, local (non-UTC) day keys, no
`innerHTML`, `text-wrap: balance`, `oklch`/`color-mix`.

**Open question.** There's no written browser-support policy. The guides assume "Baseline Widely
available" unless told otherwise. Decide the target (likely: current and previous iOS Safari) and
write it into `AGENTS.md`.

---

## Clinical-dashboard look in the eye app

_Discussed 2026-11-18._ The user asked for the "clinical dashboard" visual style (the vision
board behind the separate body dashboard) in the eye app, and explicitly **not** the AI
assistant or whole-body work.

**Done 2026-11-18** (phase 19 in the ledger): measurement cards, the trend chart with treatment
dates, and the two-column wide layout, at the top of My Eyes.

**Left, needs a decision or a clinician.**

- Small neutral captions under the acuity bar's ends ("larger letters" / "smaller letters") —
  the clinical-copy reviewer suggested them; held until a clinician confirms the bar direction.
- A big latest-number readout (the vision board's gauge): the cards already show the latest in
  large type; a gauge would add nothing a grade-free version can say.
- Eye hero with the clinician-named region, and a "what my clinician asked me to do" card: both
  need a model change and `record-integrity-reviewer`.

**Done 2026-11-18 (chore/a11y-small-fixes).** `.card-title` and `.badge` now use `--fs-sm`
(14px at 100%): a heading and a provenance badge carry meaning, so they are not small print. The
eye toggle's focus ring no longer spills past its pill (`.seg` padding follows `--focus-width`;
ring on the button's edge). On phones the four Today shortcuts sit 2×2 instead of in a row that
scrolled sideways.

**Small print audited 2026-11-18 (chore/small-print-audit).** Every other `--fs-xs` use was
checked against the rule that small print is for labels and captions only. Moved to `--fs-sm`
because they are content: the drawing disclaimer, Today's latest-acuity line and recent-entry
dates, the search hit's date and source, Ask's "Read as" and "Source", the brief's identifier and
section headings, and the QR card's text. Left as captions: menu and palette footers, the "esc"
hint, swatch names, page kickers, OD/OS beside a named eye, drawing-tool and dock labels (each
has an icon and a name), table column headers, atlas region tags, the 14-day strip's day numbers
and the visit tile's month (both repeated in text), and the shortcut hints (hidden on phones).

