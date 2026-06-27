import type Database from "better-sqlite3";
import { listCompanies } from "../repositories/companyRepository.js";
import { listEvidence } from "../repositories/evidenceRepository.js";
import { listNotes } from "../repositories/noteRepository.js";
import { listPreferenceCandidates } from "../repositories/preferenceCandidateRepository.js";
import { getDefaultProfile, listProfilePreferences } from "../repositories/profileRepository.js";
import { listRoles } from "../repositories/roleRepository.js";

type SessionRow = {
  id: number;
  profile_id: number;
  title: string;
  goal: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

export function buildJsonExport(db: Database.Database): Record<string, unknown> {
  return {
    profile: getDefaultProfile(db),
    preferences: listProfilePreferences(db, 1),
    sessions: listSessions(db),
    companies: listCompanies(db),
    roles: listRoles(db),
    notes: listNotes(db),
    evidence: listEvidence(db),
    preferenceCandidates: listPreferenceCandidates(db),
  };
}

function listSessions(db: Database.Database) {
  return (db.prepare("select * from sessions order by id").all() as SessionRow[]).map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    title: row.title,
    goal: row.goal,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
