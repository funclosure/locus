# OSS Communities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add open-source communities to Locus as a first-class entity with structured openness metrics, alongside the existing company pipeline.

**Architecture:** A new `communities` table parallel to `companies`, carrying three openness columns that companies do not have. The `notes` and `evidence` tables gain `'community'` in their `target_type` enumeration, which requires a full table rebuild because SQLite cannot alter a CHECK constraint in place. Everything above the database mirrors the existing company code path exactly: domain enum, Zod validator, four-function repository, four CLI subcommands, four MCP tools.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), better-sqlite3, Zod, Commander, `@modelcontextprotocol/sdk`, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-01-oss-communities-design.md`.
- Community statuses are exactly: `researching`, `watching`, `contributing`, `rejected`, `archived`.
- All imports inside `src/` use `.js` specifiers, even for `.ts` files (ESM/NodeNext).
- Every CLI command supports `--json`. Every CLI operation gets an MCP equivalent.
- Nullable numeric CHECKs follow the existing form: `x is null or (x >= 0 and x <= 1)`.
- MCP tools are named `<entity>_<verb>` (e.g. `company_add`), **not** prefixed with `locus_`.
- `src/db/schema.sql` is a canonical reference copy that no code loads. It must be hand-updated to match any migration, or it silently goes stale.
- Verification commands are `pnpm run check` and `pnpm test`.

---

### Task 1: Migration — communities table and target_type rebuild

This task carries the project's real risk. The rebuild must preserve 52 notes and 91 evidence rows that are not reproducible.

**Files:**
- Create: `src/db/migrations/0004_communities.sql`
- Modify: `src/db/migrate.ts:8-20` (the `migrations` array)
- Modify: `src/db/schema.sql`
- Test: `tests/db/migrate.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a `communities` table; `notes.target_type` and `evidence.target_type` accepting `'community'`. Later tasks depend on both.

- [ ] **Step 1: Write the failing test**

Append to `tests/db/migrate.test.ts`, inside the existing `describe("migrateDatabase", ...)` block. Note that `migrateDatabase` applies *all* migrations, so this test applies migration SQL by hand to reach the pre-`0004` state.

```ts
  it("preserves notes and evidence rows through the 0004 target_type rebuild", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-migrate-rebuild-"));
    const dbPath = join(tempDir, "test.sqlite");
    const migrationsDir = join(process.cwd(), "src", "db", "migrations");

    const db = new Database(dbPath);
    db.exec("pragma foreign_keys = on");
    for (const file of ["0001_initial.sql", "0002_applications.sql", "0003_company_maker.sql"]) {
      db.exec(readFileSync(join(migrationsDir, file), "utf8"));
    }

    db.prepare(
      "insert into profiles (name, summary) values ('P', 'S')",
    ).run();
    db.prepare(
      `insert into sessions (profile_id, title, goal, status, started_at)
       values (1, 'T', 'G', 'active', '2026-09-01T00:00:00.000Z')`,
    ).run();

    const noteRows = [
      { session_id: 1, target_type: "company", target_id: 7, title: "t1", body: "b1", kind: "observation" },
      { session_id: 1, target_type: "role", target_id: 2, title: null, body: "b2", kind: "decision" },
      { session_id: null, target_type: null, target_id: null, title: "t3", body: "b3", kind: "summary" },
      { session_id: 1, target_type: "preference_candidate", target_id: 4, title: "t4", body: "b4", kind: "question" },
    ];
    const insertNote = db.prepare(
      `insert into notes (session_id, target_type, target_id, title, body, kind)
       values (@session_id, @target_type, @target_id, @title, @body, @kind)`,
    );
    for (const row of noteRows) insertNote.run(row);

    const evidenceRows = [
      { target_type: "company", target_id: 7, url: "https://a.example", title: "e1", snippet: "s1", source_type: "company_site", confidence: 0.9, checked_at: "2026-09-01" },
      { target_type: "role", target_id: 2, url: "https://b.example", title: null, snippet: "s2", source_type: "job_post", confidence: null, checked_at: "2026-09-01" },
    ];
    const insertEvidence = db.prepare(
      `insert into evidence (target_type, target_id, url, title, snippet, source_type, confidence, checked_at)
       values (@target_type, @target_id, @url, @title, @snippet, @source_type, @confidence, @checked_at)`,
    );
    for (const row of evidenceRows) insertEvidence.run(row);

    const notesBefore = db.prepare("select * from notes order by id").all();
    const evidenceBefore = db.prepare("select * from evidence order by id").all();

    db.exec(readFileSync(join(migrationsDir, "0004_communities.sql"), "utf8"));

    // Content must round-trip field for field, not merely match in count.
    expect(db.prepare("select * from notes order by id").all()).toEqual(notesBefore);
    expect(db.prepare("select * from evidence order by id").all()).toEqual(evidenceBefore);

    // The new target type is accepted.
    expect(() =>
      db.prepare("insert into notes (target_type, target_id, body, kind) values ('community', 1, 'b', 'observation')").run(),
    ).not.toThrow();

    // The CHECK was rebuilt, not dropped.
    expect(() =>
      db.prepare("insert into notes (target_type, target_id, body, kind) values ('bogus', 1, 'b', 'observation')").run(),
    ).toThrow();

    // Indexes survive the rebuild.
    const indexes = db
      .prepare("select name from sqlite_master where type = 'index' order by name")
      .all()
      .map((row) => (row as { name: string }).name);
    expect(indexes).toContain("idx_notes_target");
    expect(indexes).toContain("idx_evidence_target");

    // Foreign keys are still intact after the rebuild.
    expect(db.prepare("pragma foreign_key_check").all()).toEqual([]);

    // The communities table exists with its CHECK enforced.
    db.prepare("insert into communities (name, status) values ('raycast/extensions', 'watching')").run();
    expect(() => db.prepare("insert into communities (name, status) values ('x', 'bogus')").run()).toThrow();

    db.close();
  });
```

