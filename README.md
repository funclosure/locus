# Locus

A local, agent-usable job-search knowledge system. Locus gives an AI agent a structured place to record research about companies and roles — backed by evidence — and gives you a quiet console to review, curate, and act on it. Your conversation stays in the chat; the durable memory lives in Locus.

Everything runs locally against a single SQLite database. Nothing leaves your machine except the web pages you choose to open and the model calls the chat makes through your own Claude Code login.

## What it does

- **Structured memory** — companies, roles, notes, evidence, application pipeline, and an approved profile of what you're looking for.
- **Evidence-first** — factual claims about a company or role can be backed by a source URL and snippet.
- **Agent-writable, human-approved** — agents add and curate research freely; durable changes to *your profile* are only ever *proposed*, never written without your approval.
- **Four ways in** — a CLI, an MCP server, a browse UI, and a set of skills, all over the same database.

## Architecture

```
Skills          research · curation · preference-learning · export · status · pipeline · browse
   │
Agent surface   CLI  ·  MCP server (stdio)
   │
Data layer      SQLite + migrations · TypeScript domain types, validators, repositories
   │
Browse UI       read-only cockpit + "/" chat bar that turns feedback into edits
```

See [`docs/PRD.md`](docs/PRD.md) for the product spec and [`docs/PLAN.md`](docs/PLAN.md) for the phased plan.

## Quick start

Requires Node 22+ and pnpm.

```bash
pnpm install            # if this errors with ERR_PNPM_UNEXPECTED_STORE, run:
                        #   COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm@latest install
pnpm build

cp profile.example.json profile.json   # then edit profile.json — name, summary, preferences
pnpm db:seed                           # seed the profile (also runs automatically on first use)

pnpm web                # browse UI at http://127.0.0.1:4173
```

From Claude Code you can run the [`/locus-setup`](skills/locus-setup/SKILL.md) skill to do all of this.

## Surfaces

### CLI

Every command supports `--json` for agent use.

```bash
pnpm locus profile show --json
pnpm locus company add --name "Linear" --summary "Craft-driven issue tracking." --json
pnpm locus role add --company-id 1 --title "Senior iOS Engineer" --remote-policy remote --json
pnpm locus note add --target company:1 --body "Small Apple-platform team." --json
pnpm locus evidence add --target company:1 --url "https://linear.app" --snippet "..." --json
pnpm locus application set --target company:1 --stage applied --json
pnpm locus export markdown --path shortlist.md --json
```

### Browse UI

`pnpm web` serves a read-only research cockpit (`http://127.0.0.1:4173`): a dense company index, a reading pane with openable Home/Careers/source links, and a profile rail. Keyboard: **↑/↓** move through companies, **Enter** dives into the reading pane.

A **`/`-activated chat bar** turns plain feedback into edits — *"mark Linear shortlisted and note their design culture"* applies directly; *"I only want teams under 30 people"* is proposed for your approval. Highlight text on the page and it rides along as context. The chat authenticates through your **Claude Code login** (via `@anthropic-ai/claude-agent-sdk`, model `claude-opus-4-8`) — no API key. Browsing and the CLI work without it.

### MCP server

```bash
pnpm mcp                # stdio MCP server exposing all CLI operations as 24 tools
```

Register it with Claude Code / Desktop / Codex — see [`docs/mcp.md`](docs/mcp.md).

### Skills

Project skills live in [`skills/`](skills/); each is invocable as a slash command in Claude Code:

`locus-setup` · `locus-research` · `locus-curation` · `locus-preference-learning` · `locus-export` · `locus-status` · `locus-pipeline` · `locus-browse` · `convo`

## Your data & privacy

- **Research data** (companies, roles, notes, evidence, applications) lives in `.locus/locus.sqlite` — **gitignored**, never committed. Override the path with `LOCUS_DB_PATH`.
- **Your profile** lives in `profile.json` — **gitignored**. The repo ships only the generic `profile.example.json` template.

So a clone contains the code and a placeholder profile, never your personal search.

## Development

```bash
pnpm run check          # typecheck
pnpm test               # vitest
```

- TypeScript, SQLite (`better-sqlite3`), `zod` validators, `commander` CLI.
- The browse UI is plain static HTML/CSS/JS served by a small Node server (`src/web/`).
- Database changes go through numbered migrations in `src/db/migrations/`.

## Status

Phases 0–2 (data layer + CLI, skills) are complete; Phase 3 (browse UI) is past MVP with the chat console; Phase 4 (MCP server) is done. Phase 5 (research automation) is the open roadmap. Details in [`docs/PLAN.md`](docs/PLAN.md).

## License

[MIT](LICENSE) © 2026 Chungyun Lee
