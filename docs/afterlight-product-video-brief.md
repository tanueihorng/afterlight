# Afterlight product video — applied production brief

Based on [Product Video Design Framework](product-video-framework.md). This document applies its five principles to Afterlight. All proposed timings, compositions and production choices below are original adaptation decisions, not measurements of the source videos.

## Direction

Make the product easy to understand through a short, coherent demonstration. For Afterlight, considered design means readable information, deliberate pacing and an honest account of what the app does. The film should organise attention without implying a medical outcome.

Keep the existing identity: dark navy, pale text, periwinkle accents, DM Sans interface typography and Bricolage Grotesque display typography. Use the actual interface as the visual subject. Lumi can appear briefly as the existing mascot, without turning its eye into a realistic anatomical sequence.

## 1. Branding

Use one consistent stage, one typography hierarchy and one accent role across the film. Preserve the app's colours for eye identification when showing records, together with their text labels. Colour must never imply a clinical verdict.

The primary subject is the diary. The mascot, light effects and frame treatments support it. Give the product name an unhurried introduction and a readable closing hold.

Reuse current repository wording. Do not add diagnostic, prognostic, reassuring or clinician-facing language. Keep safety statements intact wherever the captured interface displays them.

## 2. Design

Design six static boards before animation. Each board must work at a small playback size. Give the screen enough room to read, and choose detail crops when a full application window becomes too small.

### Proposed sequence: 30 seconds

| Time | Board | Visual subject | Composition |
| --- | --- | --- | --- |
| 0–3 s | Identity | Afterlight name | Centred title on the existing dark background; brief hold |
| 3–8 s | Today | The actual initial decision | One screen, readable heading and both decision targets |
| 8–15 s | Record | A short entry in a dedicated demo session | Crop to the relevant controls; keep eye, date and context readable |
| 15–22 s | Find it again | The saved entry in Timeline | Preserve the same entry's identity across the transition; settle before reading |
| 22–26 s | Local storage | Existing product wording describing local storage | A quiet text composition, with no security animation that promises more than the app does |
| 26–30 s | Identity | Afterlight name | Return to the opening composition and hold |

Use the real save result. Do not substitute an invented confirmation or silently skip required input. This is an edited demonstration; any omitted intermediate steps should remain understandable.

Avoid presenting a decorative curve as a patient's clinical trajectory. Avoid filling a month of diary dots merely to create a satisfying pattern. Missing entries must remain missing.

## 3. Animation

### Smoothness

Use acceleration and deceleration without bounce. Begin with entrances of 500–800 ms and a small translation or scale change. These values are starting points, not fixed requirements. Adjust them after reviewing legibility.

Keep camera movement separate from reading. A detail push-in can last approximately 800 ms, followed by a still hold. Essential dates and provenance should remain sharp throughout.

### Dynamic transitions

Carry context from one board to the next. Move from the whole screen to a detail within it; connect an entry to its place in Timeline. Use matching position, scale or framing when a relationship exists. A simple dissolve or cut is preferable when a moving transformation would imply a false relationship.

Use one main movement at a time, with only a slight overlap for secondary layers. Remove full-screen flashes, impact shake, elastic typography and repeated dives through the mascot's pupil.

### Adaptive rhythm

Move briskly through orientation, slow down for the diary controls, hold on the saved entry, then finish quietly. Do not force all events onto a regular beat. The 30-second edit can be extended if meaningful information cannot be read comfortably.

## 4. Music choice

Build and review the silent edit first. Audition a restrained instrumental track around 80–100 BPM, or use silence. This range is an Afterlight production proposal rather than a measured property of the reference.

Keep the soundtrack optional. Do not use escalating tension to dramatise symptoms or a triumphant resolution to suggest recovery. Audio must not carry information unavailable in the pictures or text alternative.

## 5. Sound design

Use only a small number of soft movement or interaction sounds where they help the viewer follow the sequence. Avoid alarms, heartbeat effects, clinical-monitor sounds and reward chimes.

Review at a modest listening volume. Remove any sound that makes an otherwise calm interface feel urgent. The existing music generator can be inspected for reuse, but its 120 BPM arrangement and numerous impacts should not determine the new edit.

## Existing promo audit

The current `promo/afterlight-intro.mp4` was inspected through sampled frames and its corresponding HTML. Metadata reports 22 seconds, 1920 × 1080, 60 fps, H.264 video and AAC audio. The soundtrack was not independently assessed by listening.

| Existing treatment | Proposed change | Reason |
| --- | --- | --- |
| Rapid full-screen typography | Fewer titles with reading holds | Reduce competing demands on attention |
| Impact shake and flashes | Settled motion and gentle transitions | Match Afterlight's calm requirement |
| Four feature cards between 10 and 14 seconds | One entry journey across multiple boards | Give the viewer enough time to understand the product |
| Recreated cards with wording that differs from the current interface | Fresh demo captures | Avoid presenting an outdated or invented interaction as current behaviour |
| Decorative timeline curves | Actual dated record view | Preserve the meaning and source of recorded information |
| Recurring mascot jumps and iris zooms | Brief identity use | Keep the diary as the focal subject |

This audit is a production assessment, not a claim that the entire existing video or application has been tested.

## Assets and implementation

| Input | Existing path or required action |
| --- | --- |
| Promo source | `promo/intro.html` — preserve until the revised edit is reviewed |
| Current export | `promo/afterlight-intro.mp4` — retain as the previous version |
| Local fonts | `promo/fonts/dm-sans.woff2`, `promo/fonts/bricolage-grotesque.woff2` |
| Mascot | `promo/mascot.png` — optional identity use |
| Visual tokens | `app/src/styles.css` — use the current theme and type tokens |
| Product wording | `app/src/lib/locales/en.ts` and the actual rendered UI |
| New footage | Capture from a dedicated demo environment, never personal records |
| Audio | Select or produce locally; record any licence requirements |

Keep the promotional composition separate from the daily app. It should not add delays, music, camera choreography or new dependencies to Today.

Use a single time-based playhead for an HTML composition. Derive transforms from its current time so seeking remains repeatable. CSS transforms, opacity and clipping are sufficient; no additional 3D framework is required for this sequence.

## Delivery and verification

- Prepare a widescreen master and inspect representative frames, including every transition and final hold.
- Recompose a vertical version if needed; do not shrink an entire desktop window until labels become unreadable.
- Supply a text or static-board alternative and captions if narration is introduced.
- Give an interactive player keyboard-accessible controls, visible focus and at least 44 px targets.
- Honour reduced-motion preferences with a static alternative; a baked video cannot change its internal motion.
- Keep all runtime assets local and preserve the app's offline behaviour and bundle limits.
- Verify that the demonstrated entry retains eye, source, dates and content across the sequence. Mark staged records as demo data.
- Do not show generic anatomy as a personal model. If anatomy is later added, retain the existing generic-model boundary throughout.
- Run the repository verification gate and report actual results before calling implementation complete.
- Any new clinical, safety or clinician-facing wording and any publication remain subject to the human review specified in `AGENTS.md`.

Status: production brief prepared. The existing promo source and video have not been changed by this brief.
