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
