# CLI Research Objects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Locus CLI so agents can create and inspect companies, roles, notes, evidence, preference candidates, and exports.

**Architecture:** Keep the existing single TypeScript package. Add focused repositories for each research object, parse simple CLI flags first, support stdin JSON for complex writes, and return created/updated records with `--json`.

**Tech Stack:** TypeScript, Commander, Zod, better-sqlite3, Vitest.

---

## Task 1: Shared CLI Input Helpers

**Files:**
- Create: `src/cli/input.ts`
- Modify: `src/domain/validators.ts`
- Test: `tests/cli/input.test.ts`

- [ ] Add tests for reading JSON from stdin and parsing target refs like `company:1`.
- [ ] Implement `readStdinJson`, `mergeOptionsWithStdin`, and `parseTargetRef`.
- [ ] Add `targetRefSchema` validation.
- [ ] Run `pnpm test tests/cli/input.test.ts` and `pnpm check`.
- [ ] Commit `feat: add CLI input helpers`.

## Task 2: Company And Role Repositories

**Files:**
- Create: `src/repositories/companyRepository.ts`
- Create: `src/repositories/roleRepository.ts`
- Test: `tests/repositories/companyRepository.test.ts`
- Test: `tests/repositories/roleRepository.test.ts`

- [ ] Add failing tests for company add/list/update.
- [ ] Implement company repository mappers and operations.
- [ ] Add failing tests for role add/list/update.
- [ ] Implement role repository mappers and operations.
- [ ] Run focused repository tests and `pnpm check`.
- [ ] Commit `feat: add company and role repositories`.

## Task 3: Company And Role CLI Commands

**Files:**
- Modify: `src/cli/index.ts`
- Test: `tests/cli/company-role.test.ts`

- [ ] Add failing CLI tests for `company add/list/update --json`.
- [ ] Add failing CLI tests for `role add/list/update --json`.
- [ ] Implement commands with flags and stdin JSON support for writes.
- [ ] Ensure write commands echo the created/updated record under `--json`.
- [ ] Run focused CLI tests and full verification.
- [ ] Commit `feat: add company and role CLI commands`.

## Task 4: Notes, Evidence, And Preference Candidates

**Files:**
- Create: `src/repositories/noteRepository.ts`
- Create: `src/repositories/evidenceRepository.ts`
- Create: `src/repositories/preferenceCandidateRepository.ts`
- Modify: `src/domain/validators.ts`
- Test: matching repository tests.

- [ ] Add failing repository tests for notes with standalone and linked targets.
- [ ] Add failing repository tests for evidence with `checked_at` defaulting to now.
- [ ] Add failing repository tests for preference propose/approve/reject.
- [ ] Implement repositories and validators.
- [ ] Run focused tests and `pnpm check`.
- [ ] Commit `feat: add notes evidence and preference candidates`.

## Task 5: Notes, Evidence, And Preference CLI Commands

**Files:**
- Modify: `src/cli/index.ts`
- Test: `tests/cli/notes-evidence-preferences.test.ts`

- [ ] Add CLI tests for `note add/list --json`.
- [ ] Add CLI tests for `evidence add/list --json`.
- [ ] Add CLI tests for `preference propose/approve/reject --json`.
- [ ] Implement commands with target refs and stdin JSON support.
- [ ] Run focused CLI tests and full verification.
- [ ] Commit `feat: add note evidence and preference CLI commands`.

## Task 6: Export Commands

**Files:**
- Create: `src/repositories/exportRepository.ts`
- Create: `src/export/markdown.ts`
- Create: `src/export/json.ts`
- Modify: `src/cli/index.ts`
- Test: `tests/cli/export.test.ts`

- [ ] Add tests for JSON export containing profile, sessions, companies, roles, notes, evidence, and pending preferences.
- [ ] Add tests for markdown export with readable company/role sections and evidence links.
- [ ] Implement export builders and `locus export json|markdown`.
- [ ] Record export rows when `--path` is provided.
- [ ] Run focused tests and full verification.
- [ ] Commit `feat: add Locus exports`.

## Task 7: Documentation And Final Verification

**Files:**
- Modify: `docs/PLAN.md`

- [ ] Document the expanded CLI command surface and stdin JSON convention.
- [ ] Run `pnpm test`, `pnpm check`, and `pnpm build`.
- [ ] Commit `docs: record expanded CLI surface`.

## Acceptance Criteria

- Agents can create companies, roles, notes, evidence, and preference candidates without touching the UI.
- All write commands support `--json` output and return the created/updated record.
- Complex writes support stdin JSON.
- Targets can be passed as compact refs such as `company:1` and `role:2`.
- Export commands produce useful JSON and Markdown artifacts.
- `pnpm test`, `pnpm check`, and `pnpm build` pass.
