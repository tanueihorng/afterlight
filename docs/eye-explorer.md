# 👁️ Eye Explorer — Standalone 3D Diagnostic Teaching Tool

A **single self-contained HTML file** — Three.js is embedded inside it, so it works
completely **offline**: copy `EyeExplorer.html` anywhere (USB stick, tablet, clinic PC) and
double-click. No install, no internet, no server.

Built as a specialist's teaching + decision-support instrument for patient conversations:
rotate a layered eye, slice it open, click any structure, run symptom-based differentials,
and deep-dive into corneal / retinal micro-anatomy layer by layer.

---

## Open it

Double-click `EyeExplorer.html`. Any modern browser (Chrome / Edge / Safari / Firefox), desktop or tablet.
Optional local server:

```bash
cd eye-explorer
python3 -m http.server 8321   # → http://localhost:8321
```

---

## The three modes

**1 · Globe views (9 scenarios)** — normal anatomy plus pathology demos that change the model:
Dry eye (tear-film breakdown) · Corneal abrasion (fluorescein-green streak) · Cataract
(clouding lens) · Glaucoma (disc cupping) · Floaters/PVD · Retinal tear · Retinal detachment
(peeling dome + sub-retinal fluid). Each brings its own camera preset, cross-section depth,
live labels and explanation document.

**2 · Layer deep-dives**
- *Cornea — layer by layer*: tear film (oil/water/mucin) → epithelium → Bowman’s → stroma →
  Descemet’s → endothelium, with clickable clinical markers: an epithelial **abrasion**, a
  stromal **ulcer**, and **oedema** — teaching why depth decides urgency.
- *Retina — wiring cross-section*: NFL/GCL → INL → ONL → photoreceptors → RPE → choroid,
  with foveal pit morphology, a full-thickness **tear**, and the **sub-retinal fluid wedge**
  showing exactly where detachment splits the retina from its blood supply.

**3 · 🩺 Diagnose tab** — tick what the patient reports; get a ranked differential with match
bars, routine-vs-urgent badges and red-flag triage banners (e.g. flashes + floaters, curtain
sign, acute pain + halos + nausea, contact-lens red eye). One click loads the matching 3-D view
so you can explain what you suspect while you examine.

Every condition also carries a collapsible **“For the clinician”** section (signs, tests,
thresholds: TBUT, pachymetry, gonioscopy, OCT RNFL, macula-on vs off…).

---

## Interaction

| Action | Result |
|---|---|
| Drag / scroll / pinch | Orbit, zoom |
| ✂ slider | Sweeping cross-section through the globe |
| Click part or chip | Info card in plain language + 💡 pearl |
| ▶ Guided tour | Auto-flies camera structure-by-structure |
| 🖨 Handout | Prints the current explanation doc for the patient |
| Iris selector | Brown / hazel / blue / green |

Keys: `1–9,0` conditions · `L` labels · `R` rotate · `T` tour · `F` fullscreen · `Esc` close.

---

## Suggested consultation flow

1. **Normal anatomy** guided tour → "here is how your eye works."
2. Open the **cross-section** before discussing anything internal.
3. Jump to the suspected condition; keep the Guide panel visible while you talk.
4. Use **Diagnose** to structure history-taking with patients or students, then show the match in 3-D.
5. Print the handout so they leave with written information.

---

## Files

```
eye-explorer/
├── EyeExplorer.html              ← everything (app + embedded Three.js r160)
└── vendor/three.module.min.js  ← source copy used at build time (not needed at runtime)
```

### Customising
All content lives in plain JS objects near the top-middle of the script in `EyeExplorer.html`:
- `PARTS` — structure names, label anchors, patient copy
- `CONDITIONS` — titles, docs, camera presets, effects (`fx`), clinician notes
- `SYMPTOMS` — the Diagnose checklist and its weighting rules

### Rebuild note
The embedded library is a base64 data URL (~0.9 MB). To upgrade Three.js, replace
`vendor/three.module.min.js`, then re-run the same splice:
replace the placeholder import URL in `EyeExplorer.html` with
`data:text/javascript;base64,<new file encoded>`.

---

## Disclaimer
Educational visualisation for clinician-led discussion. It does not replace examination or
diagnosis — the specialist remains the diagnostician; patients should consult their own
eye-care professional.