Add `readFileSync` to the existing `node:fs` import at the top of the file:

```ts
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/db/migrate.test.ts -t "preserves notes and evidence"`
Expected: FAIL — `ENOENT: no such file or directory, open '.../0004_communities.sql'`

- [ ] **Step 3: Write the migration**

Create `src/db/migrations/0004_communities.sql`.

Two notes on why this is written the way it is. `PRAGMA foreign_keys` is a no-op inside a transaction and `migrate.ts` wraps every migration in one, so the pragma is deliberately not toggled here — it is safe because no table references `notes` or `evidence`, so the drop-and-rename cannot cascade or orphan anything. And the copies name every column explicitly rather than using `insert into ... select *`, so a future column addition cannot silently misalign them.

```sql
-- Open-source communities as a second track alongside companies. The three
-- openness columns are the reason this is its own entity: they are comparable
-- across communities and they decay, which prose in a note cannot express.
create table communities (
  id integer primary key autoincrement,
  name text not null,
  url text,
  ecosystem text,
  summary text,
  primary_label text,
  status text not null check (status in ('researching', 'watching', 'contributing', 'rejected', 'archived')),
  median_merge_days real check (median_merge_days is null or median_merge_days >= 0),
  outsider_merge_ratio real check (outsider_merge_ratio is null or (outsider_merge_ratio >= 0 and outsider_merge_ratio <= 1)),
  last_activity_at text,
  fit_score real check (fit_score is null or (fit_score >= 0 and fit_score <= 1)),
  fit_assessment text,
  last_checked_at text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

-- SQLite cannot alter a CHECK constraint in place, so `notes` and `evidence`
-- are rebuilt to admit the 'community' target type. Nothing references either
-- table, so the drop-and-rename is safe with foreign keys enabled.
create table notes_new (
  id integer primary key autoincrement,
  session_id integer references sessions(id) on delete set null,
  target_type text check (target_type is null or target_type in ('profile', 'session', 'company', 'role', 'community', 'preference', 'preference_candidate')),
  target_id integer,
  title text,
  body text not null,
  kind text not null check (kind in ('observation', 'decision', 'question', 'summary')),
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

insert into notes_new (id, session_id, target_type, target_id, title, body, kind, created_at, updated_at)
  select id, session_id, target_type, target_id, title, body, kind, created_at, updated_at from notes;

drop table notes;
alter table notes_new rename to notes;
create index idx_notes_target on notes(target_type, target_id);

create table evidence_new (
  id integer primary key autoincrement,
  target_type text not null check (target_type in ('profile', 'session', 'company', 'role', 'community', 'preference', 'preference_candidate')),
  target_id integer not null,
  url text not null,
  title text,
  snippet text not null,
  source_type text not null check (source_type in ('company_site', 'job_post', 'article', 'social', 'docs', 'manual', 'other')),
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  checked_at text not null,
  created_at text not null default (datetime('now'))
);

insert into evidence_new (id, target_type, target_id, url, title, snippet, source_type, confidence, checked_at, created_at)
  select id, target_type, target_id, url, title, snippet, source_type, confidence, checked_at, created_at from evidence;

drop table evidence;
alter table evidence_new rename to evidence;
create index idx_evidence_target on evidence(target_type, target_id);
```

- [ ] **Step 4: Register the migration**

In `src/db/migrate.ts`, append to the `migrations` array after the `0003_company_maker` entry:

