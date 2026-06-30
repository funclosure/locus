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
  it("seeds the profile and preferences from a config", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-profile-"));
    const dbPath = join(tempDir, "test.sqlite");
    migrateDatabase(dbPath);
    seedDefaultProfile(dbPath, {
      name: "Ada Lovelace",
      summary: "Analytical engineer exploring remote roles.",
      preferences: [
        { kind: "requirement", label: "Remote required", description: "Remote is a hard requirement.", weight: 1, source: "manual" },
        { kind: "interest", label: "Developer tools", description: "Loves building for other engineers.", weight: 0.8, source: "manual" },
      ],
    });

    const db = openDatabase(dbPath);
    const profile = getDefaultProfile(db);
    const preferences = listProfilePreferences(db);
    db.close();

    expect(profile.name).toBe("Ada Lovelace");
    expect(profile.summary).toContain("Analytical engineer");
    expect(preferences.map((preference) => preference.label)).toContain("Remote required");
    expect(preferences.map((preference) => preference.label)).toContain("Developer tools");
  });

  it("re-seeding does not duplicate preferences", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-profile-dup-"));
    const dbPath = join(tempDir, "test.sqlite");
    migrateDatabase(dbPath);
    const config = {
      name: "Grace",
      summary: "Compiler pioneer.",
      preferences: [{ kind: "interest", label: "Reliability", description: "Cares about correctness.", weight: 0.9, source: "manual" }],
    };
    seedDefaultProfile(dbPath, config);
    seedDefaultProfile(dbPath, config);

    const db = openDatabase(dbPath);
    const preferences = listProfilePreferences(db);
    db.close();

    expect(preferences.filter((preference) => preference.label === "Reliability")).toHaveLength(1);
  });
});
