---
name: locus-pipeline
description: Use when tracking or advancing application progress — setting or updating the pipeline stage, next action, and dates for a company or role, or reviewing what needs follow-up in the Locus applications pipeline.
---

# Locus Pipeline

Manage how each target moves through the application pipeline. One application row per target (company or role); writes upsert by target.

## Inspect

```bash
pnpm locus application list --json
pnpm locus application show --target company:1 --json
pnpm locus application history --target company:1 --json
```

## Stages

Use the stage that reflects reality, in roughly this order:

- `researching` — still evaluating; no outreach yet.
- `warm_intro` — pursuing or have an introduction path.
- `reached_out` — contacted; awaiting response.
- `applied` — application submitted.
- `interviewing` — in the interview process.
- `offer` — offer received.
- `rejected` — declined by either side.
- `paused` — intentionally on hold.

## Update

Set stage plus the follow-up context. The target ref is `company:<id>` or `role:<id>`:

```bash
pnpm locus application set \
  --target company:1 \
  --stage reached_out \
  --next-action "Follow up with HK-friendly remote angle" \
  --next-action-at 2026-07-08 \
  --last-contacted-at 2026-07-02 \
  --notes "Warm intro via ex-colleague." \
  --json
```

Only `--target` and `--stage` are required. Upsert replaces the whole row, so a field you leave out is cleared: run `show` first and pass the current `next_action`, dates and notes you want to keep. (With the MCP server registered, `application_set` takes the same fields.)

## Record Outcomes

Each stage change is appended to the target's history automatically, with a snapshot of its current `fit_score`. That history is what `locus application calibrate` reads, so keep it accurate:

- When something happens on a past day, pass `--occurred-at 2026-09-20` so the history has the real date.
- When the employer gives a reason (a rejection note, interview feedback), pass it with `--feedback`, **word for word**. Don't paraphrase, summarize or infer a reason they didn't state. Feedback can be recorded without a stage change.
- Silence is not a rejection. Leave a ghosted application at its stage with a dated next action. Set `rejected` only after an explicit no, or once the user decides to call it.

```bash
pnpm locus application set --target role:3 --stage rejected \
  --feedback "We went with a candidate with more SwiftUI depth." \
  --occurred-at 2026-09-20 --notes "Rejected after final round." --json
```

## Keep It Honest

- A `next_action` without a date is fine, but a date makes follow-up reviewable (see `locus-status`).
- Update `last_contacted_at` whenever you actually reach out, so freshness is visible.
- Don't advance a stage past what has really happened; the pipeline is a status record, not a wish list.
- When a target dies, set `rejected` or `paused` with a one-line `notes` reason rather than deleting it.

## After Updating

Re-list to confirm, and surface anything now awaiting follow-up:

```bash
pnpm locus application list --json
```
