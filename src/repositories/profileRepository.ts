import type Database from "better-sqlite3";
import type { Profile, ProfilePreference } from "../domain/types.js";

type ProfileRow = {
  id: number;
  name: string;
  summary: string;
  created_at: string;
  updated_at: string;
};

type PreferenceRow = {
  id: number;
  profile_id: number;
  kind: ProfilePreference["kind"];
  label: string;
  description: string;
  weight: number | null;
  source: ProfilePreference["source"];
  created_at: string;
  updated_at: string;
};

export function getDefaultProfile(db: Database.Database): Profile {
  const row = db.prepare("select * from profiles where id = 1").get() as ProfileRow | undefined;
  if (!row) {
    throw new Error("Default profile not found. Run `pnpm db:seed` first.");
  }
  return mapProfile(row);
}

export function listProfilePreferences(db: Database.Database, profileId = 1): ProfilePreference[] {
  const rows = db
    .prepare("select * from profile_preferences where profile_id = ? order by id")
    .all(profileId) as PreferenceRow[];
  return rows.map(mapPreference);
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPreference(row: PreferenceRow): ProfilePreference {
  return {
    id: row.id,
    profileId: row.profile_id,
    kind: row.kind,
    label: row.label,
    description: row.description,
    weight: row.weight,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
