import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/db/client.js";
import { migrateDatabase } from "../../src/db/migrate.js";
import { seedDefaultProfile } from "../../src/db/seed.js";
import { getDefaultProfile, listProfilePreferences } from "../../src/repositories/profileRepository.js";

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
    const preferences = listProfilePreferences(db);
    db.close();

    expect(profile.name).toBe("Victor");
    expect(profile.summary).toContain("iOS developer in Hong Kong");
    expect(profile.summary).toContain("remote");
    expect(preferences.map((preference) => preference.label)).toContain("Meaningful interaction work");
    expect(preferences.map((preference) => preference.label)).toContain("No mobile-afterthought teams");
    expect(preferences.map((preference) => preference.label)).toContain("Hong Kong friendly remote");
  });
});
