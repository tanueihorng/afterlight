# Translating Afterlight

Eye disease is not an English-speaking condition. Somebody reading about their own retina at 2am
should not have to do it in a second language.

Only English ships today. This page is how that changes.

---

## What is extracted, and what is not

Being honest about coverage, because a half-translated medical app is worse than an English one —
the half a person needs is never the half that was done.

**In `app/src/lib/locales/en.ts` and translatable now:**

- the app shell — navigation, search, the local-only footer;
- the daily loop on **Today**, which is the screen that matters most;
- provenance and eye labels, which appear on every record in the app;
- the urgent-care notice and the boundary statements in Settings.

**Not yet extracted** — still English literals in the page components:

- Timeline, My Eyes, Imaging & Documents, Checks, Appointments, Visualize, and the rest of Settings;
- the condition atlas (50 entries) and the condition profiles;
- the appointment brief and everything printed on it.

That is roughly the frame of the app translated and most of the content not. Extracting a page is
mechanical and welcome — see below.

**Deliberately not in the catalogue:** the boundary statements
(`SELF_TEST_BOUNDARY`, `GENERIC_MODEL_BOUNDARY`, `SIMULATION_BOUNDARY`,
`PATIENT_GENERATED_FOOTER`, `QR_BOUNDARY`, `OCR_BOUNDARY`) and the "I could not find that in your
stored records" sentence. They live beside the code that uses them, where `npm run guard` checks
them by name; moving them would silently disarm those checks.

A translator still gets them in one place. Run `npm run clinical-pack` and read §2 of
`docs/clinical-pack.md`, which is generated from the source.

## Adding a language

1. Copy `app/src/lib/locales/en.ts` to `app/src/lib/locales/<code>.ts`, using the
   [BCP 47](https://www.rfc-editor.org/rfc/rfc5646) tag — `pt`, `pt-BR`, `ar`, `zh-Hans`.
2. Translate the right-hand side of every entry. Leave the keys alone.
3. Register it in `app/src/lib/i18n.ts`:

   ```ts
   import { PT } from "./locales/pt";

   export const LOCALES: Locale[] = [
     EN_LOCALE,
     { id: "pt", label: "Português", messages: PT, dir: "ltr" },
   ];
   ```

   `label` is the language's own name for itself, because that is what a person scans a list for.
   Set `dir: "rtl"` for Arabic, Hebrew, Farsi and Urdu; the app sets the document direction from it.

4. `npm run verify`. The tests will tell you about missing keys, and an untranslated key falls
   through to English rather than showing you `today.nothing_different` on a screen.

## Rules for the words themselves

**The tone is a feature, not a style.** Plain language. No exclamation marks, no encouragement, no
cheerfulness, no marketing voice. Write as if you are sitting next to someone who is frightened and
tired, because you are.

**Nothing interprets.** A string may say what was recorded and what the app did. It may not say what
a symptom means, whether it is serious, or whether anything is improving or worsening. `npm run
guard` enforces this on every language, not only English.

**Do not soften the safety wording.** `safety.urgent` and `safety.settings_notice` tell someone to
contact a doctor. If your language has a gentler way of saying it, that gentler way is wrong.

**Do not translate acronyms into nothing.** OD, OS and OU are read by clinicians everywhere. Keep
them; translate the words around them.

**Placeholders stay.** `{eye}` in `"Eye: {eye}"` is replaced at runtime. Move it wherever your
grammar needs it, but do not rename or drop it.

**Dates and numbers.** Formatting lives in `lib/util.ts`, not in the catalogue. If your language
needs a different date order, change it there rather than trying to express it in a string.

## Clinical wording needs a clinical reviewer — in your language

This matters more than the rest of this page.

Anything describing an eye condition, explaining a home check, or telling someone to seek urgent
care must be reviewed by a clinician **who reads that language**. Not translated from a reviewed
English version and shipped — reviewed again.

Clinical vocabulary does not map one to one between languages, the threshold at which a patient is
told to seek care differs between health systems, and "urgent" does not mean the same thing
everywhere. A confidently mistranslated safety sentence is the most dangerous thing this project
could ship.

The process is the same as for English: generate the pack, send it, record the outcome in
`docs/clinical-review.md` with the language noted. A human accepts the review; an agent may not.

## What a good pull request looks like

- One language per pull request.
- The catalogue file, the registration in `i18n.ts`, and nothing else.
- A note on who reviewed the clinical strings, or a clear statement that they have not been reviewed
  yet — in which case the language can still be merged, with those keys left in English until it is.
- `npm run verify` green.

You do not need to be a developer. If the TypeScript part is a barrier, open an issue with the
translated text in it and someone will wire it up.
