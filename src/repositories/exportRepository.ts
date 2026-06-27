import type Database from "better-sqlite3";

export type ExportRecord = {
  id: number;
  sessionId: number | null;
  format: "markdown" | "json";
  title: string;
  path: string;
  createdAt: string;
};

type ExportRow = {
  id: number;
  session_id: number | null;
  format: "markdown" | "json";
  title: string;
  path: string;
  created_at: string;
};

export function recordExport(
  db: Database.Database,
  input: { sessionId?: number | null; format: "markdown" | "json"; title: string; path: string },
): ExportRecord {
  const result = db
    .prepare("insert into exports (session_id, format, title, path) values (?, ?, ?, ?)")
    .run(input.sessionId ?? null, input.format, input.title, input.path);
  const row = db.prepare("select * from exports where id = ?").get(Number(result.lastInsertRowid)) as ExportRow;
  return {
    id: row.id,
    sessionId: row.session_id,
    format: row.format,
    title: row.title,
    path: row.path,
    createdAt: row.created_at,
  };
}