```ts
  {
    version: "0004_communities",
    path: migrationPath("0004_communities.sql"),
  },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/db/migrate.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 6: Sync the canonical schema copy**

In `src/db/schema.sql`, add the `communities` table definition (identical to the migration's), and edit the two existing `target_type` CHECK lists in the `notes` and `evidence` definitions to include `'community'` in the same position as the migration. Do not add the `_new` scaffolding — `schema.sql` describes the final shape.

- [ ] **Step 7: Verify and commit**

Run: `pnpm run check && pnpm test`
Expected: PASS.

```bash
git add src/db/migrations/0004_communities.sql src/db/migrate.ts src/db/schema.sql tests/db/migrate.test.ts
git commit -m "feat(db): add communities table and admit community target type"
```

---

### Task 2: Domain layer — enum, type, validator

**Files:**
- Modify: `src/domain/enums.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/domain/validators.ts`
- Test: `tests/domain/validators.test.ts`

**Interfaces:**
- Consumes: the `communities` table from Task 1.
- Produces: `communityStatuses`, `CommunityStatus`, `Community`, `communityInputSchema`, `CommunityInput`. Tasks 3, 4, and 5 all import these.

- [ ] **Step 1: Write the failing test**

Append to `tests/domain/validators.test.ts`:

```ts
describe("communityInputSchema", () => {
  it("defaults status and nullable fields", () => {
    const parsed = communityInputSchema.parse({ name: "raycast/extensions" });
    expect(parsed.status).toBe("researching");
    expect(parsed.url).toBeNull();
    expect(parsed.ecosystem).toBeNull();
    expect(parsed.medianMergeDays).toBeNull();
    expect(parsed.outsiderMergeRatio).toBeNull();
    expect(parsed.fitScore).toBeNull();
  });

  it("coerces numeric strings from CLI flags", () => {
    const parsed = communityInputSchema.parse({
      name: "GRDB.swift",
      medianMergeDays: "1.2",
      outsiderMergeRatio: "0.41",
      fitScore: "0.75",
    });
    expect(parsed.medianMergeDays).toBe(1.2);
    expect(parsed.outsiderMergeRatio).toBe(0.41);
    expect(parsed.fitScore).toBe(0.75);
  });

  it("rejects an out-of-range outsider ratio", () => {
    expect(() => communityInputSchema.parse({ name: "x", outsiderMergeRatio: 1.5 })).toThrow();
  });

  it("rejects a negative median merge time", () => {
    expect(() => communityInputSchema.parse({ name: "x", medianMergeDays: -1 })).toThrow();
  });

  it("rejects an unknown status", () => {
    expect(() => communityInputSchema.parse({ name: "x", status: "shortlisted" })).toThrow();
  });

  it("accepts contributing as a status", () => {
    expect(communityInputSchema.parse({ name: "x", status: "contributing" }).status).toBe("contributing");
  });
});
```

Add `communityInputSchema` to the existing import from `../../src/domain/validators.js` at the top of that test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/domain/validators.test.ts -t "communityInputSchema"`
Expected: FAIL — `communityInputSchema is not exported` / undefined.

- [ ] **Step 3: Add the enum**

In `src/domain/enums.ts`, add after the `companyStatuses` block:

```ts
export const communityStatuses = ["researching", "watching", "contributing", "rejected", "archived"] as const;
export type CommunityStatus = (typeof communityStatuses)[number];
```

and change the `targetTypes` line to include `"community"` in the same position used by the migration:

```ts
export const targetTypes = ["profile", "session", "company", "role", "community", "preference", "preference_candidate"] as const;
```

- [ ] **Step 4: Add the type**

In `src/domain/types.ts`, add `CommunityStatus` to the existing type import from `./enums.js`, then add after the `Company` type:

```ts
export type Community = {
  id: number;
  name: string;
  url: string | null;
  ecosystem: string | null;
  summary: string | null;
  primaryLabel: string | null;
  status: CommunityStatus;
  medianMergeDays: number | null;
  outsiderMergeRatio: number | null;
  lastActivityAt: string | null;
  fitScore: NullableScore;
  fitAssessment: string | null;
  lastCheckedAt: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

- [ ] **Step 5: Add the validator**

In `src/domain/validators.ts`, add `communityStatuses` to the existing import from `./enums.js`. Add after `companyInputSchema`:

```ts
const nonNegativeNumber = z.coerce.number().min(0).nullable();

