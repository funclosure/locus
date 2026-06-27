import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/db/client.js";
import { migrateDatabase } from "../../src/db/migrate.js";
import { addCompany } from "../../src/repositories/companyRepository.js";
import { getApplication, listApplications, upsertApplication } from "../../src/repositories/applicationRepository.js";

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { force: true, recursive: true });
    tempDir = null;
  }
});

describe("applicationRepository", () => {
  it("upserts and lists application progress for a target", () => {
    tempDir = mkdtempSync(join(tmpdir(), "locus-applications-"));
    const dbPath = join(tempDir, "test.sqlite");
    migrateDatabase(dbPath);

    const db = openDatabase(dbPath);
    const company = addCompany(db, {
      name: "GoodNotes",
      url: null,
      hq: null,
      summary: null,
      primaryLabel: null,
      status: "researching",
      fitScore: null,
      fitAssessment: null,
    });

    const created = upsertApplication(db, {
      targetType: "company",
      targetId: company.id,
      stage: "warm_intro",
      nextAction: "Ask HK team for product thinking chat.",
      nextActionAt: "2026-07-01",
      lastContactedAt: null,
      notes: "Use Hong Kong proximity as the edge.",
    });
    const updated = upsertApplication(db, {
      targetType: "company",
      targetId: company.id,
      stage: "reached_out",
      nextAction: "Follow up with concise iOS craft POV.",
      nextActionAt: "2026-07-08",
      lastContactedAt: "2026-07-02",
      notes: "Reached out warm, not applying cold.",
    });
    const listed = listApplications(db);
    const fetched = getApplication(db, "company", company.id);
    db.close();

    expect(created.id).toBe(updated.id);
    expect(updated.stage).toBe("reached_out");
    expect(updated.nextAction).toContain("Follow up");
    expect(updated.lastContactedAt).toBe("2026-07-02");
    expect(listed).toHaveLength(1);
    expect(fetched?.notes).toContain("warm");
  });
});
