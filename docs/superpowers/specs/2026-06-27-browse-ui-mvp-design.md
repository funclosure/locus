# Browse UI MVP Design

## Goal

Build a local read-only web UI for inspecting Locus research data: profile, preferences, companies, roles, notes, and evidence.

## Scope

This MVP is intentionally not a chat interface and not an editing surface. Codex/Claude already provide the conversation layer. Locus provides the shared data cockpit where the user can browse what agents collected.

## Architecture

- Add a small Node HTTP server in `src/web/server.ts`.
- Expose `GET /api/snapshot`, backed by the existing SQLite repositories through `buildJsonExport`.
- Serve static assets from `src/web/static`.
- Keep the UI dependency-free for this slice: HTML, CSS, and browser JavaScript.
- Run with `pnpm build` then `pnpm web`.

## UI

The first screen is a dense company grid inspired by the user's reference card:

- Dark local-app surface.
- Company cards with label, name, summary, status, fit score, and tags.
- Top filter bar for search, status, and label.
- Detail side panel for selected company showing caveat/assessment, roles, notes, and evidence.

## Error Handling

- `/api/snapshot` returns structured JSON errors on failure.
- The browser UI shows a concise error state if the API cannot load.
- Unknown static paths return `404`.

## Testing

- Add server tests that start the HTTP server against a temp SQLite DB.
- Verify `/api/snapshot` returns seeded research data.
- Verify `/` serves the HTML shell.
- Keep existing CLI/domain tests passing.
