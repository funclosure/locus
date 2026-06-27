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
