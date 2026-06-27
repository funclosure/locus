# Phase 1 Data Layer And CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first local Locus data layer and CLI slice so agents can initialize the database, read the approved profile, and start/show research sessions.

**Architecture:** Use a single TypeScript package for CLI, domain types, validation, SQLite migrations, and repository functions. Keep UI concerns out of Phase 1. Store data in local SQLite and expose JSON-first CLI output for agents.

**Tech Stack:** Node.js, TypeScript, pnpm, Vitest, Zod, Commander, better-sqlite3, SQLite.

---

## File Structure

- Create `package.json`: package scripts, CLI bin, dependencies.
- Create `tsconfig.json`: TypeScript compiler settings for Node.
- Create `vitest.config.ts`: test configuration.
- Create `.gitignore`: local database, build output, dependencies, env files.
- Create `src/domain/enums.ts`: enum arrays and TypeScript union types.
- Create `src/domain/types.ts`: domain object types matching `docs/PLAN.md`.
- Create `src/domain/validators.ts`: Zod schemas and range validation helpers.
- Create `src/db/schema.sql`: canonical SQLite schema.
- Create `src/db/migrations/0001_initial.sql`: first migration copied from the canonical schema.
- Create `src/db/client.ts`: SQLite connection helper and path resolution.
- Create `src/db/migrate.ts`: migration runner.
- Create `src/db/seed.ts`: default profile seed.
- Create `src/repositories/profileRepository.ts`: profile reads.
- Create `src/repositories/sessionRepository.ts`: session create/read operations.
- Create `src/cli/output.ts`: JSON/text output helpers.
- Create `src/cli/index.ts`: CLI entrypoint with `profile show`, `session start`, and `session show`.
- Create `tests/domain/validators.test.ts`: validation tests.
- Create `tests/db/migrate.test.ts`: migration and seed tests.
- Create `tests/repositories/sessionRepository.test.ts`: repository behavior tests.
- Create `tests/cli/cli.test.ts`: CLI behavior tests.

## Task 1: Workspace Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Add package scripts and dependencies**

Create `package.json`:

```json
{
  "name": "locus",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "locus": "./dist/cli/index.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:seed": "tsx src/db/seed.ts",
    "locus": "tsx src/cli/index.ts"
  },
  "dependencies": {
    "better-sqlite3": "^11.10.0",
    "commander": "^12.1.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^22.15.0",
    "tsx": "^4.20.0",
    "typescript": "^5.8.0",
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 2: Add TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "tests"]
}
```

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
  },
});
```

- [ ] **Step 4: Add ignore rules**

Create `.gitignore`:

```gitignore
node_modules/
dist/
.env
.env.local
.locus/
*.sqlite
*.sqlite-shm
*.sqlite-wal
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` is created and install exits successfully.

- [ ] **Step 6: Verify empty toolchain**

Run:

```bash
pnpm check
```

Expected: fails because `src` does not exist yet or no inputs are found. This is acceptable before Task 2.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.ts .gitignore
git commit -m "chore: initialize TypeScript workspace"
```

## Task 2: Domain Enums And Validators

**Files:**
- Create: `src/domain/enums.ts`
- Create: `src/domain/types.ts`
- Create: `src/domain/validators.ts`
- Create: `tests/domain/validators.test.ts`

- [ ] **Step 1: Write failing validator tests**

Create `tests/domain/validators.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  companyInputSchema,
  confidenceSchema,
  fitScoreSchema,
  sessionStartInputSchema,
} from "../../src/domain/validators.js";

describe("range validators", () => {
  it("accepts null or values from 0.0 through 1.0", () => {
    expect(confidenceSchema.parse(null)).toBeNull();
    expect(confidenceSchema.parse(0)).toBe(0);
    expect(confidenceSchema.parse(0.5)).toBe(0.5);
    expect(confidenceSchema.parse(1)).toBe(1);
    expect(fitScoreSchema.parse(null)).toBeNull();
  });

  it("rejects values outside 0.0 through 1.0", () => {
    expect(() => confidenceSchema.parse(-0.01)).toThrow();
    expect(() => confidenceSchema.parse(1.01)).toThrow();
    expect(() => fitScoreSchema.parse(2)).toThrow();
  });
});

describe("sessionStartInputSchema", () => {
  it("normalizes a minimal session start input", () => {
    expect(sessionStartInputSchema.parse({ goal: "Research AI-native notes companies" })).toEqual({
      profileId: 1,
      title: null,
      goal: "Research AI-native notes companies",
    });
  });
});

describe("companyInputSchema", () => {
  it("defaults company status to researching", () => {
    expect(companyInputSchema.parse({ name: "Things" }).status).toBe("researching");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm test tests/domain/validators.test.ts
```

