import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase } from "./client.js";

export type ProfileConfig = {
  name: string;
  summary: string;
  preferences: Array<{ kind: string; label: string; description: string; weight: number | null; source: string }>;
};

// Generic fallback used only when neither profile.json nor profile.example.json
// is found (e.g. the CLI is run outside the repo root).
const fallbackProfile: ProfileConfig = {
  name: "Your Name",
  summary: "Describe yourself in a sentence or two, then edit profile.json to make Locus yours.",
  preferences: [],
};

// Resolve the seed profile: a local, gitignored profile.json wins; otherwise the
// committed profile.example.json template; otherwise the generic fallback.
export function loadProfileConfig(): ProfileConfig {
  for (const file of ["profile.json", "profile.example.json"]) {
    const path = resolve(process.cwd(), file);
    if (existsSync(path)) {
      try {
        return JSON.parse(readFileSync(path, "utf8")) as ProfileConfig;
      } catch {
        // ignore a malformed file and try the next source
      }
    }
  }
  return fallbackProfile;
}

export function seedDefaultProfile(dbPath?: string, config: ProfileConfig = loadProfileConfig()): void {
  const db = openDatabase(dbPath);
  try {
    const now = new Date().toISOString();
    db.prepare(
      `insert into profiles (id, name, summary, created_at, updated_at)
       values (1, ?, ?, ?, ?)
       on conflict(id) do update set name = excluded.name, summary = excluded.summary, updated_at = excluded.updated_at`,
    ).run(config.name, config.summary, now, now);

    const insertPreference = db.prepare(`
      insert into profile_preferences (profile_id, kind, label, description, weight, source, created_at, updated_at)
      select 1, ?, ?, ?, ?, ?, ?, ?
      where not exists (
        select 1 from profile_preferences where profile_id = 1 and label = ?
      )
    `);

    for (const preference of config.preferences) {
      insertPreference.run(preference.kind, preference.label, preference.description, preference.weight, preference.source, now, now, preference.label);
    }
  } finally {
    db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDefaultProfile(process.env.LOCUS_DB_PATH);
}
