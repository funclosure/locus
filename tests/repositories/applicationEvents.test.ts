import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/db/client.js";
import { migrateDatabase } from "../../src/db/migrate.js";
import { applicationInputSchema, companyInputSchema } from "../../src/domain/validators.js";
import { listApplicationEvents, upsertApplication } from "../../src/repositories/applicationRepository.js";
import { addCompany, updateCompany } from "../../src/repositories/companyRepository.js";

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { force: true, recursive: true });
    tempDir = null;
  }
});

function setup() {
  tempDir = mkdtempSync(join(tmpdir(), "locus-application-events-"));
  const dbPath = join(tempDir, "test.sqlite");
  migrateDatabase(dbPath);
  return openDatabase(dbPath);
}

describe("application history", () => {
  it("records an event on create and on each stage change, not on unchanged upserts", () => {
    const db = setup();
    const company = addCompany(db, companyInputSchema.parse({ name: "Mem", fitScore: 0.8 }));
    const set = (fields: Record<string, unknown>) =>
      upsertApplication(db, applicationInputSchema.parse({ targetType: "company", targetId: company.id, ...fields }));

    const created = set({ stage: "applied", occurredAt: "2026-09-01" });
    set({ stage: "applied", nextAction: "Wait a week" });
    set({ stage: "interviewing", occurredAt: "2026-09-10" });
    const events = listApplicationEvents(db, created.id);
    db.close();

    expect(events.map((event) => [event.stage, event.occurredAt, event.source])).toEqual([
      ["applied", "2026-09-01", "recorded"],
      ["interviewing", "2026-09-10", "recorded"],
    ]);
  });

  it("records feedback verbatim even when the stage is unchanged", () => {
    const db = setup();
    const company = addCompany(db, companyInputSchema.parse({ name: "Craft" }));
    const input = { targetType: "company", targetId: company.id, stage: "interviewing" };
    const created = upsertApplication(db, applicationInputSchema.parse(input));
    upsertApplication(db, applicationInputSchema.parse({ ...input, feedback: "Strong craft, wanted more SwiftUI depth." }));
    const events = listApplicationEvents(db, created.id);
    db.close();

    expect(events).toHaveLength(2);
    expect(events[1].stage).toBe("interviewing");
    expect(events[1].feedback).toBe("Strong craft, wanted more SwiftUI depth.");
  });

  it("snapshots the fit score at write time so later rescoring does not rewrite history", () => {
    const db = setup();
    const company = addCompany(db, companyInputSchema.parse({ name: "Bear", fitScore: 0.9 }));
    const created = upsertApplication(db, applicationInputSchema.parse({ targetType: "company", targetId: company.id, stage: "applied" }));
    updateCompany(db, company.id, { fitScore: 0.4 });
    upsertApplication(db, applicationInputSchema.parse({ targetType: "company", targetId: company.id, stage: "rejected" }));
    const events = listApplicationEvents(db, created.id);
    db.close();

    expect(events.map((event) => event.fitScore)).toEqual([0.9, 0.4]);
  });
});
