# Contributing to Afterlight

Afterlight is a medical diary for people with eye disease. Its users are frightened, their vision
is impaired, and they will sit in a consulting room and make decisions with a clinician based on
what this app shows them. That raises the bar on correctness and restraint above what a personal
project would normally carry.

Read **[`AGENTS.md`](../AGENTS.md)** before your first change — it is the working agreement for
humans and agents alike, and it carries the seven non-negotiables in full.

## Running it

```bash
cd app
npm install
npm run dev            # http://localhost:5173
```

Settings → Load demo data gives you a full synthetic history to work against. Demo records are
badged and removable in one click; they never mix with real entries.

## The gate

```bash
npm run verify         # types, lint, invariants, tests, build — all of it
```

Nothing is done until this passes clean. The individual parts:

| Command | What it protects |
|---|---|
| `npm run lint` | Accessibility rules are **errors** here, not warnings |
| `npm run guard` | The non-negotiables that can be checked mechanically, in the source |
| `npm run changelog:check` | `CHANGELOG.md` still matches `lib/changelog.ts` |
| `npm run test` | The engines where a bug is invisible but consequential |
| `npm run build` | It still ships |
| `npm run bundle` | Initial download stays inside budget and heavy pages stay lazy |
| `npm run nonetwork` | The privacy claim, checked against the **built** files and `site/` |
| `npm run e2e` | Real browsers, desktop and phone: the daily loop, offline, the handoff |

Two more, not in the gate because they produce something rather than check something:

| Command | What it does |
|---|---|
| `npm run clinical-pack` | Writes `docs/clinical-pack.md` — every clinical string, from source |
| `npm run release` | Runs the gate, then **refuses** while the clinical review is outstanding |

## Testing conventions

- Use the builders in `src/test/factories.ts`. State only what the test cares about.
- `renderWithStore` seeds IndexedDB and renders inside a live store.
- Every page has a smoke test **against an empty record** as well as a populated one. The empty
  case is what a new user sees first and is where things actually break.
- Prefer a test that would have caught a real defect over one that describes the implementation.
  The brief, search and ask engines each have tests derived from bugs found while writing them.

Known gaps, deliberately visible rather than papered over:

- **Offline reload is not covered on WebKit.** Playwright throws an internal error driving it, so
  that one case is Chromium-only. It needs a manual check on a real iOS device before a release.
- **Nothing verifies the app on a real handset.** Installing it to a home screen on iOS and Android,
  and recording an entry with the network off afterwards, is a human step. So are the physical
  print check on A4 and Letter, and reading the appointment brief against a clock.
- **The 3D engine is only smoke-tested visually.** Its geometry has unit tests; whether it *looks*
  like an eye is a judgement, and the defects found in it so far were all found by looking.

## What needs a human

An agent — and a contributor working quickly — must not self-approve:

- clinical wording that is not already in the repo, and anything written for a clinician to read;
- changes to safety or emergency copy;
- **marking the clinical review done** — only a human may change the status line in
  [`clinical-review.md`](clinical-review.md), and `npm run release` refuses to tag until it changes;
- anything that weakens a non-negotiable, even behind a flag;
- irreversible data changes;
- publishing or deploying.

Put new clinical strings in the PR description in full so a person can read them, and say plainly
that they need clinician review.

## Style

Match the surrounding code. Two-space indent, double quotes, ~100 columns, named exports.
`npm run format` runs Prettier. Comments explain *why*; the code already says what.

Copy is plain, calm and honest. No exclamation marks, no marketing voice, no reassurance the app
is not entitled to give. Write for someone anxious and tired, because that is who is reading.
