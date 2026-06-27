import { openDatabase } from "./client.js";

const defaultSummary =
  "iOS developer in Hong Kong actively exploring remote senior-level roles at craft-driven, meaningful, AI-native, Apple-platform, notes, writing, and knowledge-tool companies. Strongest fit is work where iOS craft, interaction design, Swift concurrency, and product taste shape how the experience feels in hand.";

const defaultPreferences = [
  ["requirement", "Remote required", "Remote work is a hard requirement.", 1, "manual"],
  ["requirement", "Meaningful interaction work", "The product must matter to real people, and the interaction model itself should be central to the product rather than a wrapper.", 1, "manual"],
  [
    "interest",
    "iOS and Apple platforms",
    "Strong interest in iOS, interaction design, and Apple-platform-native products.",
    0.95,
    "manual",
  ],
  ["interest", "AI-first products", "Interested in teams building AI-first products with strong product taste.", 0.85, "manual"],
  ["positive_signal", "Craft-driven teams", "Prefers small, high-quality teams with strong design and product craft.", 0.9, "manual"],
  ["positive_signal", "Small high-leverage teams", "Ideal company size is under 50 people; mid-size is fine if the craft culture is still intact.", 0.85, "manual"],
  ["positive_signal", "Hong Kong friendly remote", "HK-based or HK-friendly async teams are a real edge; daily odd-hour US sync calls are a dealbreaker.", 0.9, "manual"],
  ["positive_signal", "Design-minded engineering culture", "Prefers engineers who care about design and leave room for craft judgment, not pure Figma-to-code execution.", 0.9, "manual"],
  ["positive_signal", "Warm researched outreach", "Outreach should be thoughtful and research-led, asking for thinking rather than jobs, never generic or desperate.", 0.75, "manual"],
  ["negative_signal", "No mobile-afterthought teams", "Avoid Android-first, cross-platform-first, backend/infra-only, or B2B SaaS teams that treat mobile as a checkbox.", 1, "manual"],
  ["negative_signal", "No hustle culture", "Avoid move-fast-and-break-things cultures, remote-as-a-perk cultures, and roles with no room for product taste.", 0.95, "manual"],
  ["constraint", "Open to TypeScript for the right mission", "TypeScript, React, or full-stack work is acceptable only when the mission and interaction challenge are strong enough.", 0.55, "manual"],
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
