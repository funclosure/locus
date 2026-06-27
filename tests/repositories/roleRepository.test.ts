import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/db/client.js";
import { migrateDatabase } from "../../src/db/migrate.js";
import { addCompany } from "../../src/repositories/companyRepository.js";
import { addRole, listRoles, updateRole } from "../../src/repositories/roleRepository.js";

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { force: true, recursive: true });
    tempDir = null;
  }
});

function setupDb() {
  tempDir = mkdtempSync(join(tmpdir(), "locus-role-"));
  const dbPath = join(tempDir, "test.sqlite");
  migrateDatabase(dbPath);
  return openDatabase(dbPath);
}

describe("roleRepository", () => {
  it("adds, lists, and updates roles", () => {
    const db = setupDb();
    const company = addCompany(db, {
      name: "Craft",
      status: "researching",
      fitScore: null,
      fitAssessment: null,
      hq: null,
      primaryLabel: null,
      summary: null,
      url: null,
    });

    const role = addRole(db, {
      companyId: company.id,
      title: "Senior iOS Engineer",
      url: "https://example.com/role",
      location: "Remote",
      remotePolicy: "remote",
      seniority: "senior",
      compensation: null,
      summary: "Build native iOS features.",
      status: "researching",
      fitScore: 0.85,
      fitAssessment: "Direct iOS fit.",
    });
    const updated = updateRole(db, role.id, { status: "interested" });
    const roles = listRoles(db, { companyId: company.id });
    db.close();

    expect(role.id).toBe(1);
    expect(updated.status).toBe("interested");
    expect(roles).toHaveLength(1);
    expect(roles[0]?.title).toBe("Senior iOS Engineer");
  });
});