Expected: FAIL because `src/domain/validators.ts` does not exist.

- [ ] **Step 3: Add enum definitions**

Create `src/domain/enums.ts`:

```ts
export const companyStatuses = ["researching", "shortlisted", "watching", "rejected", "archived"] as const;
export type CompanyStatus = (typeof companyStatuses)[number];

export const roleStatuses = ["researching", "interested", "applied", "rejected", "closed", "archived"] as const;
export type RoleStatus = (typeof roleStatuses)[number];

export const sessionStatuses = ["active", "paused", "completed", "archived"] as const;
export type SessionStatus = (typeof sessionStatuses)[number];

export const candidateStatuses = ["pending", "approved", "rejected", "superseded"] as const;
export type CandidateStatus = (typeof candidateStatuses)[number];

export const preferenceKinds = ["requirement", "positive_signal", "negative_signal", "interest", "constraint"] as const;
export type PreferenceKind = (typeof preferenceKinds)[number];

export const memoryKinds = ["observation", "inference", "decision", "question", "summary"] as const;
export type MemoryKind = (typeof memoryKinds)[number];

export const noteKinds = ["observation", "decision", "question", "summary"] as const;
export type NoteKind = (typeof noteKinds)[number];

export const sourceTypes = ["company_site", "job_post", "article", "social", "docs", "manual", "other"] as const;
export type SourceType = (typeof sourceTypes)[number];

export const remotePolicies = ["remote", "hybrid", "onsite", "unknown"] as const;
export type RemotePolicy = (typeof remotePolicies)[number];

export const targetTypes = ["profile", "session", "company", "role", "preference", "preference_candidate"] as const;
export type TargetType = (typeof targetTypes)[number];

export const preferenceSources = ["manual", "approved_candidate", "import"] as const;
export type PreferenceSource = (typeof preferenceSources)[number];
```

- [ ] **Step 4: Add domain types**

Create `src/domain/types.ts`:

```ts
import type {
  CandidateStatus,
  CompanyStatus,
  MemoryKind,
  NoteKind,
  PreferenceKind,
  PreferenceSource,
  RemotePolicy,
  RoleStatus,
  SessionStatus,
  SourceType,
  TargetType,
} from "./enums.js";

export type Timestamp = string;
export type NullableScore = number | null;

export type Profile = {
  id: number;
  name: string;
  summary: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ProfilePreference = {
  id: number;
  profileId: number;
  kind: PreferenceKind;
  label: string;
  description: string;
  weight: NullableScore;
  source: PreferenceSource;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Session = {
  id: number;
  profileId: number;
  title: string;
  goal: string;
  status: SessionStatus;
  startedAt: Timestamp;
  endedAt: Timestamp | null;
  summary: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type SessionMemory = {
  id: number;
  sessionId: number;
  kind: MemoryKind;
  content: string;
  confidence: NullableScore;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type PreferenceCandidate = {
  id: number;
  sessionId: number;
  profileId: number;
  kind: PreferenceKind;
  label: string;
  description: string;
  confidence: NullableScore;
  status: CandidateStatus;
  createdAt: Timestamp;
  reviewedAt: Timestamp | null;
};

export type Company = {
  id: number;
  name: string;
  url: string | null;
  hq: string | null;
  summary: string | null;
  primaryLabel: string | null;
  status: CompanyStatus;
  fitScore: NullableScore;
  fitAssessment: string | null;
  lastCheckedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Role = {
  id: number;
  companyId: number;
  title: string;
  url: string | null;
  location: string | null;
  remotePolicy: RemotePolicy;
  seniority: string | null;
  compensation: string | null;
  summary: string | null;
  status: RoleStatus;
  fitScore: NullableScore;
  fitAssessment: string | null;
  lastCheckedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Note = {
  id: number;
  sessionId: number | null;
  targetType: TargetType | null;
  targetId: number | null;
  title: string | null;
  body: string;
  kind: NoteKind;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Evidence = {
  id: number;
  targetType: TargetType;
  targetId: number;
  url: string;
  title: string | null;
  snippet: string;
  sourceType: SourceType;
  confidence: NullableScore;
  checkedAt: Timestamp;
  createdAt: Timestamp;
};
```

