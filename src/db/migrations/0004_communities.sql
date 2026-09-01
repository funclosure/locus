-- Open-source communities as a second track alongside companies. The three
-- openness columns are the reason this is its own entity: they are comparable
-- across communities and they decay, which prose in a note cannot express.
create table communities (
  id integer primary key autoincrement,
  name text not null,
  url text,
  ecosystem text,
  summary text,
  primary_label text,
  status text not null check (status in ('researching', 'watching', 'contributing', 'rejected', 'archived')),
  median_merge_days real check (median_merge_days is null or median_merge_days >= 0),
  outsider_merge_ratio real check (outsider_merge_ratio is null or (outsider_merge_ratio >= 0 and outsider_merge_ratio <= 1)),
  last_activity_at text,
  fit_score real check (fit_score is null or (fit_score >= 0 and fit_score <= 1)),
  fit_assessment text,
  last_checked_at text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

-- SQLite cannot alter a CHECK constraint in place, so `notes` and `evidence`
-- are rebuilt to admit the 'community' target type. Nothing references either
-- table, so the drop-and-rename is safe with foreign keys enabled.
create table notes_new (
  id integer primary key autoincrement,
  session_id integer references sessions(id) on delete set null,
  target_type text check (target_type is null or target_type in ('profile', 'session', 'company', 'role', 'community', 'preference', 'preference_candidate')),
  target_id integer,
  title text,
  body text not null,
  kind text not null check (kind in ('observation', 'decision', 'question', 'summary')),
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

insert into notes_new (id, session_id, target_type, target_id, title, body, kind, created_at, updated_at)
  select id, session_id, target_type, target_id, title, body, kind, created_at, updated_at from notes;

drop table notes;
alter table notes_new rename to notes;
create index idx_notes_target on notes(target_type, target_id);

create table evidence_new (
  id integer primary key autoincrement,
  target_type text not null check (target_type in ('profile', 'session', 'company', 'role', 'community', 'preference', 'preference_candidate')),
  target_id integer not null,
  url text not null,
  title text,
  snippet text not null,
  source_type text not null check (source_type in ('company_site', 'job_post', 'article', 'social', 'docs', 'manual', 'other')),
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  checked_at text not null,
  created_at text not null default (datetime('now'))
);

insert into evidence_new (id, target_type, target_id, url, title, snippet, source_type, confidence, checked_at, created_at)
  select id, target_type, target_id, url, title, snippet, source_type, confidence, checked_at, created_at from evidence;

drop table evidence;
alter table evidence_new rename to evidence;
create index idx_evidence_target on evidence(target_type, target_id);
