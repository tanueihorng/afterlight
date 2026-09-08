# Text recognition (OCR)

**Nothing is bundled, and Afterlight will never download it for you.** This page explains why, and
how to add a recogniser yourself if you want one.

---

## Why it is not included

Phase 09 called for optional on-device OCR via Tesseract WASM. The pipeline is built — the
extraction seam, the suggestion parsing, the confirm-before-it-counts rule, and the tests around
all of it. What is not here is the engine.

Two reasons, both of which are the non-negotiables doing their job:

1. **Fetching it at runtime breaks the first rule.** Tesseract's WASM build and its language data
   normally arrive from a CDN on first use. That is a third-party request carrying, at minimum, the
   fact that this person is using this app. `npm run guard` fails the build on any such request, and
   it should.

2. **Bundling it costs about ten megabytes.** The WASM core is around 4 MB and the English
   training data 4–11 MB depending on the variant. That is more than the entire rest of the app,
   committed to a public repository, for a feature most people will not use — and it would have to
   be reviewed and licence-audited like any other shipped asset.

So the app says "text recognition is not installed on this device", which is true, rather than
offering a button that quietly reaches for someone else's server.

## What you get without it

More than you might expect. The fast path through a stack of clinic paperwork does not need OCR:

- multi-file drop, with each file's date, laterality, modality and document type read from its
  **filename**;
- **PDF** page count and creation date read from the file structure;
- **DICOM** study date, modality, laterality, institution and — where the pixel data is an
  encapsulated JPEG — the image itself;
- batch controls to set the eye or confirm every row at once.

Every one of those is a _suggestion_ shown in an editable field with a note saying where it came
from. An ambiguous date like `04-09-2026` is offered as both readings and never resolved by
guessing a locale.

## Adding a recogniser

`app/src/lib/ingest.ts` exposes a seam:

```ts
export interface TextRecogniser {
  name: string;
  recognise(
    bytes: ArrayBuffer,
    mime: string,
  ): Promise<{ text: string; confidence: number }>;
}

registerRecogniser(myRecogniser);
```

Register one at startup and the "Read the text" button appears on every row of the ingestion
screen, labelled with your recogniser's name.

Whatever you register must hold to the same rules the rest of the app does:

- **On device.** No network request, at install time or at run time. If your recogniser fetches a
  model, provision it as a local asset and load it from disk.
- **Local assets only.** Put the WASM and language data under `app/public/` and load them by
  relative path. Add them to `assets-src/ASSETS.md` with their licence, as the Blender assets are.
- **Never confirmed.** `extractFromDocument` always returns `source_type: "document_extracted"` and
  `confirmed: false`. That is enforced by a check in `scripts/check-invariants.mjs`, which fails
  the build on a bare `confirmed: true` anywhere in the ingestion path. Do not work around it: an
  unconfirmed extraction is deliberately excluded from the appointment brief, and that exclusion is
  the whole safety property.

## What recognised text is used for

Only to fill in fields the person then checks: a date, a clinic name, a document type, and a
summary they can edit. It is never written into a clinical field, never used to infer a diagnosis,
and never allowed into a brief before the person has confirmed it.

The boundary the app states, and means:

> Anything read out of a document is a suggestion until you confirm it. It is stored as extracted
> from a document, and unconfirmed, and it stays out of your appointment brief until you have
> checked it.