- [ ] **Step 5: Add Zod validators**

Create `src/domain/validators.ts`:

```ts
import { z } from "zod";
import {
  companyStatuses,
  memoryKinds,
  noteKinds,
  preferenceKinds,
  remotePolicies,
  roleStatuses,
  sourceTypes,
  targetTypes,
} from "./enums.js";

const trimmedString = z.string().trim().min(1);
const nullableTrimmedString = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const scoreSchema = z.number().min(0).max(1).nullable();
export const confidenceSchema = scoreSchema;
export const fitScoreSchema = scoreSchema;

export const sessionStartInputSchema = z.object({
  profileId: z.coerce.number().int().positive().default(1),
  title: nullableTrimmedString,
  goal: trimmedString,
});

export const companyInputSchema = z.object({
  name: trimmedString,
  url: nullableTrimmedString,
  hq: nullableTrimmedString,
  summary: nullableTrimmedString,
  primaryLabel: nullableTrimmedString,
  status: z.enum(companyStatuses).default("researching"),
  fitScore: fitScoreSchema.default(null),
  fitAssessment: nullableTrimmedString,
});

export const roleInputSchema = z.object({
  companyId: z.coerce.number().int().positive(),
  title: trimmedString,
  url: nullableTrimmedString,
  location: nullableTrimmedString,
  remotePolicy: z.enum(remotePolicies).default("unknown"),
  seniority: nullableTrimmedString,
  compensation: nullableTrimmedString,
  summary: nullableTrimmedString,
  status: z.enum(roleStatuses).default("researching"),
  fitScore: fitScoreSchema.default(null),
  fitAssessment: nullableTrimmedString,
});

export const noteInputSchema = z.object({
  sessionId: z.coerce.number().int().positive().nullable().optional().default(null),
  targetType: z.enum(targetTypes).nullable().optional().default(null),
  targetId: z.coerce.number().int().positive().nullable().optional().default(null),
  title: nullableTrimmedString,
  body: trimmedString,
  kind: z.enum(noteKinds).default("observation"),
});

export const evidenceInputSchema = z.object({
  targetType: z.enum(targetTypes),
  targetId: z.coerce.number().int().positive(),
  url: z.string().trim().url(),
  title: nullableTrimmedString,
  snippet: trimmedString,
  sourceType: z.enum(sourceTypes).default("other"),
  confidence: confidenceSchema.default(null),
});

export const sessionMemoryInputSchema = z.object({
  sessionId: z.coerce.number().int().positive(),
  kind: z.enum(memoryKinds).default("observation"),
  content: trimmedString,
  confidence: confidenceSchema.default(null),
});

export type SessionStartInput = z.infer<typeof sessionStartInputSchema>;
export type CompanyInput = z.infer<typeof companyInputSchema>;
export type RoleInput = z.infer<typeof roleInputSchema>;
export type NoteInput = z.infer<typeof noteInputSchema>;
export type EvidenceInput = z.infer<typeof evidenceInputSchema>;
```

- [ ] **Step 6: Run validator tests**

Run:

```bash
pnpm test tests/domain/validators.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run typecheck**

Run:

```bash
pnpm check
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain tests/domain
git commit -m "feat: add Locus domain types and validators"
```

## Task 3: SQLite Schema And Migration Runner

**Files:**
- Create: `src/db/schema.sql`
- Create: `src/db/migrations/0001_initial.sql`
- Create: `src/db/client.ts`
- Create: `src/db/migrate.ts`
- Create: `tests/db/migrate.test.ts`

- [ ] **Step 1: Write failing migration test**

Create `tests/db/migrate.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "../../src/db/migrate.js";

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { force: true, recursive: true });
    tempDir = null;
  }
});

