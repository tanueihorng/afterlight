# Security

## The short version

There is no server. There is no account. There is no database anyone else can reach. Your records
live in your own browser's storage on your own device, and the only way anything leaves is if you
export, print or share it deliberately.

That removes most of what a security policy usually covers, and leaves a smaller, sharper set of
things that can go wrong. Those are what this page is about.

## Reporting something

Open a **private security advisory**:
<https://github.com/tanueihorng/afterlight/security/advisories/new>

If that is not available to you, open a normal issue that says only *"security issue, please get in
touch"* — no details — and wait to be contacted.

Please give it a week before making anything public. This is one person's project; there is no
on-call rota.

**Do not put your own eye records, exported files, or screenshots containing them in an issue.**
They are yours, and a public issue tracker is not the place for them. Describe the shape of the
problem instead.

## What counts as a security issue here

The threats worth naming, given the architecture:

**Data integrity — the most serious class.** Anything that could lose, corrupt or silently alter
someone's record. A migration that drops entries. An import that overwrites more than it said it
would. An export that produces a file that cannot be read back. A quota failure that reports success
while losing a scan. Somebody's four-year eye history is not recoverable from anywhere.

**Data leaving the device.** Any code path that sends anything anywhere. A third-party asset that
made it into the build. A URL constructed from record content. A service worker caching something
into a shared context. There is a check on every commit (`npm run nonetwork`) that reads the built
files and fails on anything a browser would fetch — a hole in that check is itself a finding.

**Encryption.** The archive encryption (AES-256-GCM, PBKDF2-SHA256, 250,000 iterations). Weaknesses
in the parameters, key derivation, IV or salt handling, or anything that leaks plaintext into the
sealed file.

**Sharing.** The range-scoped extract must contain what the preview said and nothing else. A record
outside the chosen range appearing in a bundle is a serious finding, not a cosmetic one.

**Cross-site scripting.** Record content, filenames and imported archive fields all end up rendered.
Anything that gets script execution out of them.

**Local storage exposure.** Anything that makes one origin's records readable from another, or
leaves plaintext somewhere unexpected.

## What is not a security issue

- **"There is no password on the app."** Deliberate. Afterlight relies on your device's own lock. A
  password on a local-only app protects against someone holding your unlocked phone, and costs a
  lockout that no one can reset. If you want the record encrypted at rest, encrypt your device.
- **"Records are lost if the browser is cleared."** Documented, prominently, in
  [`docs/keeping-it-safe.md`](docs/keeping-it-safe.md). It is the cost of having no server.
- **"Someone with your unlocked device can read your records."** True of a paper diary too.
- **Dependency advisories in the build tooling** that do not reach shipped code. Report them as
  ordinary issues; they get fixed, but they are not urgent.

## What ships

Two runtime dependencies: React and Three.js. No analytics, no telemetry, no crash reporting, no
fonts or code from a CDN — enforced by `npm run guard` on the source and `npm run nonetwork` on the
built output.

## If a fix needs your action

There is no way to push anything to you, which cuts both ways. If a released version turns out to
put records at risk, it will be published as a GitHub release note and a `CHANGELOG.md` entry
saying plainly what happened and what to do. Nobody can update your copy for you.
