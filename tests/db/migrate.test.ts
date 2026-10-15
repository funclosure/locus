import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
      { session_id: 1, target_type: "company", target_id: 7, title: "t1", body: "b1", kind: "observation", created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-02T00:00:00.000Z" },
      { session_id: 1, target_type: "role", target_id: 2, title: null, body: "b2", kind: "decision", created_at: "2026-08-03T00:00:00.000Z", updated_at: "2026-08-04T00:00:00.000Z" },
      { session_id: null, target_type: null, target_id: null, title: "t3", body: "b3", kind: "summary", created_at: "2026-08-05T00:00:00.000Z", updated_at: "2026-08-06T00:00:00.000Z" },
      { session_id: 1, target_type: "preference_candidate", target_id: 4, title: "t4", body: "b4", kind: "question", created_at: "2026-08-07T00:00:00.000Z", updated_at: "2026-08-08T00:00:00.000Z" },
    ];
    const insertNote = db.prepare(
      `insert into notes (session_id, target_type, target_id, title, body, kind, created_at, updated_at)
       values (@session_id, @target_type, @target_id, @title, @body, @kind, @created_at, @updated_at)`,
    );
    for (const row of noteRows) insertNote.run(row);

    const evidenceRows = [
      { target_type: "company", target_id: 7, url: "https://a.example", title: "e1", snippet: "s1", source_type: "company_site", confidence: 0.9, checked_at: "2026-09-01", created_at: "2026-08-10T00:00:00.000Z" },
      { target_type: "role", target_id: 2, url: "https://b.example", title: null, snippet: "s2", source_type: "job_post", confidence: null, checked_at: "2026-09-01", created_at: "2026-08-11T00:00:00.000Z" },
    ];
    const insertEvidence = db.prepare(
      `insert into evidence (target_type, target_id, url, title, snippet, source_type, confidence, checked_at, created_at)
       values (@target_type, @target_id, @url, @title, @snippet, @source_type, @confidence, @checked_at, @created_at)`,
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

  it("backfills one application event per existing application in 0005", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-migrate-events-"));
    const dbPath = join(tempDir, "test.sqlite");
    const migrationsDir = join(process.cwd(), "src", "db", "migrations");

    const db = new Database(dbPath);
    db.exec("pragma foreign_keys = on");
    for (const file of ["0001_initial.sql", "0002_applications.sql", "0003_company_maker.sql", "0004_communities.sql"]) {
      db.exec(readFileSync(join(migrationsDir, file), "utf8"));
    }

    db.prepare("insert into companies (name, status, fit_score) values ('Mem', 'shortlisted', 0.8)").run();
    db.prepare("insert into roles (company_id, title, remote_policy, status, fit_score) values (1, 'iOS Engineer', 'remote', 'applied', 0.6)").run();
    db.prepare(
      "insert into applications (target_type, target_id, stage, updated_at) values ('company', 1, 'warm_intro', '2026-09-01T00:00:00.000Z')",
    ).run();
    db.prepare(
      "insert into applications (target_type, target_id, stage, updated_at) values ('role', 1, 'interviewing', '2026-09-02T00:00:00.000Z')",
    ).run();

    db.exec(readFileSync(join(migrationsDir, "0005_application_events.sql"), "utf8"));

    expect(db.prepare("select application_id, stage, feedback, fit_score, source, occurred_at from application_events order by id").all()).toEqual([
      { application_id: 1, stage: "warm_intro", feedback: null, fit_score: 0.8, source: "backfill", occurred_at: "2026-09-01T00:00:00.000Z" },
      { application_id: 2, stage: "interviewing", feedback: null, fit_score: 0.6, source: "backfill", occurred_at: "2026-09-02T00:00:00.000Z" },
    ]);
    expect(() =>
      db.prepare("insert into application_events (application_id, stage, source, occurred_at) values (1, 'bogus', 'recorded', 'x')").run(),
    ).toThrow();

    // Deleting an application removes its history.
    db.prepare("delete from applications where id = 1").run();
    expect(db.prepare("select count(*) as n from application_events").get()).toEqual({ n: 1 });

    db.close();
  });
});
