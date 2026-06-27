import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/db/client.js";
import { migrateDatabase } from "../../src/db/migrate.js";
import { seedDefaultProfile } from "../../src/db/seed.js";
import { addCompany } from "../../src/repositories/companyRepository.js";
import { addEvidence, listEvidence } from "../../src/repositories/evidenceRepository.js";
import { addNote, listNotes } from "../../src/repositories/noteRepository.js";
import {
  approvePreferenceCandidate,
  proposePreferenceCandidate,
  rejectPreferenceCandidate,
} from "../../src/repositories/preferenceCandidateRepository.js";
import { createSession } from "../../src/repositories/sessionRepository.js";

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { force: true, recursive: true });
    tempDir = null;
  }
});

function setupDb() {
  tempDir = mkdtempSync(join(tmpdir(), "locus-research-objects-"));
  const dbPath = join(tempDir, "test.sqlite");
  migrateDatabase(dbPath);
  seedDefaultProfile(dbPath);
  return openDatabase(dbPath);
}

describe("note, evidence, and preference repositories", () => {
  it("adds and lists linked notes", () => {
    const db = setupDb();
    const company = addCompany(db, {
      name: "Notability",
      status: "researching",
      fitScore: null,
      fitAssessment: null,
      hq: null,
      primaryLabel: "AI-first",
      summary: null,
      url: null,
    });

    const note = addNote(db, {
      sessionId: null,
      targetType: "company",
      targetId: company.id,
      title: "Initial read",
      body: "Direct GoodNotes competitor.",
      kind: "observation",
    });
    const notes = listNotes(db, { targetType: "company", targetId: company.id });
    db.close();

    expect(note.id).toBe(1);
    expect(notes[0]?.body).toContain("GoodNotes");
  });

  it("adds and lists evidence", () => {
    const db = setupDb();
    const company = addCompany(db, {
      name: "Bear",
      status: "researching",
      fitScore: null,
      fitAssessment: null,
      hq: null,
      primaryLabel: null,
      summary: null,
      url: null,
    });

    const evidence = addEvidence(db, {
      targetType: "company",
      targetId: company.id,
      url: "https://bear.app",
      title: "Bear",
      snippet: "Markdown notes app for Apple devices.",
      sourceType: "company_site",
      confidence: 0.9,
    });
    const evidenceItems = listEvidence(db, { targetType: "company", targetId: company.id });
    db.close();

    expect(evidence.checkedAt).toEqual(expect.any(String));
    expect(evidenceItems).toHaveLength(1);
  });

  it("proposes, approves, and rejects preference candidates", () => {
    const db = setupDb();
    const session = createSession(db, {
      profileId: 1,
      title: null,
      goal: "Research Apple-native knowledge tools",
    });
    const pending = proposePreferenceCandidate(db, {
      sessionId: session.id,
      profileId: 1,
      kind: "interest",
      label: "Apple-native knowledge tools",
      description: "User appears interested in Apple-native knowledge tools.",
      confidence: 0.8,
    });
    const approved = approvePreferenceCandidate(db, pending.id);
    const rejected = rejectPreferenceCandidate(db, pending.id);
    db.close();

    expect(pending.status).toBe("pending");
    expect(approved.status).toBe("approved");
    expect(rejected.status).toBe("rejected");
  });
});
