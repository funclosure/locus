---
name: locus-curation
description: Use when cleaning, reviewing, scoring, labeling, shortlisting, rejecting, deduplicating, or otherwise curating existing Locus companies, roles, notes, evidence, and statuses through the locus CLI.
---

# Locus Curation

Curate Locus so the browse UI can be scanned without reading chat transcripts.

## Inspect

Start with:

```bash
pnpm locus export json
```

Review companies, roles, notes, evidence, and pending preference candidates.

## Status Vocabulary

Companies:

- `researching`: interesting but incomplete.
- `shortlisted`: strong fit worth acting on.
- `watching`: not actionable now, worth revisiting.
- `rejected`: clear non-fit; keep evidence.
- `archived`: no longer relevant.

Roles:

- `researching`: needs more checking.
- `interested`: worth applying or tracking.
- `applied`: application sent.
- `rejected`: role is not a fit.
- `closed`: no longer open.
- `archived`: no longer relevant.

## Card Quality

Each good company card should have:

- `primary_label`: one short fit label such as `craft-driven`, `AI-first`, `Apple-native`, or `knowledge tools`.
- `summary`: one concise, opinionated sentence.
- tags or notes only when they aid decisions.
- evidence for factual claims.

Do not overload cards with dashboard detail. Put details in notes/evidence.

## Notes

Use notes for decision-useful observations:

```bash
pnpm locus note add --target company:1 --kind decision --body "Shortlist if remote iOS role appears." --json
```

Avoid vague notes like "interesting" unless the reason is included.

## Curation Loop

1. List/export current data.
2. Fix missing summaries, labels, statuses, and fit scores.
3. Add evidence where factual claims lack support.
4. Reject or archive stale/non-fit items without deleting evidence.
5. Export again to verify the curated view.
