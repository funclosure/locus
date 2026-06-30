---
name: locus-setup
description: Use when setting up, installing, initializing, bootstrapping, or first-running Locus — installing dependencies, building, creating and seeding the database, verifying the toolchain, and optionally registering the MCP server.
---

# Locus Setup

Bring a fresh or freshly-cloned Locus checkout to a working state: dependencies installed, built, database initialized and seeded, checks green. Run from the repo root.

## Steps

1. **Install dependencies.**

   ```bash
   pnpm install
   ```

   If this fails with `ERR_PNPM_UNEXPECTED_STORE` (a pnpm major-version mismatch with the existing `node_modules`), run through corepack instead:

   ```bash
   COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm@latest install
   ```

2. **Build.**

   ```bash
   pnpm build
   ```

3. **Initialize the database.** The CLI migrates and seeds automatically on first use, but you can do it explicitly:

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

   The database lives at `.locus/locus.sqlite` (override with `LOCUS_DB_PATH`). It is gitignored.

4. **Verify the toolchain.**

   ```bash
   pnpm run check
   pnpm test
   ```

   Both should be green before proceeding.

5. **Confirm the seed profile loads.**

   ```bash
   pnpm locus profile show --json
   ```

## Optional: register the MCP server

To let agents call Locus without shell parsing, register the stdio MCP server (requires `pnpm build` first). See `docs/mcp.md` for the full tool surface and per-client snippets. For Claude Code:

```bash
claude mcp add locus \
  --env LOCUS_DB_PATH="$(pwd)/.locus/locus.sqlite" \
  -- node "$(pwd)/dist/mcp/server.js"
```

## Optional: make the skills invocable from Claude Code

Project skills live in `skills/`. To invoke one as a slash command in Claude Code, symlink it into `.claude/skills/`:

```bash
mkdir -p .claude/skills
ln -s ../../skills/locus-research .claude/skills/locus-research
```

## Done When

- `pnpm run check` and `pnpm test` pass.
- `pnpm locus profile show --json` prints the seeded profile.
- Report the database path and whether the MCP server was registered.