export const communityInputSchema = z.object({
  name: trimmedString.describe("Repository or organisation name (e.g. raycast/extensions)."),
  url: nullableTrimmedString,
  ecosystem: nullableTrimmedString.describe("Language or platform (e.g. Swift, TypeScript)."),
  summary: nullableTrimmedString,
  primaryLabel: nullableTrimmedString,
  status: z.enum(communityStatuses).default("researching"),
  medianMergeDays: nonNegativeNumber.default(null).describe("Median days from PR open to merge."),
  outsiderMergeRatio: scoreSchema.default(null).describe("Share of recent merges authored by non-maintainers, 0.0 to 1.0."),
  lastActivityAt: nullableTrimmedString.describe("Date of the repository's most recent push."),
  fitScore: fitScoreSchema.default(null),
  fitAssessment: nullableTrimmedString,
});
```

and add to the exported type list at the bottom:

```ts
export type CommunityInput = z.infer<typeof communityInputSchema>;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run tests/domain/validators.test.ts`
Expected: PASS.

- [ ] **Step 7: Verify and commit**

Run: `pnpm run check && pnpm test`
Expected: PASS.

```bash
git add src/domain/enums.ts src/domain/types.ts src/domain/validators.ts tests/domain/validators.test.ts
git commit -m "feat(domain): add community status, type, and validator"
```

---

### Task 3: Community repository

**Files:**
- Create: `src/repositories/communityRepository.ts`
- Test: `tests/repositories/communityRepository.test.ts`

**Interfaces:**
- Consumes: `Community` and `CommunityInput` from Task 2; the `communities` table from Task 1.
- Produces:
  - `addCommunity(db: Database.Database, input: CommunityInput): Community`
  - `getCommunity(db: Database.Database, id: number): Community | null`
  - `listCommunities(db: Database.Database, filters?: { status?: CommunityStatus }): Community[]`
  - `updateCommunity(db: Database.Database, id: number, input: CommunityUpdate): Community`
  - `CommunityUpdate = Partial<CommunityInput> & { lastCheckedAt?: string | null }`

  Tasks 4 and 5 import all four functions.

- [ ] **Step 1: Write the failing test**

Create `tests/repositories/communityRepository.test.ts`. Mirror the setup style of `tests/repositories/companyRepository.test.ts`.

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/db/client.js";
import { migrateDatabase } from "../../src/db/migrate.js";
import {
  addCommunity,
  getCommunity,
  listCommunities,
  updateCommunity,
} from "../../src/repositories/communityRepository.js";

let tempDir: string;
let dbPath: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "locus-community-"));
  dbPath = join(tempDir, "test.sqlite");
  migrateDatabase(dbPath);
});

afterEach(() => {
  rmSync(tempDir, { force: true, recursive: true });
});

function withDb<T>(fn: (db: ReturnType<typeof openDatabase>) => T): T {
  const db = openDatabase(dbPath);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

const raycast = {
  name: "raycast/extensions",
  url: "https://github.com/raycast/extensions",
  ecosystem: "TypeScript",
  summary: "Extension store, reviewed by Raycast staff.",
  primaryLabel: "high-openness",
  status: "watching" as const,
  medianMergeDays: 0.1,
  outsiderMergeRatio: 0.66,
  lastActivityAt: "2026-08-27",
  fitScore: 0.9,
  fitAssessment: "Fastest merge latency measured; ties to Raycast as a target.",
};

describe("communityRepository", () => {
  it("adds and reads back every field", () => {
    const created = withDb((db) => addCommunity(db, raycast));
    expect(created.id).toBeGreaterThan(0);
    expect(created.name).toBe("raycast/extensions");
    expect(created.ecosystem).toBe("TypeScript");
    expect(created.medianMergeDays).toBe(0.1);
    expect(created.outsiderMergeRatio).toBe(0.66);
    expect(created.lastActivityAt).toBe("2026-08-27");
    expect(created.status).toBe("watching");
    expect(created.lastCheckedAt).toBeNull();

    const fetched = withDb((db) => getCommunity(db, created.id));
    expect(fetched).toEqual(created);
  });

  it("returns null for a missing id", () => {
    expect(withDb((db) => getCommunity(db, 999))).toBeNull();
  });

  it("lists all communities and filters by status", () => {
    withDb((db) => {
      addCommunity(db, raycast);
      addCommunity(db, { ...raycast, name: "groue/GRDB.swift", status: "contributing" });
      addCommunity(db, { ...raycast, name: "anyproto/anytype-ts", status: "rejected" });
    });

    expect(withDb((db) => listCommunities(db)).length).toBe(3);
    const contributing = withDb((db) => listCommunities(db, { status: "contributing" }));
    expect(contributing.length).toBe(1);
    expect(contributing[0].name).toBe("groue/GRDB.swift");
  });

  it("updates only the supplied fields and bumps updated_at", () => {
    const created = withDb((db) => addCommunity(db, raycast));
    const updated = withDb((db) =>
      updateCommunity(db, created.id, { status: "contributing", medianMergeDays: 0.3 }),
    );

    expect(updated.status).toBe("contributing");
    expect(updated.medianMergeDays).toBe(0.3);
    expect(updated.name).toBe("raycast/extensions");
    expect(updated.outsiderMergeRatio).toBe(0.66);
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
  });

  it("throws when updating a missing community", () => {
    expect(() => withDb((db) => updateCommunity(db, 999, { status: "watching" }))).toThrow(/not found/);
  });

  it("rejects an out-of-range outsider ratio at the database boundary", () => {
    expect(() => withDb((db) => addCommunity(db, { ...raycast, outsiderMergeRatio: 2 }))).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/repositories/communityRepository.test.ts`
Expected: FAIL — cannot resolve `../../src/repositories/communityRepository.js`.

- [ ] **Step 3: Write the repository**

Create `src/repositories/communityRepository.ts`:

```ts
import type Database from "better-sqlite3";
import type { Community } from "../domain/types.js";
import type { CommunityInput } from "../domain/validators.js";

type CommunityRow = {
  id: number;
  name: string;
  url: string | null;
  ecosystem: string | null;
  summary: string | null;
  primary_label: string | null;
  status: Community["status"];
  median_merge_days: number | null;
  outsider_merge_ratio: number | null;
  last_activity_at: string | null;
  fit_score: number | null;
  fit_assessment: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

type CommunityUpdate = Partial<CommunityInput> & {
  lastCheckedAt?: string | null;
};

export function addCommunity(db: Database.Database, input: CommunityInput): Community {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `insert into communities
        (name, url, ecosystem, summary, primary_label, status, median_merge_days,
         outsider_merge_ratio, last_activity_at, fit_score, fit_assessment, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.url,
      input.ecosystem,
      input.summary,
      input.primaryLabel,
      input.status,
      input.medianMergeDays,
      input.outsiderMergeRatio,
      input.lastActivityAt,
      input.fitScore,
      input.fitAssessment,
      now,
      now,
    );
  const community = getCommunity(db, Number(result.lastInsertRowid));
  if (!community) {
    throw new Error("Failed to create community.");
  }
  return community;
}

export function getCommunity(db: Database.Database, id: number): Community | null {
  const row = db.prepare("select * from communities where id = ?").get(id) as CommunityRow | undefined;
  return row ? mapCommunity(row) : null;
}

