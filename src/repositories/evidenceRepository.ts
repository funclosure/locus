import type Database from "better-sqlite3";
import type { Evidence } from "../domain/types.js";
import type { EvidenceInput } from "../domain/validators.js";

type EvidenceRow = {
  id: number;
  target_type: Evidence["targetType"];
  target_id: number;
  url: string;
  title: string | null;
  snippet: string;
  source_type: Evidence["sourceType"];
  confidence: number | null;
  checked_at: string;
  created_at: string;
};

export function addEvidence(db: Database.Database, input: EvidenceInput): Evidence {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `insert into evidence (target_type, target_id, url, title, snippet, source_type, confidence, checked_at, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(input.targetType, input.targetId, input.url, input.title, input.snippet, input.sourceType, input.confidence, now, now);
  const evidence = getEvidence(db, Number(result.lastInsertRowid));
  if (!evidence) throw new Error("Failed to create evidence.");
  return evidence;
}

export function getEvidence(db: Database.Database, id: number): Evidence | null {
  const row = db.prepare("select * from evidence where id = ?").get(id) as EvidenceRow | undefined;
  return row ? mapEvidence(row) : null;
}

export function deleteEvidence(db: Database.Database, id: number): boolean {
  return db.prepare("delete from evidence where id = ?").run(id).changes > 0;
}

export function listEvidence(
  db: Database.Database,
  filters: { targetType?: Evidence["targetType"]; targetId?: number } = {},
): Evidence[] {
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
  return (db.prepare(`select * from evidence${where} order by id`).all(...values) as EvidenceRow[]).map(mapEvidence);
}

function mapEvidence(row: EvidenceRow): Evidence {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    url: row.url,
    title: row.title,
    snippet: row.snippet,
    sourceType: row.source_type,
    confidence: row.confidence,
    checkedAt: row.checked_at,
    createdAt: row.created_at,
  };
}