describe("migrateDatabase", () => {
  it("creates the initial schema and records the migration", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-migrate-"));
    const dbPath = join(tempDir, "test.sqlite");

    migrateDatabase(dbPath);

    const db = new Database(dbPath, { readonly: true });
    const tables = db
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toContain("profiles");
    expect(tables).toContain("sessions");
    expect(tables).toContain("companies");
    expect(tables).toContain("roles");
    expect(tables).toContain("schema_migrations");

    const migration = db
      .prepare("select version from schema_migrations where version = ?")
      .get("0001_initial") as { version: string } | undefined;

    expect(migration?.version).toBe("0001_initial");
    db.close();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm test tests/db/migrate.test.ts
```

Expected: FAIL because `src/db/migrate.ts` does not exist.

- [ ] **Step 3: Add canonical schema**

Create `src/db/schema.sql` and copy the same content into `src/db/migrations/0001_initial.sql`:

```sql
pragma foreign_keys = on;

create table if not exists schema_migrations (
  version text primary key,
  applied_at text not null default (datetime('now'))
);

create table profiles (
  id integer primary key autoincrement,
  name text not null,
  summary text not null,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table profile_preferences (
  id integer primary key autoincrement,
  profile_id integer not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('requirement', 'positive_signal', 'negative_signal', 'interest', 'constraint')),
  label text not null,
  description text not null,
  weight real check (weight is null or (weight >= 0 and weight <= 1)),
  source text not null check (source in ('manual', 'approved_candidate', 'import')),
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table sessions (
  id integer primary key autoincrement,
  profile_id integer not null references profiles(id) on delete cascade,
  title text not null,
  goal text not null,
  status text not null check (status in ('active', 'paused', 'completed', 'archived')),
  started_at text not null,
  ended_at text,
  summary text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table session_memory (
  id integer primary key autoincrement,
  session_id integer not null references sessions(id) on delete cascade,
  kind text not null check (kind in ('observation', 'inference', 'decision', 'question', 'summary')),
  content text not null,
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table preference_candidates (
  id integer primary key autoincrement,
  session_id integer not null references sessions(id) on delete cascade,
  profile_id integer not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('requirement', 'positive_signal', 'negative_signal', 'interest', 'constraint')),
  label text not null,
  description text not null,
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status text not null check (status in ('pending', 'approved', 'rejected', 'superseded')),
  created_at text not null default (datetime('now')),
  reviewed_at text
);

create table companies (
  id integer primary key autoincrement,
  name text not null,
  url text,
  hq text,
  summary text,
  primary_label text,
  status text not null check (status in ('researching', 'shortlisted', 'watching', 'rejected', 'archived')),
  fit_score real check (fit_score is null or (fit_score >= 0 and fit_score <= 1)),
  fit_assessment text,
  last_checked_at text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table roles (
  id integer primary key autoincrement,
  company_id integer not null references companies(id) on delete cascade,
  title text not null,
  url text,
  location text,
  remote_policy text not null check (remote_policy in ('remote', 'hybrid', 'onsite', 'unknown')),
  seniority text,
  compensation text,
  summary text,
  status text not null check (status in ('researching', 'interested', 'applied', 'rejected', 'closed', 'archived')),
  fit_score real check (fit_score is null or (fit_score >= 0 and fit_score <= 1)),
  fit_assessment text,
  last_checked_at text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table notes (
  id integer primary key autoincrement,
  session_id integer references sessions(id) on delete set null,
  target_type text check (target_type is null or target_type in ('profile', 'session', 'company', 'role', 'preference', 'preference_candidate')),
  target_id integer,
  title text,
  body text not null,
  kind text not null check (kind in ('observation', 'decision', 'question', 'summary')),
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table evidence (
  id integer primary key autoincrement,
  target_type text not null check (target_type in ('profile', 'session', 'company', 'role', 'preference', 'preference_candidate')),
  target_id integer not null,
  url text not null,
  title text,
  snippet text not null,
  source_type text not null check (source_type in ('company_site', 'job_post', 'article', 'social', 'docs', 'manual', 'other')),
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  checked_at text not null,
  created_at text not null default (datetime('now'))
);

create table tags (
  id integer primary key autoincrement,
  name text not null unique,
  color text
);

create table taggings (
  id integer primary key autoincrement,
  tag_id integer not null references tags(id) on delete cascade,
  target_type text not null check (target_type in ('profile', 'session', 'company', 'role', 'preference', 'preference_candidate')),
  target_id integer not null,
  unique (tag_id, target_type, target_id)
);

create table exports (
  id integer primary key autoincrement,
  session_id integer references sessions(id) on delete set null,
  format text not null check (format in ('markdown', 'json')),
  title text not null,
  path text not null,
  created_at text not null default (datetime('now'))
);

create index idx_sessions_profile_id on sessions(profile_id);
create index idx_roles_company_id on roles(company_id);
create index idx_notes_target on notes(target_type, target_id);
create index idx_evidence_target on evidence(target_type, target_id);
create index idx_taggings_target on taggings(target_type, target_id);
```

- [ ] **Step 4: Add database client**

Create `src/db/client.ts`:

```ts
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

export function defaultDatabasePath(): string {
  return resolve(process.cwd(), ".locus", "locus.sqlite");
}

export function openDatabase(dbPath = process.env.LOCUS_DB_PATH ?? defaultDatabasePath()): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  return db;
}
```

- [ ] **Step 5: Add migration runner**

Create `src/db/migrate.ts`:

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const migrations = [
  {
    version: "0001_initial",
    path: join(__dirname, "migrations", "0001_initial.sql"),
  },
];

export function migrateDatabase(dbPath?: string): void {
  const db = openDatabase(dbPath);
  try {
    db.exec("pragma foreign_keys = on");
    db.exec("create table if not exists schema_migrations (version text primary key, applied_at text not null default (datetime('now')))");

    const hasMigration = db.prepare("select 1 from schema_migrations where version = ?");
    const apply = db.transaction((version: string, sql: string) => {
      db.exec(sql);
      db.prepare("insert or ignore into schema_migrations (version) values (?)").run(version);
    });

    for (const migration of migrations) {
      const applied = hasMigration.get(migration.version);
      if (!applied) {
        apply(migration.version, readFileSync(migration.path, "utf8"));
      }
    }
  } finally {
    db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrateDatabase(process.env.LOCUS_DB_PATH);
}
```

- [ ] **Step 6: Run migration tests**

Run:

```bash
pnpm test tests/db/migrate.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run typecheck**

Run:

```bash
pnpm check
```

Expected: PASS.

- [ ] **Step 8: Checkpoint for Claude review**

Append to `convo.md` using `skills/convo/SKILL.md`:

```bash
ts=$(date -Iseconds)
cat >> convo.md << EOF

---
timestamp: ${ts}
from: Codex
to: Claude
topic: Phase 1 migration checkpoint

Checkpoint: Initial schema migration and domain validators are drafted. Please review enum names, column coverage, and whether any migration detail conflicts with docs/PLAN.md before I expand the CLI command surface.
EOF
```

- [ ] **Step 9: Commit**

```bash
git add src/db tests/db src/domain tests/domain convo.md
git commit -m "feat: add initial SQLite schema and migrations"
```

## Task 4: Seed Profile And Profile Repository

**Files:**
- Create: `src/db/seed.ts`
- Create: `src/repositories/profileRepository.ts`
- Create: `tests/repositories/profileRepository.test.ts`

- [ ] **Step 1: Write failing repository test**

Create `tests/repositories/profileRepository.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "../../src/db/migrate.js";
import { seedDefaultProfile } from "../../src/db/seed.js";
import { openDatabase } from "../../src/db/client.js";
import { getDefaultProfile } from "../../src/repositories/profileRepository.js";

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { force: true, recursive: true });
    tempDir = null;
  }
});

describe("profileRepository", () => {
  it("returns the seeded default profile", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-profile-"));
    const dbPath = join(tempDir, "test.sqlite");
    migrateDatabase(dbPath);
    seedDefaultProfile(dbPath);

    const db = openDatabase(dbPath);
    const profile = getDefaultProfile(db);
    db.close();

    expect(profile.name).toBe("Victor");
    expect(profile.summary).toContain("iOS developer in Hong Kong");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm test tests/repositories/profileRepository.test.ts
```

Expected: FAIL because `src/db/seed.ts` and repository file do not exist.

- [ ] **Step 3: Add default seed**

Create `src/db/seed.ts`:

```ts
import { openDatabase } from "./client.js";

const defaultSummary =
  "iOS developer in Hong Kong researching remote roles at craft-driven, AI-first, Apple-platform, notes, writing, and knowledge-tool companies.";

const defaultPreferences = [
  ["requirement", "Remote required", "Remote work is a hard requirement.", 1, "manual"],
  ["interest", "iOS and Apple platforms", "Strong interest in iOS, interaction design, and Apple-platform-native products.", 0.95, "manual"],
  ["interest", "AI-first products", "Interested in teams building AI-first products with strong product taste.", 0.85, "manual"],
  ["positive_signal", "Craft-driven teams", "Prefers small, high-quality teams with strong design and product craft.", 0.9, "manual"],
] as const;

export function seedDefaultProfile(dbPath?: string): void {
  const db = openDatabase(dbPath);
  try {
    const now = new Date().toISOString();
    const insertProfile = db.prepare(`
      insert into profiles (id, name, summary, created_at, updated_at)
      values (1, 'Victor', ?, ?, ?)
      on conflict(id) do update set summary = excluded.summary, updated_at = excluded.updated_at
    `);
    insertProfile.run(defaultSummary, now, now);

    const insertPreference = db.prepare(`
      insert into profile_preferences (profile_id, kind, label, description, weight, source, created_at, updated_at)
      select 1, ?, ?, ?, ?, ?, ?, ?
      where not exists (
        select 1 from profile_preferences where profile_id = 1 and label = ?
      )
    `);

    for (const [kind, label, description, weight, source] of defaultPreferences) {
      insertPreference.run(kind, label, description, weight, source, now, now, label);
    }
  } finally {
    db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDefaultProfile(process.env.LOCUS_DB_PATH);
}
```

- [ ] **Step 4: Add profile repository**

Create `src/repositories/profileRepository.ts`:

```ts
import type Database from "better-sqlite3";
import type { Profile, ProfilePreference } from "../domain/types.js";

type ProfileRow = {
  id: number;
  name: string;
  summary: string;
  created_at: string;
  updated_at: string;
};

type PreferenceRow = {
  id: number;
  profile_id: number;
  kind: ProfilePreference["kind"];
  label: string;
  description: string;
  weight: number | null;
  source: ProfilePreference["source"];
  created_at: string;
  updated_at: string;
};

export function getDefaultProfile(db: Database.Database): Profile {
  const row = db.prepare("select * from profiles where id = 1").get() as ProfileRow | undefined;
  if (!row) {
    throw new Error("Default profile not found. Run `pnpm db:seed` first.");
  }
  return mapProfile(row);
}

export function listProfilePreferences(db: Database.Database, profileId = 1): ProfilePreference[] {
  const rows = db
    .prepare("select * from profile_preferences where profile_id = ? order by id")
    .all(profileId) as PreferenceRow[];
  return rows.map(mapPreference);
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPreference(row: PreferenceRow): ProfilePreference {
  return {
    id: row.id,
    profileId: row.profile_id,
    kind: row.kind,
    label: row.label,
    description: row.description,
    weight: row.weight,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

- [ ] **Step 5: Run repository test**

Run:

```bash
pnpm test tests/repositories/profileRepository.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/seed.ts src/repositories/profileRepository.ts tests/repositories/profileRepository.test.ts
git commit -m "feat: seed and read default profile"
```

## Task 5: Session Repository

**Files:**
- Create: `src/repositories/sessionRepository.ts`
- Create: `tests/repositories/sessionRepository.test.ts`

- [ ] **Step 1: Write failing session repository tests**

Create `tests/repositories/sessionRepository.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/db/client.js";
import { migrateDatabase } from "../../src/db/migrate.js";
import { seedDefaultProfile } from "../../src/db/seed.js";
import { createSession, getSession } from "../../src/repositories/sessionRepository.js";

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { force: true, recursive: true });
    tempDir = null;
  }
});

describe("sessionRepository", () => {
  it("creates and reads an active session", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-session-"));
    const dbPath = join(tempDir, "test.sqlite");
    migrateDatabase(dbPath);
    seedDefaultProfile(dbPath);
    const db = openDatabase(dbPath);

    const session = createSession(db, {
      profileId: 1,
      title: null,
      goal: "Research AI-native notes companies",
    });
    const fetched = getSession(db, session.id);
    db.close();

    expect(session.status).toBe("active");
    expect(session.title).toBe("Research AI-native notes companies");
    expect(fetched?.id).toBe(session.id);
    expect(fetched?.goal).toBe("Research AI-native notes companies");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm test tests/repositories/sessionRepository.test.ts
```

Expected: FAIL because `sessionRepository.ts` does not exist.

- [ ] **Step 3: Add session repository**

Create `src/repositories/sessionRepository.ts`:

```ts
import type Database from "better-sqlite3";
import type { Session } from "../domain/types.js";
import type { SessionStartInput } from "../domain/validators.js";

type SessionRow = {
  id: number;
  profile_id: number;
  title: string;
  goal: string;
  status: Session["status"];
  started_at: string;
  ended_at: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

export function createSession(db: Database.Database, input: SessionStartInput): Session {
  const now = new Date().toISOString();
  const title = input.title ?? input.goal;
  const result = db
    .prepare(
      `insert into sessions
        (profile_id, title, goal, status, started_at, created_at, updated_at)
       values (?, ?, ?, 'active', ?, ?, ?)`,
    )
    .run(input.profileId, title, input.goal, now, now, now);

  const session = getSession(db, Number(result.lastInsertRowid));
  if (!session) {
    throw new Error("Failed to create session.");
  }
  return session;
}

export function getSession(db: Database.Database, id: number): Session | null {
  const row = db.prepare("select * from sessions where id = ?").get(id) as SessionRow | undefined;
  return row ? mapSession(row) : null;
}

export function getActiveSession(db: Database.Database): Session | null {
  const row = db
    .prepare("select * from sessions where status = 'active' order by started_at desc, id desc limit 1")
    .get() as SessionRow | undefined;
  return row ? mapSession(row) : null;
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    profileId: row.profile_id,
    title: row.title,
    goal: row.goal,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

- [ ] **Step 4: Run session repository tests**

Run:

```bash
pnpm test tests/repositories/sessionRepository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/sessionRepository.ts tests/repositories/sessionRepository.test.ts
git commit -m "feat: create and read research sessions"
```

## Task 6: Initial CLI Commands

**Files:**
- Create: `src/cli/output.ts`
- Create: `src/cli/index.ts`
- Create: `tests/cli/cli.test.ts`

- [ ] **Step 1: Write failing CLI tests**

Create `tests/cli/cli.test.ts`:

```ts
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

let tempDir: string | null = null;

function runCli(args: string[], dbPath: string): string {
  return execFileSync("pnpm", ["tsx", "src/cli/index.ts", ...args], {
    cwd: process.cwd(),
    env: { ...process.env, LOCUS_DB_PATH: dbPath },
    encoding: "utf8",
  });
}

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { force: true, recursive: true });
    tempDir = null;
  }
});

describe("locus CLI", () => {
  it("shows the seeded profile as JSON", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-cli-"));
    const dbPath = join(tempDir, "test.sqlite");

    const output = runCli(["profile", "show", "--json"], dbPath);
    const parsed = JSON.parse(output);

    expect(parsed.profile.name).toBe("Victor");
    expect(parsed.preferences.length).toBeGreaterThan(0);
  });

  it("starts and shows an active session as JSON", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-cli-"));
    const dbPath = join(tempDir, "test.sqlite");

    const startOutput = runCli(["session", "start", "--goal", "Research AI notes tools", "--json"], dbPath);
    const started = JSON.parse(startOutput);

    expect(started.session.id).toBe(1);
    expect(started.session.status).toBe("active");

    const showOutput = runCli(["session", "show", "--json"], dbPath);
    const shown = JSON.parse(showOutput);

    expect(shown.session.id).toBe(started.session.id);
    expect(shown.session.goal).toBe("Research AI notes tools");
  });
});
```

- [ ] **Step 2: Run CLI tests to verify failure**

Run:

```bash
pnpm test tests/cli/cli.test.ts
```

Expected: FAIL because `src/cli/index.ts` does not exist.

- [ ] **Step 3: Add output helpers**

Create `src/cli/output.ts`:

```ts
export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printText(message: string): void {
  process.stdout.write(`${message}\n`);
}
```

- [ ] **Step 4: Add CLI entrypoint**

Create `src/cli/index.ts`:

```ts
#!/usr/bin/env node
import { Command } from "commander";
import { openDatabase } from "../db/client.js";
import { migrateDatabase } from "../db/migrate.js";
import { seedDefaultProfile } from "../db/seed.js";
import { sessionStartInputSchema } from "../domain/validators.js";
import { printJson, printText } from "./output.js";
import { getDefaultProfile, listProfilePreferences } from "../repositories/profileRepository.js";
import { createSession, getActiveSession, getSession } from "../repositories/sessionRepository.js";

function ensureDatabase(): void {
  migrateDatabase(process.env.LOCUS_DB_PATH);
  seedDefaultProfile(process.env.LOCUS_DB_PATH);
}

const program = new Command();

program.name("locus").description("Local agent-usable job search knowledge system").version("0.1.0");

const profile = program.command("profile").description("Profile commands");

profile
  .command("show")
  .option("--json", "Print machine-readable JSON")
  .action((options: { json?: boolean }) => {
    ensureDatabase();
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const payload = {
        profile: getDefaultProfile(db),
        preferences: listProfilePreferences(db, 1),
      };
      if (options.json) {
        printJson(payload);
      } else {
        printText(`${payload.profile.name}: ${payload.profile.summary}`);
      }
    } finally {
      db.close();
    }
  });

const session = program.command("session").description("Session commands");

session
  .command("start")
  .requiredOption("--goal <goal>", "Research goal")
  .option("--title <title>", "Short session title")
  .option("--profile-id <profileId>", "Profile id", "1")
  .option("--json", "Print machine-readable JSON")
  .action((options: { goal: string; title?: string; profileId: string; json?: boolean }) => {
    ensureDatabase();
    const input = sessionStartInputSchema.parse({
      goal: options.goal,
      title: options.title ?? null,
      profileId: options.profileId,
    });
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const created = createSession(db, input);
      if (options.json) {
        printJson({ session: created });
      } else {
        printText(`Started session ${created.id}: ${created.title}`);
      }
    } finally {
      db.close();
    }
  });

session
  .command("show")
  .option("--id <id>", "Session id")
  .option("--json", "Print machine-readable JSON")
  .action((options: { id?: string; json?: boolean }) => {
    ensureDatabase();
    const db = openDatabase(process.env.LOCUS_DB_PATH);
    try {
      const found = options.id ? getSession(db, Number(options.id)) : getActiveSession(db);
      if (!found) {
        throw new Error("No session found.");
      }
      if (options.json) {
        printJson({ session: found });
      } else {
        printText(`${found.id}: ${found.title} [${found.status}]`);
      }
    } finally {
      db.close();
    }
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
```

- [ ] **Step 5: Run CLI tests**

Run:

```bash
pnpm test tests/cli/cli.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run full verification**

Run:

```bash
pnpm test
pnpm check
pnpm build
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/cli tests/cli package.json
git commit -m "feat: add initial Locus CLI commands"
```

## Task 7: Update Documentation And Handoff

**Files:**
- Modify: `docs/PLAN.md`
- Modify: `convo.md`

- [ ] **Step 1: Update `docs/PLAN.md` Phase 1 status**

Add this under `## Phase 1: Data Layer And CLI` after the deliverables list:

```md
Initial implementation slice:

- Database migration and seed profile.
- TypeScript domain types and validation helpers.
- `locus profile show --json`.
- `locus session start --goal "Research AI-native notes companies" --json`.
- `locus session show --json`.

CLI input contract:

- Prefer flags for simple reads and single-field operations.
- Accept stdin JSON for complex writes in later commands.
- Every write command with `--json` returns the created or updated record.
```

- [ ] **Step 2: Append Claude handoff**

Append to `convo.md`:

```bash
ts=$(date -Iseconds)
cat >> convo.md << EOF

---
timestamp: ${ts}
from: Codex
to: Claude
topic: Phase 1 migration + CLI checkpoint

Checkpoint: Phase 1 first slice is implemented: migration, seed profile, domain validators, profile show, session start, and session show. Please review before I expand into company, role, note, evidence, preference, and export commands.
EOF
```

- [ ] **Step 3: Run final verification**

Run:

```bash
pnpm test
pnpm check
pnpm build
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/PLAN.md convo.md
git commit -m "docs: record Phase 1 CLI checkpoint"
```

## Self-Review Checklist

- Spec coverage: covers Phase 1 foundation, migration setup, domain types, seed profile, initial CLI, JSON output, and Claude checkpoint.
- Scope boundary: defers company, role, note, evidence, preference, and export commands until after migration/types review.
- CLI contract: includes flags-first usage, `--json` output, and write commands returning created records.
- Schema alignment: includes `memory_kind`, `roles.compensation`, nullable scores, denormalized fit assessments, and polymorphic links.
- No unresolved markers: implementation tasks include concrete files, code, commands, and expected outcomes.
