import type Database from "better-sqlite3";
import type { Session } from "../domain/types.js";
import type { SessionStartInput } from "../domain/validators.js";

type SessionRow = {
  id: number;
  profile_id: number;
  title: string;
  goal: string;
  status: Session["status"];
  started_at: string;
  ended_at: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

export function createSession(db: Database.Database, input: SessionStartInput): Session {
  const now = new Date().toISOString();
  const title = input.title ?? input.goal;
  const result = db
    .prepare(
      `insert into sessions
        (profile_id, title, goal, status, started_at, created_at, updated_at)
       values (?, ?, ?, 'active', ?, ?, ?)`,
    )
    .run(input.profileId, title, input.goal, now, now, now);

  const session = getSession(db, Number(result.lastInsertRowid));
  if (!session) {
    throw new Error("Failed to create session.");
  }
  return session;
}

export function getSession(db: Database.Database, id: number): Session | null {
  const row = db.prepare("select * from sessions where id = ?").get(id) as SessionRow | undefined;
  return row ? mapSession(row) : null;
}

export function getActiveSession(db: Database.Database): Session | null {
  const row = db
    .prepare("select * from sessions where status = 'active' order by started_at desc, id desc limit 1")
    .get() as SessionRow | undefined;
  return row ? mapSession(row) : null;
}

function mapSession(row: SessionRow): Session {
  return {
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
  };
}
