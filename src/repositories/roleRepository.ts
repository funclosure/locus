import type Database from "better-sqlite3";
import type { Role } from "../domain/types.js";
import type { RoleInput } from "../domain/validators.js";

type RoleRow = {
  id: number;
  company_id: number;
  title: string;
  url: string | null;
  location: string | null;
  remote_policy: Role["remotePolicy"];
  seniority: string | null;
  compensation: string | null;
  summary: string | null;
  status: Role["status"];
  fit_score: number | null;
  fit_assessment: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

type RoleUpdate = Partial<RoleInput> & {
  lastCheckedAt?: string | null;
};

export function addRole(db: Database.Database, input: RoleInput): Role {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `insert into roles
        (company_id, title, url, location, remote_policy, seniority, compensation, summary,
         status, fit_score, fit_assessment, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.companyId,
      input.title,
      input.url,
      input.location,
      input.remotePolicy,
      input.seniority,
      input.compensation,
      input.summary,
      input.status,
      input.fitScore,
      input.fitAssessment,
      now,
      now,
    );
  const role = getRole(db, Number(result.lastInsertRowid));
  if (!role) {
    throw new Error("Failed to create role.");
  }
  return role;
}

export function getRole(db: Database.Database, id: number): Role | null {
  const row = db.prepare("select * from roles where id = ?").get(id) as RoleRow | undefined;
  return row ? mapRole(row) : null;
}

export function listRoles(db: Database.Database, filters: { companyId?: number; status?: Role["status"] } = {}): Role[] {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (filters.companyId) {
    clauses.push("company_id = ?");
    values.push(filters.companyId);
  }
  if (filters.status) {
    clauses.push("status = ?");
    values.push(filters.status);
  }
  const where = clauses.length ? ` where ${clauses.join(" and ")}` : "";
  const rows = db.prepare(`select * from roles${where} order by id`).all(...values) as RoleRow[];
  return rows.map(mapRole);
}

export function updateRole(db: Database.Database, id: number, input: RoleUpdate): Role {
  const current = getRole(db, id);
  if (!current) {
    throw new Error(`Role ${id} not found.`);
  }
  const next = {
    companyId: input.companyId ?? current.companyId,
    title: input.title ?? current.title,
    url: input.url ?? current.url,
    location: input.location ?? current.location,
    remotePolicy: input.remotePolicy ?? current.remotePolicy,
    seniority: input.seniority ?? current.seniority,
    compensation: input.compensation ?? current.compensation,
    summary: input.summary ?? current.summary,
    status: input.status ?? current.status,
    fitScore: input.fitScore ?? current.fitScore,
    fitAssessment: input.fitAssessment ?? current.fitAssessment,
    lastCheckedAt: input.lastCheckedAt ?? current.lastCheckedAt,
    updatedAt: new Date().toISOString(),
  };
  db.prepare(
    `update roles
     set company_id = ?, title = ?, url = ?, location = ?, remote_policy = ?, seniority = ?,
         compensation = ?, summary = ?, status = ?, fit_score = ?, fit_assessment = ?,
         last_checked_at = ?, updated_at = ?
     where id = ?`,
  ).run(
    next.companyId,
    next.title,
    next.url,
    next.location,
    next.remotePolicy,
    next.seniority,
    next.compensation,
    next.summary,
    next.status,
    next.fitScore,
    next.fitAssessment,
    next.lastCheckedAt,
    next.updatedAt,
    id,
  );
  const updated = getRole(db, id);
  if (!updated) {
    throw new Error(`Role ${id} not found after update.`);
  }
  return updated;
}

function mapRole(row: RoleRow): Role {
  return {
    id: row.id,
    companyId: row.company_id,
    title: row.title,
    url: row.url,
    location: row.location,
    remotePolicy: row.remote_policy,
    seniority: row.seniority,
    compensation: row.compensation,
    summary: row.summary,
    status: row.status,
    fitScore: row.fit_score,
    fitAssessment: row.fit_assessment,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
