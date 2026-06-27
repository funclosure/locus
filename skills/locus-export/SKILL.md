---
name: locus-export
description: Use when generating, reviewing, sharing, saving, or validating Locus JSON or Markdown exports of researched companies, roles, notes, evidence, preferences, or session results.
---

# Locus Export

Use exports to review or hand off structured Locus research.

## Commands

JSON to stdout:

```bash
pnpm locus export json
```

Markdown to stdout:

```bash
pnpm locus export markdown
```

Markdown to file:

```bash
pnpm locus export markdown --path shortlist.md --json
```

## Review Before Sharing

Before treating an export as final:

1. Check that companies have summaries and statuses.
2. Check that roles have remote policy when known.
3. Check that factual claims have evidence links.
4. Check pending preference candidates separately.
5. Remove or revise notes that are vague or not decision-useful.

## Choosing Format

- Use JSON for agent handoff, debugging, app imports, or MCP-like workflows.
- Use Markdown for human review, shortlist sharing, or planning next actions.

## Export Discipline

Exports are snapshots. If an export reveals missing or stale data, update Locus records first, then export again.
