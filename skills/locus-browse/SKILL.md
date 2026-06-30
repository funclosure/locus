---
name: locus-browse
description: Use when the user wants to visually review Locus research — launching, opening, or explaining the local browse UI (the research cockpit) to scan companies, roles, evidence, pipeline, and profile direction.
---

# Locus Browse

Launch the local browse UI so the user can review agent-collected research faster than reading a transcript. The UI is **read-only** — all edits happen through the CLI or the other Locus skills, not the page.

## Launch

The UI serves the built static files and reads the same database as the CLI:

```bash
pnpm build
pnpm web
```

This serves the research cockpit at `http://127.0.0.1:4173`. Open it:

```bash
open http://127.0.0.1:4173
```

The server keeps running in the foreground; stop it with Ctrl-C (or kill the background process) when done.

## What's On The Page

- **Top bar** — wordmark and dataset counts.
- **Left column** — search + status/label filters, then a dense company index (selected row marked with an amber tick).
- **Middle** — the reading pane for the selected company: fit score, serif assessment, Home/Careers/role/evidence links (all openable), and quiet sections for application progress, roles, notes, and evidence.
- **Right rail** — the profile: identity summary and what the user is looking for, grouped as requirements, interests, green flags, avoid, and constraints.

## Guide The Review

Walk the user through it:

1. Skim the index by fit and stage; click into anything notable.
2. Open Home/Careers links to verify a company is still hiring.
3. Check that claims have evidence and that dates aren't stale.
4. Note anything to change — then act with the right skill: `locus-curation` (statuses/labels/notes), `locus-pipeline` (application stage), or `locus-preference-learning` (durable profile proposals).

## Note

The page reflects the database at load time. After editing via CLI/skills, reload the page to see changes. If the data looks wrong, fix the records — don't expect to edit from the UI.
