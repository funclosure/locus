# Locus MCP Server

The Locus MCP server exposes the same operations as the `locus` CLI as [Model Context Protocol](https://modelcontextprotocol.io) tools, so agents (Claude Code, Claude Desktop, Codex) can call Locus directly without shell-command parsing. The CLI remains available for debugging and portability.

- Transport: **stdio**.
- Implementation: `src/mcp/server.ts` (entry + transport) and `src/mcp/tools.ts` (tool registry).
- Each tool is a thin wrapper over the same repository functions the CLI uses, with input schemas reused from the domain validators. The MCP surface, the CLI, and the data model stay in lockstep.

## Build and run

```sh
pnpm build          # compile to dist/
pnpm mcp            # run the built server over stdio (node dist/mcp/server.js)
pnpm mcp:dev        # run from source via tsx (no build step)
```

The server reads/writes the same SQLite database as the CLI and web UI. The database path comes from `LOCUS_DB_PATH`, defaulting to `<cwd>/.locus/locus.sqlite`. Migrations and the seed profile run automatically on startup.

## Tool surface

Twenty-four tools, mirroring the CLI one-to-one:

| Group | Tools |
| --- | --- |
| profile | `profile_show` |
| sessions | `session_start`, `session_show` |
| companies | `company_add`, `company_list`, `company_get`, `company_update` |
| roles | `role_add`, `role_list`, `role_update` |
| notes | `note_add`, `note_list` |
| evidence | `evidence_add`, `evidence_list` |
| preferences | `preference_propose`, `preference_list`, `preference_approve`, `preference_reject` |
| applications | `application_set`, `application_list`, `application_show` |
| exports | `export_json`, `export_markdown`, `snapshot` |

Writes return the created or updated record as JSON; reads return the matching list or record. `export_markdown` returns Markdown text; `export_json` and `snapshot` return the full dataset as JSON.

## Registering with an agent

Use an absolute path to the built entry point and point `LOCUS_DB_PATH` at the database you want the agent to share with the CLI/UI.

### Claude Code

```sh
claude mcp add locus \
  --env LOCUS_DB_PATH=/abs/path/to/locus/.locus/locus.sqlite \
  -- node /abs/path/to/locus/dist/mcp/server.js
```

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "locus": {
      "command": "node",
      "args": ["/abs/path/to/locus/dist/mcp/server.js"],
      "env": { "LOCUS_DB_PATH": "/abs/path/to/locus/.locus/locus.sqlite" }
    }
  }
}
```

### Codex (`~/.codex/config.toml`)

```toml
[mcp_servers.locus]
command = "node"
args = ["/abs/path/to/locus/dist/mcp/server.js"]
env = { LOCUS_DB_PATH = "/abs/path/to/locus/.locus/locus.sqlite" }
```

## Compatibility notes

- Run `pnpm build` before registering, and rebuild after changing `src/mcp/*` — agents launch the compiled `dist/mcp/server.js`.
- Durable profile changes still require user approval: agents propose via `preference_propose`; approval (`preference_approve`) is a human action.
- The server is stateless between calls beyond the shared database; concurrent CLI/UI access is safe (SQLite handles locking).
