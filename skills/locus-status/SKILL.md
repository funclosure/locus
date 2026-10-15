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
pnpm locus community list --json
pnpm locus preference list --status pending --json
pnpm locus application calibrate --json
```

(If the Locus MCP server is registered, `snapshot` / `application_list` / `preference_list` return the same data.)

## Summarize

Report these sections, concisely:

1. **Pipeline** — group applications by `stage` (researching → warm_intro → reached_out → applied → interviewing → offer; plus rejected/paused). Note anything with a `next_action` due or overdue against today.
2. **Top fits** — companies/roles by `fit_score`, highest first. Call out strong fits not yet shortlisted or acted on.
3. **Communities** — open-source communities by `fit_score`, alongside companies. Flag any with stale `last_checked_at`.
4. **Evidence health** — flag companies and communities with factual claims but no evidence, and evidence whose `checked_at` is old. Evidence dates are the trust signal.
5. **Pending preferences** — list `pending` preference candidates awaiting the user's approval. These are proposals, not approved profile memory.
6. **Gaps** — companies and communities missing a summary, label, status, or fit assessment.
7. **Calibration** — from `application calibrate`: quote the `sentence` verdict as given, the band table (n, interviews, offers, rate), the in-flight count, and how many scores were only recorded at the outcome (`scoredAtOutcome`; these are weaker evidence). Show a rate the report withholds as "n too small"; never work out your own percentage from a handful of cases. Quote recorded feedback verbatim; if the same reason appears for two or more targets, point it out in one sentence and suggest `locus-preference-learning`. If the verdict is `inverted`, offer to go through the high-scored rejections together. Don't re-score them. Skip this section when nothing has resolved yet.

## Suggest Next Actions

End with a short, ranked list of concrete next moves, each tied to a skill or command — e.g. "shortlist Bear (`locus-curation`)", "advance Mem to `applied` (`locus-pipeline`)", "re-verify GoodNotes careers page (evidence is stale)".

## Discipline

- Read-only. Do not edit statuses, scores, or the profile here.
- Calibration is advisory. It never justifies editing scoring rules or rescoring targets automatically. Whether to change targets or preferences is the user's call.
- Prefer the actual data over memory of the conversation; the database is the source of truth.
- Keep it scannable — this is a dashboard in prose, not a transcript.
