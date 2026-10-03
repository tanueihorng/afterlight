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
