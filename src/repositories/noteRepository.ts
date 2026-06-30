import type Database from "better-sqlite3";
import type { Note } from "../domain/types.js";
import type { NoteInput } from "../domain/validators.js";

type NoteRow = {
  id: number;
  session_id: number | null;
  target_type: Note["targetType"];
  target_id: number | null;
  title: string | null;
  body: string;
  kind: Note["kind"];
  created_at: string;
  updated_at: string;
};

export function addNote(db: Database.Database, input: NoteInput): Note {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `insert into notes (session_id, target_type, target_id, title, body, kind, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(input.sessionId, input.targetType, input.targetId, input.title, input.body, input.kind, now, now);
  const note = getNote(db, Number(result.lastInsertRowid));
  if (!note) throw new Error("Failed to create note.");
  return note;
}

export function getNote(db: Database.Database, id: number): Note | null {
  const row = db.prepare("select * from notes where id = ?").get(id) as NoteRow | undefined;
  return row ? mapNote(row) : null;
}

export function listNotes(db: Database.Database, filters: { targetType?: Note["targetType"]; targetId?: number } = {}): Note[] {
  const values: unknown[] = [];
  const clauses: string[] = [];
  if (filters.targetType) {
    clauses.push("target_type = ?");
    values.push(filters.targetType);
  }
  if (filters.targetId) {
    clauses.push("target_id = ?");
    values.push(filters.targetId);
  }
  const where = clauses.length ? ` where ${clauses.join(" and ")}` : "";
  return (db.prepare(`select * from notes${where} order by id`).all(...values) as NoteRow[]).map(mapNote);
}

export function updateNote(db: Database.Database, id: number, input: Partial<Pick<NoteInput, "title" | "body" | "kind">>): Note {
  const current = getNote(db, id);
  if (!current) {
    throw new Error(`Note ${id} not found.`);
  }
  const next = {
    title: input.title ?? current.title,
    body: input.body ?? current.body,
    kind: input.kind ?? current.kind,
    updatedAt: new Date().toISOString(),
  };
  db.prepare("update notes set title = ?, body = ?, kind = ?, updated_at = ? where id = ?").run(next.title, next.body, next.kind, next.updatedAt, id);
  const updated = getNote(db, id);
  if (!updated) {
    throw new Error(`Note ${id} not found after update.`);
  }
  return updated;
}

export function deleteNote(db: Database.Database, id: number): boolean {
  return db.prepare("delete from notes where id = ?").run(id).changes > 0;
}

function mapNote(row: NoteRow): Note {
  return {
    id: row.id,
    sessionId: row.session_id,
    targetType: row.target_type,
    targetId: row.target_id,
    title: row.title,
    body: row.body,
    kind: row.kind,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
