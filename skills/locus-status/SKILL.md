---
name: locus-status
description: Use when reviewing the state of the job search — summarizing the pipeline, ranking fits, surfacing stale or unverified evidence, listing pending preference candidates, and suggesting next actions from the Locus data.
---

# Locus Status

Give the user a clear read of where the search stands, from here in Claude Code. This is a read-and-summarize skill — do not change data; suggest changes and let the user (or the curation/pipeline skills) act.

## Read

Pull the full picture in one shot:

```bash
pnpm locus export json
```

For focused reads:

```bash
pnpm locus application list --json
pnpm locus company list --json
pnpm locus preference list --status pending --json
```

(If the Locus MCP server is registered, `snapshot` / `application_list` / `preference_list` return the same data.)

## Summarize

Report these sections, concisely:

1. **Pipeline** — group applications by `stage` (researching → warm_intro → reached_out → applied → interviewing → offer; plus rejected/paused). Note anything with a `next_action` due or overdue against today.
2. **Top fits** — companies/roles by `fit_score`, highest first. Call out strong fits not yet shortlisted or acted on.
3. **Evidence health** — flag companies with factual claims but no evidence, and evidence whose `checked_at` is old. Evidence dates are the trust signal.
4. **Pending preferences** — list `pending` preference candidates awaiting the user's approval. These are proposals, not approved profile memory.
5. **Gaps** — companies missing a summary, label, status, or fit assessment.

## Suggest Next Actions

End with a short, ranked list of concrete next moves, each tied to a skill or command — e.g. "shortlist Bear (`locus-curation`)", "advance Mem to `applied` (`locus-pipeline`)", "re-verify GoodNotes careers page (evidence is stale)".

## Discipline

- Read-only. Do not edit statuses, scores, or the profile here.
- Prefer the actual data over memory of the conversation; the database is the source of truth.
- Keep it scannable — this is a dashboard in prose, not a transcript.