export function listCommunities(
  db: Database.Database,
  filters: { status?: Community["status"] } = {},
): Community[] {
  const rows = filters.status
    ? (db.prepare("select * from communities where status = ? order by id").all(filters.status) as CommunityRow[])
    : (db.prepare("select * from communities order by id").all() as CommunityRow[]);
  return rows.map(mapCommunity);
}

export function updateCommunity(db: Database.Database, id: number, input: CommunityUpdate): Community {
  const current = getCommunity(db, id);
  if (!current) {
    throw new Error(`Community ${id} not found.`);
  }
  const next = {
    name: input.name ?? current.name,
    url: input.url ?? current.url,
    ecosystem: input.ecosystem ?? current.ecosystem,
    summary: input.summary ?? current.summary,
    primaryLabel: input.primaryLabel ?? current.primaryLabel,
    status: input.status ?? current.status,
    medianMergeDays: input.medianMergeDays ?? current.medianMergeDays,
    outsiderMergeRatio: input.outsiderMergeRatio ?? current.outsiderMergeRatio,
    lastActivityAt: input.lastActivityAt ?? current.lastActivityAt,
    fitScore: input.fitScore ?? current.fitScore,
    fitAssessment: input.fitAssessment ?? current.fitAssessment,
    lastCheckedAt: input.lastCheckedAt ?? current.lastCheckedAt,
    updatedAt: new Date().toISOString(),
  };
  db.prepare(
    `update communities
     set name = ?, url = ?, ecosystem = ?, summary = ?, primary_label = ?, status = ?,
         median_merge_days = ?, outsider_merge_ratio = ?, last_activity_at = ?,
         fit_score = ?, fit_assessment = ?, last_checked_at = ?, updated_at = ?
     where id = ?`,
  ).run(
    next.name,
    next.url,
    next.ecosystem,
    next.summary,
    next.primaryLabel,
    next.status,
    next.medianMergeDays,
    next.outsiderMergeRatio,
    next.lastActivityAt,
    next.fitScore,
    next.fitAssessment,
    next.lastCheckedAt,
    next.updatedAt,
    id,
  );
  const updated = getCommunity(db, id);
  if (!updated) {
    throw new Error(`Community ${id} not found after update.`);
  }
  return updated;
}

function mapCommunity(row: CommunityRow): Community {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    ecosystem: row.ecosystem,
    summary: row.summary,
    primaryLabel: row.primary_label,
    status: row.status,
    medianMergeDays: row.median_merge_days,
    outsiderMergeRatio: row.outsider_merge_ratio,
    lastActivityAt: row.last_activity_at,
    fitScore: row.fit_score,
    fitAssessment: row.fit_assessment,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/repositories/communityRepository.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Verify and commit**

Run: `pnpm run check && pnpm test`
Expected: PASS.

```bash
git add src/repositories/communityRepository.ts tests/repositories/communityRepository.test.ts
git commit -m "feat(repositories): add community repository"
```

---

### Task 4: CLI commands

**Files:**
- Modify: `src/cli/index.ts` (imports near line 19; new command block after the `company` block ending around line 152)
- Test: `tests/cli/community.test.ts`

**Interfaces:**
- Consumes: `addCommunity`, `getCommunity`, `listCommunities`, `updateCommunity` from Task 3; `communityInputSchema` from Task 2.
- Produces: `locus community add | list | show | update`.

- [ ] **Step 1: Write the failing test**

Create `tests/cli/community.test.ts`, mirroring the child-process style of `tests/cli/company-role.test.ts`. Read that file first and match its `runCli` helper exactly; the version below assumes it shells out with `LOCUS_DB_PATH` set and returns stdout.

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir: string;
let dbPath: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "locus-cli-community-"));
  dbPath = join(tempDir, "test.sqlite");
});

afterEach(() => {
  rmSync(tempDir, { force: true, recursive: true });
});

function runCli(args: string[]): string {
  return execFileSync("pnpm", ["--silent", "locus", ...args], {
    encoding: "utf8",
    env: { ...process.env, LOCUS_DB_PATH: dbPath },
  });
}

