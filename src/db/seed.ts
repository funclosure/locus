import { openDatabase } from "./client.js";

const defaultSummary =
  "iOS developer in Hong Kong researching remote roles at craft-driven, AI-first, Apple-platform, notes, writing, and knowledge-tool companies.";

const defaultPreferences = [
  ["requirement", "Remote required", "Remote work is a hard requirement.", 1, "manual"],
  [
    "interest",
    "iOS and Apple platforms",
    "Strong interest in iOS, interaction design, and Apple-platform-native products.",
    0.95,
    "manual",
  ],
  ["interest", "AI-first products", "Interested in teams building AI-first products with strong product taste.", 0.85, "manual"],
  ["positive_signal", "Craft-driven teams", "Prefers small, high-quality teams with strong design and product craft.", 0.9, "manual"],
] as const;

export function seedDefaultProfile(dbPath?: string): void {
  const db = openDatabase(dbPath);
  try {
    const now = new Date().toISOString();
    const insertProfile = db.prepare(`
      insert into profiles (id, name, summary, created_at, updated_at)
      values (1, 'Victor', ?, ?, ?)
      on conflict(id) do update set summary = excluded.summary, updated_at = excluded.updated_at
    `);
    insertProfile.run(defaultSummary, now, now);

    const insertPreference = db.prepare(`
      insert into profile_preferences (profile_id, kind, label, description, weight, source, created_at, updated_at)
      select 1, ?, ?, ?, ?, ?, ?, ?
      where not exists (
        select 1 from profile_preferences where profile_id = 1 and label = ?
      )
    `);

    for (const [kind, label, description, weight, source] of defaultPreferences) {
      insertPreference.run(kind, label, description, weight, source, now, now, label);
    }
  } finally {
    db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDefaultProfile(process.env.LOCUS_DB_PATH);
}
