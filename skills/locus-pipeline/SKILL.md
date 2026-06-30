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

Only `--target` and `--stage` are required; other fields are optional and preserved on upsert. (With the MCP server registered, `application_set` takes the same fields.)

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
