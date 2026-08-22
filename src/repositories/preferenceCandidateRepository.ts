import type Database from "better-sqlite3";
import type { PreferenceCandidate } from "../domain/types.js";
import type { PreferenceCandidateInput } from "../domain/validators.js";

type PreferenceCandidateRow = {
  id: number;
  session_id: number;
  profile_id: number;
  kind: PreferenceCandidate["kind"];
  label: string;
  description: string;
  confidence: number | null;
  status: PreferenceCandidate["status"];
  created_at: string;
  reviewed_at: string | null;
};

export function proposePreferenceCandidate(db: Database.Database, input: PreferenceCandidateInput): PreferenceCandidate {
  const result = db
    .prepare(
      `insert into preference_candidates
        (session_id, profile_id, kind, label, description, confidence, status)
       values (?, ?, ?, ?, ?, ?, 'pending')`,
    )
    .run(input.sessionId, input.profileId, input.kind, input.label, input.description, input.confidence);
  const candidate = getPreferenceCandidate(db, Number(result.lastInsertRowid));
  if (!candidate) throw new Error("Failed to create preference candidate.");
  return candidate;
}

export function approvePreferenceCandidate(db: Database.Database, id: number): PreferenceCandidate {
  const existing = getPreferenceCandidate(db, id);
  if (!existing) throw new Error(`Preference candidate ${id} not found.`);
  // Approving is what makes a candidate durable; without this insert the profile never changes.
  if (existing.status !== "approved") {
    db.prepare(
      `insert into profile_preferences (profile_id, kind, label, description, weight, source)
       values (?, ?, ?, ?, ?, 'approved_candidate')`,
    ).run(existing.profileId, existing.kind, existing.label, existing.description, existing.confidence);
  }
  return setPreferenceCandidateStatus(db, id, "approved");
}

export function rejectPreferenceCandidate(db: Database.Database, id: number): PreferenceCandidate {
  return setPreferenceCandidateStatus(db, id, "rejected");
}

export function listPreferenceCandidates(
  db: Database.Database,
  filters: { status?: PreferenceCandidate["status"] } = {},
): PreferenceCandidate[] {
  const rows = filters.status
    ? (db.prepare("select * from preference_candidates where status = ? order by id").all(filters.status) as PreferenceCandidateRow[])
    : (db.prepare("select * from preference_candidates order by id").all() as PreferenceCandidateRow[]);
  return rows.map(mapPreferenceCandidate);
}

function setPreferenceCandidateStatus(
  db: Database.Database,
  id: number,
  status: PreferenceCandidate["status"],
): PreferenceCandidate {
  db.prepare("update preference_candidates set status = ?, reviewed_at = ? where id = ?").run(status, new Date().toISOString(), id);
  const candidate = getPreferenceCandidate(db, id);
  if (!candidate) throw new Error(`Preference candidate ${id} not found.`);
  return candidate;
}

function getPreferenceCandidate(db: Database.Database, id: number): PreferenceCandidate | null {
  const row = db.prepare("select * from preference_candidates where id = ?").get(id) as PreferenceCandidateRow | undefined;
  return row ? mapPreferenceCandidate(row) : null;
}

function mapPreferenceCandidate(row: PreferenceCandidateRow): PreferenceCandidate {
  return {
    id: row.id,
    sessionId: row.session_id,
    profileId: row.profile_id,
    kind: row.kind,
    label: row.label,
    description: row.description,
    confidence: row.confidence,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}
