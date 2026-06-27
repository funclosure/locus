# Browse UI MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local read-only browser UI for inspecting Locus company research.

**Architecture:** A Node HTTP server serves static files and a JSON snapshot API. The API reuses the existing SQLite migration, seed, and export repository flow. The browser UI derives cards, filters, and details from the snapshot.

**Tech Stack:** TypeScript, Node `http`, existing SQLite repositories, vanilla HTML/CSS/JS.

---

### Task 1: Local Web Server

**Files:**
- Create: `src/web/server.ts`
- Test: `tests/web/server.test.ts`
- Modify: `package.json`

- [ ] Write a failing test that starts a temp server and requests `GET /api/snapshot`.
- [ ] Implement `createLocusWebServer` and `startLocusWebServer`.
- [ ] Add `web` script: `node dist/web/server.js`.
- [ ] Verify `pnpm test tests/web/server.test.ts`.

### Task 2: Static Browse UI

**Files:**
- Create: `src/web/static/index.html`
- Create: `src/web/static/styles.css`
- Create: `src/web/static/app.js`
- Test: `tests/web/server.test.ts`

- [ ] Add a failing test that `GET /` returns the HTML shell.
- [ ] Implement static file serving for `/`, `/styles.css`, and `/app.js`.
- [ ] Build the company grid, filters, and detail panel in browser JavaScript.
- [ ] Verify `pnpm test tests/web/server.test.ts`.

### Task 3: Final Verification

- [ ] Run `pnpm test`.
- [ ] Run `pnpm check`.
- [ ] Run `pnpm build`.
- [ ] Start `pnpm web` and confirm the URL is available.
