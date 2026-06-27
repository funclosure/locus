import type Database from "better-sqlite3";
import type { Application } from "../domain/types.js";
import type { ApplicationInput } from "../domain/validators.js";

type ApplicationRow = {
  id: number;
  target_type: Application["targetType"];
  target_id: number;
  stage: Application["stage"];
  next_action: string | null;
  next_action_at: string | null;
  last_contacted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function upsertApplication(db: Database.Database, input: ApplicationInput): Application {
  const now = new Date().toISOString();
  db.prepare(
    `insert into applications
      (target_type, target_id, stage, next_action, next_action_at, last_contacted_at, notes, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(target_type, target_id) do update set
      stage = excluded.stage,
      next_action = excluded.next_action,
      next_action_at = excluded.next_action_at,
      last_contacted_at = excluded.last_contacted_at,
      notes = excluded.notes,
      updated_at = excluded.updated_at`,
  ).run(
    input.targetType,
    input.targetId,
    input.stage,
    input.nextAction,
    input.nextActionAt,
    input.lastContactedAt,
    input.notes,
    now,
    now,
  );

  const application = getApplication(db, input.targetType, input.targetId);
  if (!application) {
    throw new Error("Failed to upsert application progress.");
  }
  return application;
}

export function getApplication(
  db: Database.Database,
  targetType: Application["targetType"],
  targetId: number,
): Application | null {
  const row = db
    .prepare("select * from applications where target_type = ? and target_id = ?")
    .get(targetType, targetId) as ApplicationRow | undefined;
  return row ? mapApplication(row) : null;
}

export function listApplications(db: Database.Database): Application[] {
  const rows = db.prepare("select * from applications order by updated_at desc, id desc").all() as ApplicationRow[];
  return rows.map(mapApplication);
}

function mapApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    stage: row.stage,
    nextAction: row.next_action,
    nextActionAt: row.next_action_at,
    lastContactedAt: row.last_contacted_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
