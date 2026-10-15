import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/db/client.js";
import { migrateDatabase } from "../../src/db/migrate.js";
import { applicationInputSchema, companyInputSchema } from "../../src/domain/validators.js";
import { upsertApplication } from "../../src/repositories/applicationRepository.js";
import { addCompany, updateCompany } from "../../src/repositories/companyRepository.js";
import { buildCalibrationReport } from "../../src/reports/calibration.js";

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { force: true, recursive: true });
    tempDir = null;
  }
});

function setup() {
  tempDir = mkdtempSync(join(tmpdir(), "locus-calibration-"));
  const dbPath = join(tempDir, "test.sqlite");
  migrateDatabase(dbPath);
  return openDatabase(dbPath);
}

// Applies at `fitScore`, then moves through `stages`.
function track(db: Database.Database, name: string, fitScore: number | null, stages: string[], feedback?: string) {
  const company = addCompany(db, companyInputSchema.parse({ name, fitScore }));
  const set = (stage: string, extra: Record<string, unknown> = {}) =>
    upsertApplication(db, applicationInputSchema.parse({ targetType: "company", targetId: company.id, stage, ...extra }));
  set("applied");
  stages.forEach((stage, index) => set(stage, index === stages.length - 1 && feedback ? { feedback } : {}));
  return company;
}

describe("buildCalibrationReport", () => {
  it("withholds rates and verdict when bands are too small", () => {
    const db = setup();
    track(db, "A", 0.9, ["interviewing"]);
    track(db, "B", 0.9, ["rejected"]);
    track(db, "C", 0.3, ["rejected"]);
    const report = buildCalibrationReport(db);
    db.close();

    expect(report.verdict).toBe("insufficient");
    expect(report.bands.find((band) => band.label === "high")).toMatchObject({ n: 2, interviews: 1, interviewRate: null });
  });

  it("calls the scoring separating when high scores reach interviews more often", () => {
    const db = setup();
    for (let i = 0; i < 5; i += 1) track(db, `High ${i}`, 0.85, i < 4 ? ["interviewing"] : ["rejected"]);
    for (let i = 0; i < 5; i += 1) track(db, `Low ${i}`, 0.3, i < 1 ? ["interviewing", "offer"] : ["rejected"]);
    const report = buildCalibrationReport(db);
    db.close();

    expect(report.verdict).toBe("separating");
    expect(report.bands.find((band) => band.label === "high")).toMatchObject({ n: 5, interviews: 4, interviewRate: 0.8 });
    expect(report.bands.find((band) => band.label === "low")).toMatchObject({ n: 5, interviews: 1, offers: 1, interviewRate: 0.2, offerRate: 0.2 });
  });

  it("calls the scoring inverted when low scores do better", () => {
    const db = setup();
    for (let i = 0; i < 5; i += 1) track(db, `High ${i}`, 0.9, ["rejected"]);
    for (let i = 0; i < 5; i += 1) track(db, `Mid ${i}`, 0.6, ["interviewing"]);
    const report = buildCalibrationReport(db);
    db.close();

    expect(report.verdict).toBe("inverted");
  });

  it("excludes in-flight and unscored applications and counts them", () => {
    const db = setup();
    track(db, "Waiting", 0.9, []);
    track(db, "Paused", 0.9, ["paused"]);
    track(db, "Unscored", null, ["rejected"]);
    const report = buildCalibrationReport(db);
    db.close();

    expect(report.inFlight).toBe(2);
    expect(report.unscored).toBe(1);
    expect(report.resolved).toEqual([]);
  });

  it("uses the score from before the outcome, not a later rescore", () => {
    const db = setup();
    const company = track(db, "Bear", 0.9, []);
    updateCompany(db, company.id, { fitScore: 0.2 });
    upsertApplication(db, applicationInputSchema.parse({ targetType: "company", targetId: company.id, stage: "rejected" }));
    const report = buildCalibrationReport(db);
    db.close();

    expect(report.resolved[0]).toMatchObject({ name: "Bear", fitScore: 0.9, scoreTiming: "before_outcome" });
  });

  it("flags scores that were only recorded at the outcome", () => {
    const db = setup();
    const company = addCompany(db, companyInputSchema.parse({ name: "Late", fitScore: 0.7 }));
    upsertApplication(db, applicationInputSchema.parse({ targetType: "company", targetId: company.id, stage: "rejected" }));
    const report = buildCalibrationReport(db);
    db.close();

    expect(report.resolved[0].scoreTiming).toBe("at_outcome");
    expect(report.scoredAtOutcome).toBe(1);
  });

  it("returns recorded feedback verbatim with its target", () => {
    const db = setup();
    track(db, "Craft", 0.8, ["rejected"], "We went with someone with more SwiftUI depth.");
    const report = buildCalibrationReport(db);
    db.close();

    expect(report.feedback).toEqual([
      expect.objectContaining({ name: "Craft", stage: "rejected", feedback: "We went with someone with more SwiftUI depth." }),
    ]);
  });
});
