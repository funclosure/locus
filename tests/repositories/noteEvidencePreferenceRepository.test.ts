import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/db/client.js";
import { migrateDatabase } from "../../src/db/migrate.js";
import { seedDefaultProfile } from "../../src/db/seed.js";
import { addCompany } from "../../src/repositories/companyRepository.js";
import { addEvidence, deleteEvidence, listEvidence } from "../../src/repositories/evidenceRepository.js";
import { addNote, deleteNote, listNotes, updateNote } from "../../src/repositories/noteRepository.js";
import {
  approvePreferenceCandidate,
  proposePreferenceCandidate,
  rejectPreferenceCandidate,
} from "../../src/repositories/preferenceCandidateRepository.js";
import { listProfilePreferences } from "../../src/repositories/profileRepository.js";
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

  it("updates and deletes notes and evidence", () => {
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
    const note = addNote(db, { sessionId: null, targetType: "company", targetId: company.id, title: null, body: "Old text.", kind: "observation" });
    const evidence = addEvidence(db, {
      targetType: "company",
      targetId: company.id,
      url: "https://craft.do",
      title: null,
      snippet: "Notes app.",
      sourceType: "company_site",
      confidence: null,
    });

    const updated = updateNote(db, note.id, { body: "New text.", kind: "decision" });
    const removedNote = deleteNote(db, note.id);
    const removedEvidence = deleteEvidence(db, evidence.id);
    const notesLeft = listNotes(db, { targetType: "company", targetId: company.id });
    const evidenceLeft = listEvidence(db, { targetType: "company", targetId: company.id });
    db.close();

    expect(updated.body).toBe("New text.");
    expect(updated.kind).toBe("decision");
    expect(removedNote).toBe(true);
    expect(removedEvidence).toBe(true);
    expect(notesLeft).toHaveLength(0);
    expect(evidenceLeft).toHaveLength(0);
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

  it("materializes an approved candidate into the durable profile", () => {
    const db = setupDb();
    const session = createSession(db, {
      profileId: 1,
      title: null,
      goal: "Research education technology",
    });
    const before = listProfilePreferences(db, 1).length;
    const candidate = proposePreferenceCandidate(db, {
      sessionId: session.id,
      profileId: 1,
      kind: "interest",
      label: "Education technology and learning tools",
      description: "User asked to expand the search into edu-tech.",
      confidence: 0.9,
    });
    approvePreferenceCandidate(db, candidate.id);
    const after = listProfilePreferences(db, 1);
    const added = after.find((preference) => preference.label === "Education technology and learning tools");

    // Approving twice must not duplicate the durable preference.
    approvePreferenceCandidate(db, candidate.id);
    const afterSecondApproval = listProfilePreferences(db, 1);
    db.close();

    expect(after).toHaveLength(before + 1);
    expect(added?.kind).toBe("interest");
    expect(added?.source).toBe("approved_candidate");
    expect(added?.weight).toBe(0.9);
    expect(afterSecondApproval).toHaveLength(before + 1);
  });

  it("does not add a durable preference when a candidate is rejected", () => {
    const db = setupDb();
    const session = createSession(db, { profileId: 1, title: null, goal: "Research" });
    const before = listProfilePreferences(db, 1).length;
    const candidate = proposePreferenceCandidate(db, {
      sessionId: session.id,
      profileId: 1,
      kind: "negative_signal",
      label: "Never applied",
      description: "Should not reach the profile.",
      confidence: 0.5,
    });
    rejectPreferenceCandidate(db, candidate.id);
    const after = listProfilePreferences(db, 1);
    db.close();

    expect(after).toHaveLength(before);
  });
});
