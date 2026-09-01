import type Database from "better-sqlite3";
import type { Community } from "../domain/types.js";
import type { CommunityInput } from "../domain/validators.js";

type CommunityRow = {
  id: number;
  name: string;
  url: string | null;
  ecosystem: string | null;
  summary: string | null;
  primary_label: string | null;
  status: Community["status"];
  median_merge_days: number | null;
  outsider_merge_ratio: number | null;
  last_activity_at: string | null;
  fit_score: number | null;
  fit_assessment: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

type CommunityUpdate = Partial<CommunityInput> & {
  lastCheckedAt?: string | null;
};

export function addCommunity(db: Database.Database, input: CommunityInput): Community {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `insert into communities
        (name, url, ecosystem, summary, primary_label, status, median_merge_days,
         outsider_merge_ratio, last_activity_at, fit_score, fit_assessment, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.url,
      input.ecosystem,
      input.summary,
      input.primaryLabel,
      input.status,
      input.medianMergeDays,
      input.outsiderMergeRatio,
      input.lastActivityAt,
      input.fitScore,
      input.fitAssessment,
      now,
      now,
    );
  const community = getCommunity(db, Number(result.lastInsertRowid));
  if (!community) {
    throw new Error("Failed to create community.");
  }
  return community;
}

export function getCommunity(db: Database.Database, id: number): Community | null {
  const row = db.prepare("select * from communities where id = ?").get(id) as CommunityRow | undefined;
  return row ? mapCommunity(row) : null;
}

export function listCommunities(
  db: Database.Database,
  filters: { status?: Community["status"] } = {},
): Community[] {
  const rows = filters.status
    ? (db.prepare("select * from communities where status = ? order by id").all(filters.status) as CommunityRow[])
    : (db.prepare("select * from communities order by id").all() as CommunityRow[]);
  return rows.map(mapCommunity);
}

export function updateCommunity(db: Database.Database, id: number, input: CommunityUpdate): Community {
  const current = getCommunity(db, id);
  if (!current) {
    throw new Error(`Community ${id} not found.`);
  }
  const next = {
    name: input.name ?? current.name,
    url: input.url ?? current.url,
    ecosystem: input.ecosystem ?? current.ecosystem,
    summary: input.summary ?? current.summary,
    primaryLabel: input.primaryLabel ?? current.primaryLabel,
    status: input.status ?? current.status,
    medianMergeDays: input.medianMergeDays ?? current.medianMergeDays,
    outsiderMergeRatio: input.outsiderMergeRatio ?? current.outsiderMergeRatio,
    lastActivityAt: input.lastActivityAt ?? current.lastActivityAt,
    fitScore: input.fitScore ?? current.fitScore,
    fitAssessment: input.fitAssessment ?? current.fitAssessment,
    lastCheckedAt: input.lastCheckedAt ?? current.lastCheckedAt,
    updatedAt: new Date().toISOString(),
  };
  db.prepare(
    `update communities
     set name = ?, url = ?, ecosystem = ?, summary = ?, primary_label = ?, status = ?,
         median_merge_days = ?, outsider_merge_ratio = ?, last_activity_at = ?,
         fit_score = ?, fit_assessment = ?, last_checked_at = ?, updated_at = ?
     where id = ?`,
  ).run(
    next.name,
    next.url,
    next.ecosystem,
    next.summary,
    next.primaryLabel,
    next.status,
    next.medianMergeDays,
    next.outsiderMergeRatio,
    next.lastActivityAt,
    next.fitScore,
    next.fitAssessment,
    next.lastCheckedAt,
    next.updatedAt,
    id,
  );
  const updated = getCommunity(db, id);
  if (!updated) {
    throw new Error(`Community ${id} not found after update.`);
  }
  return updated;
}

function mapCommunity(row: CommunityRow): Community {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    ecosystem: row.ecosystem,
    summary: row.summary,
    primaryLabel: row.primary_label,
    status: row.status,
    medianMergeDays: row.median_merge_days,
    outsiderMergeRatio: row.outsider_merge_ratio,
    lastActivityAt: row.last_activity_at,
    fitScore: row.fit_score,
    fitAssessment: row.fit_assessment,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
