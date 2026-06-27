import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const migrations = [
  {
    version: "0001_initial",
    path: migrationPath("0001_initial.sql"),
  },
  {
    version: "0002_applications",
    path: migrationPath("0002_applications.sql"),
  },
];

function migrationPath(filename: string): string {
  const builtPath = join(__dirname, "migrations", filename);
  if (existsSync(builtPath)) {
    return builtPath;
  }
  return resolve(process.cwd(), "src", "db", "migrations", filename);
}

export function migrateDatabase(dbPath?: string): void {
  const db = openDatabase(dbPath);
  try {
    db.exec("pragma foreign_keys = on");
    db.exec(
      "create table if not exists schema_migrations (version text primary key, applied_at text not null default (datetime('now')))",
    );

    const hasMigration = db.prepare("select 1 from schema_migrations where version = ?");
    const apply = db.transaction((version: string, sql: string) => {
      db.exec(sql);
      db.prepare("insert or ignore into schema_migrations (version) values (?)").run(version);
    });

    for (const migration of migrations) {
      const applied = hasMigration.get(migration.version);
      if (!applied) {
        apply(migration.version, readFileSync(migration.path, "utf8"));
      }
    }
  } finally {
    db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrateDatabase(process.env.LOCUS_DB_PATH);
}
