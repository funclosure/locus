# Sidebar Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the browse UI into a sidebar/detail layout and let the user record current application progress.

**Architecture:** Add an `applications` table with one progress record per company or role target. Expose progress through the existing snapshot API and add a small POST endpoint for upserting progress from the local UI. Keep the frontend dependency-free and focused on sidebar navigation plus a detail pane.

**Tech Stack:** TypeScript, SQLite migrations, existing repository pattern, Node HTTP server, vanilla HTML/CSS/JS.

---

### Task 1: Application Progress Data Layer

**Files:**
- Modify: `src/domain/enums.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/domain/validators.ts`
- Create: `src/db/migrations/0002_applications.sql`
- Modify: `src/db/migrate.ts`
- Create: `src/repositories/applicationRepository.ts`
- Test: `tests/repositories/applicationRepository.test.ts`

- [ ] Write a failing repository test for upserting and listing application progress.
- [ ] Add application stage enum, type, validator, migration, and repository.
- [ ] Run `pnpm test tests/repositories/applicationRepository.test.ts`.

### Task 2: Snapshot and API Write Endpoint

**Files:**
- Modify: `src/export/json.ts`
- Modify: `src/web/server.ts`
- Modify: `tests/web/server.test.ts`

- [ ] Write failing tests proving `applications` is included in `/api/snapshot` and `POST /api/applications` upserts progress.
- [ ] Reuse the application repository in the export and server layers.
- [ ] Run `pnpm test tests/web/server.test.ts`.

### Task 3: Sidebar/Detail UI

**Files:**
- Modify: `src/web/static/index.html`
- Modify: `src/web/static/styles.css`
- Modify: `src/web/static/app.js`

- [ ] Replace the card grid with a left sidebar list and main detail pane.
- [ ] Display progress stage, next action, next action date, and notes.
- [ ] Add a local form for saving progress on the selected company.
- [ ] Verify in browser at `http://127.0.0.1:4173`.

### Task 4: Final Verification

- [ ] Run `pnpm test`.
- [ ] Run `pnpm check`.
- [ ] Run `pnpm build`.
- [ ] Run a live API smoke check against `pnpm web`.
