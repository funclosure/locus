import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

export function defaultDatabasePath(): string {
  return resolve(process.cwd(), ".locus", "locus.sqlite");
}

export function openDatabase(dbPath = process.env.LOCUS_DB_PATH ?? defaultDatabasePath()): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  return db;
}
