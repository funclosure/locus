import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/db/client.js";
import { migrateDatabase } from "../../src/db/migrate.js";
import { addCompany, listCompanies, updateCompany } from "../../src/repositories/companyRepository.js";

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { force: true, recursive: true });
    tempDir = null;
  }
});

function setupDb() {
  tempDir = mkdtempSync(join(tmpdir(), "locus-company-"));
  const dbPath = join(tempDir, "test.sqlite");
  migrateDatabase(dbPath);
  return openDatabase(dbPath);
}

describe("companyRepository", () => {
  it("adds, lists, and updates companies", () => {
    const db = setupDb();

    const company = addCompany(db, {
      name: "Linear",
      url: "https://linear.app",
      hq: null,
      summary: "Craft-driven issue tracking.",
      primaryLabel: "craft-driven",
      status: "researching",
      fitScore: 0.8,
      fitAssessment: "Strong product taste.",
    });
    const updated = updateCompany(db, company.id, { status: "shortlisted", fitScore: 0.9 });
    const companies = listCompanies(db);
    db.close();

    expect(company.id).toBe(1);
    expect(updated.status).toBe("shortlisted");
    expect(updated.fitScore).toBe(0.9);
    expect(companies).toHaveLength(1);
    expect(companies[0]?.name).toBe("Linear");
  });

  it("stores a distinct maker and defaults it to null", () => {
    const db = setupDb();

    const product = addCompany(db, {
      name: "Bear",
      maker: "Shiny Frog",
      url: "https://bear.app",
      hq: null,
      summary: "Apple-native markdown notes.",
      primaryLabel: "Apple-native notes",
      status: "watching",
      fitScore: null,
      fitAssessment: null,
    });
    const plain = addCompany(db, {
      name: "Linear",
      url: null,
      hq: null,
      summary: null,
      primaryLabel: null,
      status: "researching",
      fitScore: null,
      fitAssessment: null,
    });
    const renamedMaker = updateCompany(db, product.id, { maker: "Shiny Frog Srl" });
    db.close();

    expect(product.maker).toBe("Shiny Frog");
    expect(plain.maker).toBeNull();
    expect(renamedMaker.maker).toBe("Shiny Frog Srl");
  });
});
