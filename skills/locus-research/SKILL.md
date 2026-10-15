---
name: locus-research
description: Use when researching companies, jobs, roles, markets, or opportunities into the local Locus database with the locus CLI, especially when saving companies, roles, notes, evidence, and source-backed findings for later review.
---

# Locus Research

Use the `locus` CLI as the write path for research. Conversation is not the durable record; Locus data is.

## Start

1. Run `pnpm locus profile show --json` to read the approved profile.
2. Start or inspect a session:
   - New run: `pnpm locus session start --goal "<research goal>" --json`
   - Current run: `pnpm locus session show --json`
3. Keep the active session id available for notes and preference candidates.

## Research Writes

Prefer structured writes over prose summaries:

```bash
pnpm locus company add --name "Bear" --summary "Apple-native markdown notes." --primary-label "craft-driven" --json
pnpm locus community add --name "raycast/extensions" --ecosystem "TypeScript" --summary "Raycast extension ecosystem." --json
pnpm locus role add --company-id 1 --title "Senior iOS Engineer" --remote-policy remote --json
pnpm locus note add --target company:1 --body "Small Apple-platform team; worth tracking." --json
pnpm locus evidence add --target company:1 --url "https://bear.app" --snippet "Markdown notes app for Apple devices." --source-type company_site --json
```

For complex records, pipe JSON:

```bash
echo '{"companyId":1,"title":"Senior iOS Engineer","remotePolicy":"remote","fitScore":0.85}' | pnpm locus role add --json
```

## Evidence Rules

- Save evidence for factual claims about companies, roles, remote policy, platform focus, compensation, and hiring status.
- Use `source_type` honestly: `company_site`, `job_post`, `article`, `social`, `docs`, `manual`, or `other`.
- Use `confidence` from `0.0` to `1.0` only when it adds signal.
- Do not invent evidence. If a claim is unsourced, save it as a note or omit it.

## Fit Assessment

Use profile requirements first:

- Remote requirement is hard.
- Strong positive signals: iOS, Apple-platform native, interaction design, AI-first products, writing/notes/knowledge tools, craft-driven teams.
- Prefer concise assessments over long commentary.
- **No match with a target caps the score at 0.3.** If neither the product nor the role matches any of the profile's `interest` preferences (what the user is actually pursuing), say so plainly in `fit_assessment` and score 0.3 or below, however good the culture or remote fit. A match through the role counts (an iOS role at a fintech matches "iOS and Apple platforms"). Don't stretch the nearest interest or blend two into a "hybrid" to make a fit. A confident fit story for work the user isn't looking for does more harm than a low score.

Record fit in company/role fields when clear:

```bash
pnpm locus company update --id 1 --fit-score 0.82 --fit-assessment "Strong Apple-platform craft fit; hiring status unclear." --json
```

## Stop Condition

Before ending, run:

```bash
pnpm locus export json
```

Use the export to check that saved companies, roles, notes, and evidence are present. Report any important findings that were not saved.
