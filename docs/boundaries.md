# What Afterlight will not do

Written plainly, because the things a health tool refuses to do matter more than the things it does.

---

## It is not a medical device

Afterlight is a **record-keeping and educational tool**. It stores what you write down about your
own eyes, keeps the files your clinic gives you, and organises both by date and by eye.

It does not diagnose, does not interpret imaging, does not estimate risk, does not offer a
prognosis, and does not make any clinical judgement about you. It has no clinical function to
regulate, which is why it is not registered as a medical device anywhere.

That position depends entirely on the list below. **If Afterlight ever adds interpretation, the
position changes**, and the change has to be made deliberately, in the open, starting from
[`clinical-review.md`](clinical-review.md) — not slipped in as a feature.

## The specific things it refuses to do

**It will not tell you what you have.** The condition atlas is a reference you navigate yourself.
It is never surfaced from your symptoms, never ranked against your record, and never presented as a
shortlist of what might be wrong. That refusal is enforced by a check that fails the build.

**It will not score you.** No risk scores, no probabilities, no severity ratings of its own, no
red dashboards, no "your vision is declining". Where you record a severity, it is *your* number
about *your* experience, comparable with your own other entries and with nothing else.

**It will not judge a trend.** When it shows numbers over time, it describes them arithmetically —
how many readings, between which dates, the highest and lowest, the difference between the first and
the last. It will not say better, worse, stable, elevated or concerning. Also enforced by a check.

**It will not read your scans.** It stores an OCT and shows it to you at full size. It does not
tell you what is in it.

**It will not reassure you.** A quiet week in your record means you did not write anything down. It
does not mean your eyes are fine, and the app will never imply that it does. "Not recorded" is shown
as not recorded, never as a normal result.

**It will not invent.** "Ask my records" is a query over your own stored entries with a citation on
every answer. There is no language model in it. When it cannot find something it says exactly
that — *"I could not find that in your stored records."* — rather than producing a plausible
sentence.

**It will not guess on your behalf.** When it reads a date out of a filename that could mean two
different days, it offers both and waits. Anything read out of a file stays marked unchecked, and
stays out of your appointment brief, until you confirm it.

**It will not collect anything.** No account, no server, no analytics, no telemetry, no crash
reporting, no fonts or code loaded from anyone else. Not as a policy that could change — as an
architecture with nowhere to send anything. It is checked against the built files on every commit.

## What it is for

The gap between appointments, where you are the only person watching your eyes and the record
holds what the hospital did to you rather than what you saw.

## When not to use it

**When something is sudden or severe, stop and get seen.** Sudden floaters, sudden flashes, a
curtain or shadow across your vision, or a sudden drop in vision are reasons to contact an
ophthalmologist or an emergency eye service now. Write it down afterwards. Logging a symptom is not
a step on the way to getting help; it is something you do once help is arranged.

Afterlight will show you a short notice when you record one of those, pointing you at a real doctor.
It will not tell you how urgent your particular case is, because it cannot know.

## The clinical wording has not been reviewed

As of version 0.10.0, the writing in this app that describes eye conditions, explains the home
checks, or tells you when to seek urgent care was drafted without clinical input and has not been
read by an ophthalmologist or optometrist.

That is stated in the app, on the landing page, and in the changelog, and the release script
refuses to tag a version until it changes. See [`clinical-review.md`](clinical-review.md) for what is
outstanding and how the review is being sought.

Until then: treat every explanation in Afterlight as background reading. Your own record — what you
wrote, when you wrote it, and what your clinic gave you — is accurate regardless, because it is
yours.

## Your data, and the honest trade

Everything is in your browser, on your device. Nobody else has a copy, including the author. That
is the whole privacy model and it has no small print.

The cost is that **you** are the backup. Clearing your browser data deletes your record, and no one
can restore it for you. See [`keeping-it-safe.md`](keeping-it-safe.md), and export regularly.

## Licence and liability

MIT licensed. Which means, in the words the licence uses: provided "as is", without warranty of any
kind. Nobody is liable for what you do with it.

That is the standard wording for software, and it is worth saying what it means here specifically:
if this app loses your record, or a sentence in it turns out to be wrong, there is no organisation
behind it to make that right. It is one patient's tool, shared in case it is useful to another.
