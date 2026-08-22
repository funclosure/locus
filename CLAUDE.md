# Locus

Locus is a local, agent-usable job search knowledge system. It provides a structured data layer, a CLI agent interface, a skill layer, and a browse UI for reviewing agent-collected research.

- Product spec: `docs/PRD.md`
- Implementation plan: `docs/PLAN.md`

## Agent-to-Agent Conversation

Codex and Claude exchange ideas through `convo.md` at the repo root using the turn-taking protocol defined in `skills/convo/SKILL.md`.

At the start of any session where you are asked to coordinate with another agent, read the convo skill before acting:

```
Read: skills/convo/SKILL.md
```

Then open `convo.md`, read only the last segment after the final `---`, decide whether it needs a reply, and append one new segment if so.

## Skills

Project skills live in `skills/`. Each skill has a `SKILL.md` describing its protocol.

```
skills/
  convo/SKILL.md                       — agent-to-agent turn-taking via convo.md
  locus-setup/SKILL.md                 — install, build, seed, verify, and register the MCP server
  locus-research/SKILL.md              — research companies and roles into Locus
  locus-curation/SKILL.md              — clean up statuses, labels, notes, and evidence
  locus-preference-learning/SKILL.md   — propose durable profile changes for review
  locus-export/SKILL.md                — create and validate JSON/Markdown exports
  locus-status/SKILL.md                — review pipeline, fits, evidence health, and next actions
  locus-pipeline/SKILL.md              — set and advance application stages and next actions
  locus-browse/SKILL.md                — launch and walk through the read-only browse UI
  locus-scan/SKILL.md                  — discovery rounds for companies not yet in Locus
```

Each skill is symlinked into `.claude/skills/` so it is invocable as a slash command from Claude Code.

## Project State

Phases 0–2 are complete and Phase 3 (browse UI) is at MVP.

- **Data layer + CLI (Phase 1):** SQLite with migrations (`src/db/migrations/`), TypeScript domain types/validators/enums, and repositories for profile, session, company, role, note, evidence, preference candidate, export, and application. The `locus` CLI covers profile, session, company, role, note, evidence, preference (propose/approve/reject), application (set/list/show), and export (json/markdown), all with `--json`.
- **Skill layer (Phase 2):** All five skills exist under `skills/` (see below).
- **Browse UI (Phase 3, MVP):** `pnpm web` serves a read-only research cockpit (`src/web/static/`) — index / reading pane / profile rail — backed by `GET /api/snapshot`. A `/`-activated command bar runs `POST /api/chat`: feedback is sent to a Claude agent (`@anthropic-ai/claude-agent-sdk`, authenticated via Claude Code login — no API key) with curated in-process Locus tools. Company/role/note/application edits apply directly; profile changes route through `propose_preference` for approval. See `src/web/chat.ts`. The profile rail also renders `.locus/compensation.md` (private, gitignored, user-maintained) via `GET /api/compensation` as a collapsed-by-default Compensation section; the section disappears if the file is absent.
- **Applications pipeline (beyond original plan):** the `applications` table (migration `0002`) tracks per-target pipeline `stage` and next actions, with one row per target (upsert by `target_type`/`target_id`). It has a repository, a `POST /api/applications` web endpoint, and a `locus application` CLI command (`set`/`list`/`show`) — see `docs/PLAN.md` for the data-model note.

- **MCP server (Phase 4):** `src/mcp/` exposes all CLI operations as 24 MCP tools over stdio (`pnpm mcp`, bin `locus-mcp`), wrapping the same repositories with the same validators. See `docs/mcp.md` for the tool surface and agent registration.

Not yet started: Phase 5 (research automation).

Verify status with `pnpm run check` and `pnpm test` (all green as of last review).

## Key Conventions

- Session memory is agent-writable; durable profile changes require user approval.
- Every factual company or role claim should be backed by evidence.
- All CLI commands should support `--json` output for agent use.
- Do not build UI before the data layer and CLI are exercised.
