import type Database from "better-sqlite3";
import type { Company } from "../domain/types.js";
import type { CompanyInput } from "../domain/validators.js";

type CompanyRow = {
  id: number;
  name: string;
  maker: string | null;
  url: string | null;
  hq: string | null;
  summary: string | null;
  primary_label: string | null;
  status: Company["status"];
  fit_score: number | null;
  fit_assessment: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

type CompanyUpdate = Partial<CompanyInput> & {
  lastCheckedAt?: string | null;
};

export function addCompany(db: Database.Database, input: CompanyInput): Company {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `insert into companies
        (name, maker, url, hq, summary, primary_label, status, fit_score, fit_assessment, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.maker ?? null,
      input.url,
      input.hq,
      input.summary,
      input.primaryLabel,
      input.status,
      input.fitScore,
      input.fitAssessment,
      now,
      now,
    );
  const company = getCompany(db, Number(result.lastInsertRowid));
  if (!company) {
    throw new Error("Failed to create company.");
  }
  return company;
}

export function getCompany(db: Database.Database, id: number): Company | null {
  const row = db.prepare("select * from companies where id = ?").get(id) as CompanyRow | undefined;
  return row ? mapCompany(row) : null;
}

export function listCompanies(db: Database.Database, filters: { status?: Company["status"] } = {}): Company[] {
  const rows = filters.status
    ? (db.prepare("select * from companies where status = ? order by id").all(filters.status) as CompanyRow[])
    : (db.prepare("select * from companies order by id").all() as CompanyRow[]);
  return rows.map(mapCompany);
}

export function updateCompany(db: Database.Database, id: number, input: CompanyUpdate): Company {
  const current = getCompany(db, id);
  if (!current) {
    throw new Error(`Company ${id} not found.`);
  }
  const next = {
    name: input.name ?? current.name,
    maker: input.maker ?? current.maker,
    url: input.url ?? current.url,
    hq: input.hq ?? current.hq,
    summary: input.summary ?? current.summary,
    primaryLabel: input.primaryLabel ?? current.primaryLabel,
    status: input.status ?? current.status,
    fitScore: input.fitScore ?? current.fitScore,
    fitAssessment: input.fitAssessment ?? current.fitAssessment,
    lastCheckedAt: input.lastCheckedAt ?? current.lastCheckedAt,
    updatedAt: new Date().toISOString(),
  };
  db.prepare(
    `update companies
     set name = ?, maker = ?, url = ?, hq = ?, summary = ?, primary_label = ?, status = ?,
         fit_score = ?, fit_assessment = ?, last_checked_at = ?, updated_at = ?
     where id = ?`,
  ).run(
    next.name,
    next.maker,
    next.url,
    next.hq,
    next.summary,
    next.primaryLabel,
    next.status,
    next.fitScore,
    next.fitAssessment,
    next.lastCheckedAt,
    next.updatedAt,
    id,
  );
  const updated = getCompany(db, id);
  if (!updated) {
    throw new Error(`Company ${id} not found after update.`);
  }
  return updated;
}

function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    maker: row.maker,
    url: row.url,
    hq: row.hq,
    summary: row.summary,
    primaryLabel: row.primary_label,
    status: row.status,
    fitScore: row.fit_score,
    fitAssessment: row.fit_assessment,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