describe("locus community CLI", () => {
  it("adds a community and prints JSON", () => {
    const out = runCli([
      "community", "add",
      "--name", "raycast/extensions",
      "--ecosystem", "TypeScript",
      "--status", "watching",
      "--median-merge-days", "0.1",
      "--outsider-merge-ratio", "0.66",
      "--last-activity-at", "2026-08-27",
      "--fit-score", "0.9",
      "--json",
    ]);
    const parsed = JSON.parse(out);
    expect(parsed.community.name).toBe("raycast/extensions");
    expect(parsed.community.medianMergeDays).toBe(0.1);
    expect(parsed.community.outsiderMergeRatio).toBe(0.66);
    expect(parsed.community.status).toBe("watching");
  });

  it("lists communities and filters by status", () => {
    runCli(["community", "add", "--name", "a/one", "--status", "watching", "--json"]);
    runCli(["community", "add", "--name", "b/two", "--status", "contributing", "--json"]);

    expect(JSON.parse(runCli(["community", "list", "--json"])).communities.length).toBe(2);
    const filtered = JSON.parse(runCli(["community", "list", "--status", "contributing", "--json"]));
    expect(filtered.communities.length).toBe(1);
    expect(filtered.communities[0].name).toBe("b/two");
  });

  it("shows a single community by id", () => {
    const id = JSON.parse(runCli(["community", "add", "--name", "a/one", "--json"])).community.id;
    const shown = JSON.parse(runCli(["community", "show", "--id", String(id), "--json"]));
    expect(shown.community.name).toBe("a/one");
  });

  it("updates a community", () => {
    const id = JSON.parse(runCli(["community", "add", "--name", "a/one", "--json"])).community.id;
    const updated = JSON.parse(
      runCli(["community", "update", "--id", String(id), "--status", "contributing", "--json"]),
    );
    expect(updated.community.status).toBe("contributing");
    expect(updated.community.name).toBe("a/one");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/cli/community.test.ts`
Expected: FAIL — `error: unknown command 'community'`.

- [ ] **Step 3: Add the imports**

In `src/cli/index.ts`, add `communityInputSchema` to the existing import block from `../domain/validators.js`, and add a new import after the `companyRepository` line:

```ts
import { addCommunity, getCommunity, listCommunities, updateCommunity } from "../repositories/communityRepository.js";
```

- [ ] **Step 4: Add the command block**

In `src/cli/index.ts`, insert after the `company` command block (immediately before the `role` command group):

```ts
const community = program.command("community").description("Open-source community commands");

const communityFields = (cmd: Command): Command =>
  cmd
    .option("--name <name>", "Repository or organisation name (e.g. raycast/extensions)")
    .option("--url <url>", "Repository URL")
    .option("--ecosystem <ecosystem>", "Language or platform (e.g. Swift, TypeScript)")
    .option("--summary <summary>", "Short summary")
    .option("--primary-label <primaryLabel>", "Primary fit label")
    .option("--status <status>", "Community status")
    .option("--median-merge-days <medianMergeDays>", "Median days from PR open to merge")
    .option("--outsider-merge-ratio <outsiderMergeRatio>", "Share of recent merges from non-maintainers, 0.0 to 1.0")
    .option("--last-activity-at <lastActivityAt>", "Date of the most recent push")
    .option("--fit-score <fitScore>", "Fit score from 0.0 to 1.0")
    .option("--fit-assessment <fitAssessment>", "Fit assessment")
    .option("--stdin", "Read JSON object from stdin")
    .option("--json", "Print machine-readable JSON");

communityFields(community.command("add")).action((options: Record<string, unknown> & { json?: boolean }) => {
  ensureDatabase();
  const input = communityInputSchema.parse(jsonPayload(options));
  const db = openDatabase(process.env.LOCUS_DB_PATH);
  try {
    const created = addCommunity(db, input);
    if (options.json) {
      printJson({ community: created });
    } else {
      printText(`Added community ${created.id}: ${created.name}`);
    }
  } finally {
    db.close();
  }
});

community
  .command("list")
  .option("--status <status>", "Filter by community status")
  .option("--json", "Print machine-readable JSON")
  .action((options: { status?: string; json?: boolean }) => {
    ensureDatabase();
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const communities = listCommunities(
        db,
        options.status ? { status: communityInputSchema.shape.status.parse(options.status) } : {},
      );
      if (options.json) {
        printJson({ communities });
      } else {
        for (const item of communities) {
          printText(`${item.id}: ${item.name} [${item.status}]`);
        }
      }
    } finally {
      db.close();
    }
  });

community
  .command("show")
  .requiredOption("--id <id>", "Community id")
  .option("--json", "Print machine-readable JSON")
  .action((options: { id: string; json?: boolean }) => {
    ensureDatabase();
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const found = getCommunity(db, Number(options.id));
      if (!found) {
        throw new Error(`Community ${options.id} not found.`);
      }
      if (options.json) {
        printJson({ community: found });
      } else {
        printText(`${found.id}: ${found.name} [${found.status}]`);
      }
    } finally {
      db.close();
    }
  });

communityFields(community.command("update"))
  .requiredOption("--id <id>", "Community id")
  .action((options: Record<string, unknown> & { id: string; json?: boolean }) => {
    ensureDatabase();
    const { id, ...rest } = options;
    const input = communityInputSchema.partial().parse(jsonPayload(rest));
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const updated = updateCommunity(db, Number(id), input);
      if (options.json) {
        printJson({ community: updated });
      } else {
        printText(`Updated community ${updated.id}: ${updated.name}`);
      }
    } finally {
      db.close();
    }
  });
```

`Command` is already imported from `commander` at the top of the file; no new import is needed for the `communityFields` helper.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/cli/community.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Verify and commit**

Run: `pnpm run check && pnpm test`
Expected: PASS.

```bash
git add src/cli/index.ts tests/cli/community.test.ts
git commit -m "feat(cli): add locus community commands"
```

---

### Task 5: MCP tools and documentation

**Files:**
- Modify: `src/mcp/tools.ts` (imports at lines 7-31; new tool block after the `company_update` registration around line 104)
- Modify: `docs/mcp.md`
- Modify: `CLAUDE.md` (the MCP tool count in the Phase 4 bullet)
- Test: `tests/mcp/server.test.ts`

**Interfaces:**
- Consumes: the repository functions from Task 3 and `communityInputSchema` from Task 2.
- Produces: MCP tools `community_add`, `community_list`, `community_get`, `community_update`.

- [ ] **Step 1: Write the failing test**

Read `tests/mcp/server.test.ts` first and match how it lists tools and invokes them. Append a block in that file's existing describe:

```ts
  it("registers the community tools and round-trips a record", async () => {
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names).toContain("community_add");
    expect(names).toContain("community_list");
    expect(names).toContain("community_get");
    expect(names).toContain("community_update");

    const added = await client.callTool({
      name: "community_add",
      arguments: { name: "raycast/extensions", ecosystem: "TypeScript", status: "watching", medianMergeDays: 0.1 },
    });
    const created = JSON.parse((added.content as { text: string }[])[0].text).community;
    expect(created.name).toBe("raycast/extensions");
    expect(created.medianMergeDays).toBe(0.1);

    const updated = await client.callTool({
      name: "community_update",
      arguments: { id: created.id, status: "contributing" },
    });
    expect(JSON.parse((updated.content as { text: string }[])[0].text).community.status).toBe("contributing");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/mcp/server.test.ts -t "community tools"`
Expected: FAIL — `expected [ ... ] to contain 'community_add'`.

- [ ] **Step 3: Add the imports**

In `src/mcp/tools.ts`, add `communityStatuses` to the existing import from `../domain/enums.js`, `communityInputSchema` to the import from `../domain/validators.js`, and a new repository import after the `companyRepository` line:

```ts
import { addCommunity, getCommunity, listCommunities, updateCommunity } from "../repositories/communityRepository.js";
```

- [ ] **Step 4: Register the tools**

In `src/mcp/tools.ts`, insert after the `company_update` registration and before the `// ── roles ──` comment:

```ts
  // ── communities ──────────────────────────────────────────
  server.registerTool("community_add", { description: "Add an open-source community.", inputSchema: communityInputSchema.shape }, async (args) =>
    withDb((db) => json({ community: addCommunity(db, communityInputSchema.parse(args)) })),
  );
  server.registerTool("community_list", { description: "List open-source communities, optionally filtered by status.", inputSchema: { status: z.enum(communityStatuses).optional() } }, async (args) =>
    withDb((db) => json({ communities: listCommunities(db, args.status ? { status: args.status } : {}) })),
  );
  server.registerTool("community_get", { description: "Get a single community by id.", inputSchema: { id: idField } }, async (args) =>
    withDb((db) => {
      const community = getCommunity(db, args.id);
      if (!community) {
        throw new Error(`Community ${args.id} not found.`);
      }
      return json({ community });
    }),
  );
  server.registerTool("community_update", { description: "Update fields on a community.", inputSchema: { id: idField, ...communityInputSchema.partial().shape } }, async (args) => {
    const { id, ...rest } = args;
    return withDb((db) => json({ community: updateCommunity(db, id, communityInputSchema.partial().parse(rest)) }));
  });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/mcp/server.test.ts`
Expected: PASS.

- [ ] **Step 6: Update the documentation**

In `docs/mcp.md`, add a `community_add` / `community_list` / `community_get` / `community_update` section matching the format used for the company tools, and update any stated total tool count from 24 to 28.

In `CLAUDE.md`, update the Phase 4 bullet from "24 MCP tools" to "28 MCP tools".

- [ ] **Step 7: Verify and commit**

Run: `pnpm run check && pnpm test`
Expected: PASS.

```bash
git add src/mcp/tools.ts docs/mcp.md CLAUDE.md tests/mcp/server.test.ts
git commit -m "feat(mcp): expose community tools"
```

---

### Task 6: Backfill the 2026-08-28 findings

The spec's success criteria require the existing research to be queryable, not just storable. This task is data entry against the real database, not code.

**Files:**
- Modify: none (writes rows to the live `.locus` database via the CLI)

**Interfaces:**
- Consumes: the CLI from Task 4.
- Produces: seven community rows.

- [ ] **Step 1: Back up the live database**

```bash
cp "$(ls .locus/*.sqlite | head -1)" "/tmp/locus-backup-$(date +%Y%m%d%H%M%S).sqlite"
```

Confirm the copy exists and is non-empty before continuing.

- [ ] **Step 2: Run the migration against the live database**

```bash
pnpm locus company list --json > /dev/null
pnpm locus community list --json
```

Expected: the first command triggers `ensureDatabase()` and applies `0004`; the second prints `{"communities": []}`.

- [ ] **Step 3: Verify no research was lost**

```bash
pnpm locus export json | sed -n '/^{/,$p' | python3 -c "
import json,sys
d=json.load(sys.stdin)
f=lambda k:[d[x] for x in d if x.lower().startswith(k)][0]
print('companies', len(f('compan')), '(expect 59)')
print('notes', len(f('note')), '(expect 52)')
print('evidence', len(f('evidence')), '(expect 91)')
"
```

Expected: 59, 52, 91. **If any count is lower, stop and restore the backup.**

- [ ] **Step 4: Insert the seven communities**

```bash
pnpm locus community add --name "raycast/extensions" --url "https://github.com/raycast/extensions" \
  --ecosystem "TypeScript" --status watching --median-merge-days 0.1 --outsider-merge-ratio 0.66 \
  --last-activity-at "2026-08-27" --fit-score 0.9 --primary-label "high-openness" \
  --summary "Extension store; PRs reviewed by Raycast staff against their own craft bar. Ties directly to Raycast as a target." --json

pnpm locus community add --name "pointfreeco/swift-composable-architecture" --url "https://github.com/pointfreeco/swift-composable-architecture" \
  --ecosystem "Swift" --status watching --median-merge-days 0.5 --outsider-merge-ratio 0.51 \
  --last-activity-at "2026-08-28" --fit-score 0.85 --primary-label "own-stack" \
  --summary "Declared in Victor's Package.swift alongside ~15 other Point-Free libraries. Fast merges, roughly half from non-maintainers." --json

pnpm locus community add --name "pointfreeco/swift-sharing" --url "https://github.com/pointfreeco/swift-sharing" \
  --ecosystem "Swift" --status watching --median-merge-days 0.5 --outsider-merge-ratio 0.47 \
  --last-activity-at "2026-08-27" --fit-score 0.82 --primary-label "own-stack" \
  --summary "Smaller and newer than TCA, so more room for a first contribution. Better entry point than structured-queries." --json

pnpm locus community add --name "groue/GRDB.swift" --url "https://github.com/groue/GRDB.swift" \
  --ecosystem "Swift" --status watching --median-merge-days 1.2 --outsider-merge-ratio 0.41 \
  --last-activity-at "2026-08-08" --fit-score 0.8 --primary-label "own-stack" \
  --summary "Direct dependency of TimeCliperKit. Single exacting maintainer who does merge outsiders." --json

pnpm locus community add --name "Dimillian/IceCubesApp" --url "https://github.com/Dimillian/IceCubesApp" \
  --ecosystem "Swift" --status watching --median-merge-days 35.8 --outsider-merge-ratio 0.64 \
  --last-activity-at "2026-08-25" --fit-score 0.7 --primary-label "visibility" \
  --summary "The flagship open-source SwiftUI app, ~7k stars, in the Mastodon/Apple-dev community where target companies look. Generous to outsiders but slow to merge." --json

pnpm locus community add --name "logseq/logseq" --url "https://github.com/logseq/logseq" \
  --ecosystem "Clojure" --status rejected --last-activity-at "2026-08-27" --fit-score 0.4 \
  --primary-label "stack-mismatch" \
  --summary "Excellent PKM fit with 15 labelled good-first-issues and a healthy outsider spread, but Clojure/ClojureScript is a genuine stack barrier." --json

pnpm locus community add --name "anyproto/anytype-ts" --url "https://github.com/anyproto/anytype-ts" \
  --ecosystem "TypeScript" --status rejected --median-merge-days 0 --outsider-merge-ratio 0.05 \
  --last-activity-at "2026-08-26" --fit-score 0.3 --primary-label "closed-in-practice" \
  --summary "Open source by licence, closed in practice: 38 of 40 recent merges by a single core developer." --json
```

- [ ] **Step 5: Verify the backfill**

```bash
pnpm locus community list --json
```

Expected: seven communities, five `watching` and two `rejected`.

- [ ] **Step 6: Record the source note**

```bash
pnpm locus note add --session-id 11 --kind decision \
  --title "OSS community findings migrated from note 52 into the communities table" \
  --body "The 2026-08-28 openness sweep now lives as seven structured community rows rather than prose. Note 52 remains the narrative record; the table is the queryable one and is the thing to re-check, because openness decays. Verified after migration 0004 that all 59 companies, 52 notes and 91 evidence rows survived the notes/evidence rebuild." --json
```

- [ ] **Step 7: Commit**

The database is gitignored, so this commit covers only any documentation touched:

```bash
git status --short
git commit --allow-empty -m "chore: backfill OSS community findings into the communities table"
```

---

## Self-Review

**Spec coverage.** Schema → Task 1. Domain layer → Task 2. Repository → Task 3. CLI → Task 4. MCP and docs → Task 5. Testing → distributed across Tasks 1-5, with the migration risk concentrated in Task 1 Step 1. Migration and rollout → Task 6. Success criteria: `pnpm run check`/`pnpm test` are gates in every task; the migration test is Task 1; queryable findings are Task 6; re-checkability follows from `updateCommunity` plus `last_checked_at` in Task 3.

**Corrections made against the spec.** The spec said MCP tools would be named `locus_community_*`; the codebase convention is `company_add`, so the plan uses `community_add`. The spec did not mention `CLAUDE.md`'s hard-coded tool count, which Task 5 Step 6 now updates.

**Type consistency.** `CommunityInput` field names (`medianMergeDays`, `outsiderMergeRatio`, `lastActivityAt`, `primaryLabel`, `fitScore`, `fitAssessment`) are identical in the validator (Task 2), the repository's `next` object and `mapCommunity` (Task 3), the CLI flags via Commander's camelCase conversion (Task 4), and the MCP schemas which reuse `communityInputSchema.shape` (Task 5). Column names (`median_merge_days`, `outsider_merge_ratio`, `last_activity_at`, `primary_label`) are identical between the migration (Task 1), `schema.sql` (Task 1 Step 6), and `CommunityRow` (Task 3). `communityStatuses` is defined once in Task 2 and consumed by Tasks 4 and 5.

**Known risk left in place.** Task 6 mutates the live database. Its backup step is mandatory and its verification step names exact expected counts with an explicit stop-and-restore instruction.
