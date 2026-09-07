# Phase 10 — Release, documentation & clinical review

> **Goal:** other patients can find it, install it, trust it, and get help with it.

## Why it matters

Everything up to here is capability. This phase is the difference between a repository and a thing a
frightened person can actually use the night before their appointment. It is also where the medical
and legal boundaries get their final, deliberate pass — by a human, not an agent.

## Preconditions

All prior phases, or an explicit decision about which shipped.

## Scope

```
docs/                              user guide, accessibility, privacy, clinician note
.github/ISSUE_TEMPLATE/            bug, barrier, clinical-accuracy templates
app/src/pages/Settings.tsx         version, changelog, licences
site/                              new — the landing page (static, no tracking)
scripts/release.mjs                new
CHANGELOG.md                       new
SECURITY.md, CODE_OF_CONDUCT.md    new
```

## Tasks

1. **Hosted build.** Deploy the static app to GitHub Pages (or equivalent) with **no analytics, no
   fonts from a CDN, no third-party requests of any kind** — verify with a network panel screenshot
   showing zero external requests. The privacy claim in the README must be literally true on the
   hosted build, not just in the source.

2. **Landing page.** A short, honest page: what it is, who it is for, the thirty-second loop, the
   privacy model in one diagram, screenshots, and the boundaries. Written for a patient, not for
   developers. It must not oversell — no "take control of your health" language. The tone that made
   the README work is the tone here.

3. **User guide.** `docs/guide.md`: the daily loop, drawing, preparing for an appointment, exporting
   and restoring backups, moving to a new device, what each provenance badge means, and — with
   emphasis — what the app will never tell you and why.

4. **Backup story, front and centre.** First-run and Settings both make the export habit explicit.
   Add a "how to keep this safe" doc covering where to put archives, why encryption is optional, and
   what happens if the browser is cleared. This is the most common way a user will lose everything;
   treat it as a documentation priority, not a footnote.

5. **Clinical review.** Send `docs/atlas-review.md`, the emergency-guidance strings, the self-test
   framing from Phase 05, and the brief's disclaimer text to at least one qualified ophthalmologist
   or optometrist for review. Record the outcome, the reviewer's role (named or anonymous, their
   choice), and the date in `docs/clinical-review.md`. **Ship no clinical copy that has not been
   through this.** Agents may prepare the pack; only a human may accept the review.

6. **Boundaries and legal pass.** A plain-language disclaimer in the app and repo: not a medical
   device, not for diagnosis, no clinical claims, no data processing by the author (there is none to
   process). Note the regulatory position honestly — a record-keeping and educational tool, and
   nothing that offers clinical judgement. If the project ever adds interpretation, that position
   changes and must be revisited.

7. **Issue templates and triage.** Three templates: bug, **accessibility barrier** (prioritised),
   and **clinical accuracy concern** (escalated to human review, never closed by an agent).
   `SECURITY.md` explains that there is no server and how to report a client-side data-integrity
   issue. `CODE_OF_CONDUCT.md`, given the vulnerability of the audience.

8. **Versioning and changelog.** Semantic versioning, `CHANGELOG.md` written for patients rather
   than developers ("the brief now includes injection cycles"), version and changelog visible in
   Settings, and `scripts/release.mjs` to tag, build, verify and publish.

9. **Translation readiness.** Extract user-facing strings behind a lightweight i18n layer, ship
   English only, and document how to contribute a language. Eye disease is not an English-speaking
   condition; the architecture should not assume it is.

## Acceptance criteria

- [ ] Hosted build makes zero third-party network requests (screenshot in the PR).
- [ ] Installable as a PWA on iOS and Android; records an entry offline after install.
- [ ] `docs/clinical-review.md` exists with a real, dated outcome, or every unreviewed clinical
      string is removed from the shipped build.
- [ ] User guide covers backup, restore and device migration, verified by following it literally on
      a clean machine.
- [ ] Issue templates live; the accessibility and clinical templates route to human review.
- [ ] Version and changelog visible in Settings and matching the git tag.
- [ ] A first-time user reaches "recorded today" within 60 seconds of opening the site, tested with
      someone who has not seen it before.

## Risks & non-goals

- **Not** app-store distribution. A PWA avoids store medical-app review and keeps the local-first
  promise intact.
- Do not add analytics "just to know if anyone uses it". The privacy claim is the product's spine.
  If usage insight is ever needed, it must be an explicit, opt-in, local-only, patient-visible
  report they choose to send.
- Resist growth features — accounts, sharing feeds, community symptom comparison. Every one of them
  breaks a non-negotiable.

## Agent brief

> Execute `docs/plan/phase-10-release.md`. Publish a zero-third-party-request static build, write the
> patient-facing landing page and user guide with a prominent backup story, prepare the clinical
> review pack and record its outcome (human sign-off required — do not self-approve), add the legal
> and boundary statements, ship issue templates including accessibility-barrier and
> clinical-accuracy routes, add semantic versioning with a patient-readable changelog surfaced in
> Settings, and extract user-facing strings behind an i18n layer while shipping English only.
