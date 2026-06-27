import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/db/client.js";
import { migrateDatabase } from "../../src/db/migrate.js";
import { seedDefaultProfile } from "../../src/db/seed.js";
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
