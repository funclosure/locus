import type Database from "better-sqlite3";
import type { Application, ApplicationEvent } from "../domain/types.js";
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

type ApplicationEventRow = {
  id: number;
  application_id: number;
  stage: ApplicationEvent["stage"];
  feedback: string | null;
  fit_score: number | null;
  source: ApplicationEvent["source"];
  occurred_at: string;
  created_at: string;
};

// Upserts the application row and, when the stage changes or feedback is given,
// appends an event to its history with a snapshot of the target's current fit score.
export function upsertApplication(db: Database.Database, input: ApplicationInput): Application {
  return db.transaction(() => {
    const previous = getApplication(db, input.targetType, input.targetId);
    const application = writeApplication(db, input);
    const feedback = input.feedback ?? null;
    if (!previous || previous.stage !== application.stage || feedback) {
      db.prepare(
        `insert into application_events (application_id, stage, feedback, fit_score, source, occurred_at)
         values (?, ?, ?, ?, 'recorded', ?)`,
      ).run(
        application.id,
        application.stage,
        feedback,
        currentFitScore(db, input.targetType, input.targetId),
        input.occurredAt ?? application.updatedAt,
      );
    }
    return application;
  })();
}

function writeApplication(db: Database.Database, input: ApplicationInput): Application {
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

export function listApplicationEvents(db: Database.Database, applicationId?: number): ApplicationEvent[] {
  const rows = (
    applicationId === undefined
      ? db.prepare("select * from application_events order by application_id, occurred_at, id").all()
      : db.prepare("select * from application_events where application_id = ? order by occurred_at, id").all(applicationId)
  ) as ApplicationEventRow[];
  return rows.map(mapApplicationEvent);
}

function currentFitScore(db: Database.Database, targetType: Application["targetType"], targetId: number): number | null {
  const table = targetType === "company" ? "companies" : "roles";
  const row = db.prepare(`select fit_score from ${table} where id = ?`).get(targetId) as { fit_score: number | null } | undefined;
  return row?.fit_score ?? null;
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

function mapApplicationEvent(row: ApplicationEventRow): ApplicationEvent {
  return {
    id: row.id,
    applicationId: row.application_id,
    stage: row.stage,
    feedback: row.feedback,
    fitScore: row.fit_score,
    source: row.source,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}
