# Phase 09 — Clinician handoff & sharing

> **Goal:** the brief has to survive contact with a real clinic — on paper, on a screen, in 90 seconds.

## Why it matters

The appointment brief is where all the daily effort is spent or wasted. A clinician has minutes and
no patience for a novelty app. The brief must be skimmable in under a minute, printable without
fighting the browser, shareable without a server, and unmistakable about what is patient-reported
and what is documented. It also has to work the other way: getting the clinic's letters, reports and
scans *into* the record without an hour of typing.

## Preconditions

Phase 08 (brief v2 content).

## Scope

```
app/src/lib/pdf.ts                new — deterministic PDF generation
app/src/lib/share.ts              new — encrypted share bundle
app/src/pages/Appointments.tsx    brief export, share, present refinements
app/src/pages/Imaging.tsx         ingestion improvements
app/src/lib/ingest.ts             new — PDF/image ingestion, optional OCR
app/src/print.css                 dedicated print stylesheet
docs/clinician-note.md            new — one page explaining the brief to a clinician
```

## Tasks

1. **Real PDF export.** Replace print-to-PDF with generated PDF (pdf-lib or equivalent, bundled, no
   network): A4 and US Letter, correct margins, embedded fonts, page numbers, patient-chosen header,
   drawings and thumbnails embedded at print resolution, and a footer on every page stating
   provenance and that the document is patient-generated and not a clinical record. Deterministic
   output — the same record and range produce a byte-identical PDF, which makes it testable.

2. **Print stylesheet.** A real `print.css`: hide chrome, avoid page breaks inside a section, force
   black-on-white regardless of theme, expand truncated text, and render badges as text
   (`[patient reported]`) rather than colour chips that vanish on a mono printer.

3. **Clinician-legible layout.** Restructure the brief for a 60-second read: the period and the
   eye-by-eye change summary above the fold; drawings, events, treatment and questions below.
   Patient-reported and clinician-documented content visually separated at a glance. Include a
   one-line "how to read this" and a link to `docs/clinician-note.md`.

4. **Share without a server.** `share.ts` produces a single encrypted `.afterlight` bundle (Phase 01
   crypto) containing a chosen date range only — never the whole record by default — plus a QR code
   carrying a passphrase-protected payload or a file handshake. Web Share API where available. The
   sharing UI must state exactly what is included and what is not, list the records by count, and
   default to the narrowest useful scope.

5. **Present mode refinements.** Remote-friendly: large type, high contrast automatically, keyboard
   and swipe paging through sections, a per-section fullscreen so a drawing or an OCT can be shown
   large, and a screen-wake lock while presenting.

6. **Ingestion.** Make getting clinic paperwork in genuinely fast: multi-file drop, PDF page
   thumbnails and page-range selection, automatic date and clinic extraction from filenames, and
   **optional on-device OCR** (Tesseract WASM, lazy-loaded, never automatic) that produces a
   *suggested* summary the patient must review and accept. Anything OCR-derived is stored as
   `source_type: "document_extracted"` with `confirmed: false` until the patient confirms it.

7. **DICOM-lite handling.** Many clinics export OCT as PDF or JPEG; some give DICOM. Support reading
   basic DICOM metadata (date, modality, laterality) and rendering the embedded image where it is a
   standard encapsulated format. If it cannot be read, store the file intact and say so plainly
   rather than failing the import.

## Acceptance criteria

- [ ] PDF export is byte-identical for the same input, embeds drawings at ≥ 150 dpi, and prints
      correctly on A4 and Letter (verified by a human on a physical printer, noted in the PR).
- [ ] Printed output is legible in greyscale with all provenance information intact.
- [ ] A clinician-reader test: someone unfamiliar with the app can state, within 60 seconds of the
      brief, what is new in each eye and what the patient wants to ask. Document the result.
- [ ] Share bundle contains only the selected range, is encrypted, and imports correctly on another
      device.
- [ ] Ten mixed clinic PDFs and photos ingest in under two minutes total, with correct dates.
- [ ] OCR output is never stored as confirmed, and the confirm step is required before it appears in
      a brief.
- [ ] Present mode holds the screen awake and pages by keyboard and swipe.

## Risks & non-goals

- **Not** an interoperability project: no FHIR, no HL7, no EHR integration. Those require
  institutional partners, not a client-side app.
- OCR must be opt-in, on-device, and lazily loaded — the WASM bundle must never touch the initial
  load, and nothing may be sent anywhere for recognition.
- Sharing defaults must be conservative. A patient handing over a QR code should not accidentally
  hand over four years of everything.

## Agent brief

> Execute `docs/plan/phase-09-clinician-handoff.md`. Add deterministic bundled-font PDF generation
> with embedded drawings, a real print stylesheet with text-rendered provenance badges, a brief
> layout restructured for a 60-second clinician read, encrypted range-scoped share bundles with QR
> and Web Share, present-mode paging with wake lock, fast multi-file ingestion with filename date
> extraction, opt-in on-device OCR that stays unconfirmed until reviewed, and basic DICOM metadata
> handling with graceful failure. Include the physical print check and the clinician-reader test
> result in the PR.
