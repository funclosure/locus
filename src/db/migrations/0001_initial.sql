pragma foreign_keys = on;

create table if not exists schema_migrations (
  version text primary key,
  applied_at text not null default (datetime('now'))
);

create table profiles (
  id integer primary key autoincrement,
  name text not null,
  summary text not null,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table profile_preferences (
  id integer primary key autoincrement,
  profile_id integer not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('requirement', 'positive_signal', 'negative_signal', 'interest', 'constraint')),
  label text not null,
  description text not null,
  weight real check (weight is null or (weight >= 0 and weight <= 1)),
  source text not null check (source in ('manual', 'approved_candidate', 'import')),
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table sessions (
  id integer primary key autoincrement,
  profile_id integer not null references profiles(id) on delete cascade,
  title text not null,
  goal text not null,
  status text not null check (status in ('active', 'paused', 'completed', 'archived')),
  started_at text not null,
  ended_at text,
  summary text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table session_memory (
  id integer primary key autoincrement,
  session_id integer not null references sessions(id) on delete cascade,
  kind text not null check (kind in ('observation', 'inference', 'decision', 'question', 'summary')),
  content text not null,
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table preference_candidates (
  id integer primary key autoincrement,
  session_id integer not null references sessions(id) on delete cascade,
  profile_id integer not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('requirement', 'positive_signal', 'negative_signal', 'interest', 'constraint')),
  label text not null,
  description text not null,
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status text not null check (status in ('pending', 'approved', 'rejected', 'superseded')),
  created_at text not null default (datetime('now')),
  reviewed_at text
);

create table companies (
  id integer primary key autoincrement,
  name text not null,
  url text,
  hq text,
  summary text,
  primary_label text,
  status text not null check (status in ('researching', 'shortlisted', 'watching', 'rejected', 'archived')),
  fit_score real check (fit_score is null or (fit_score >= 0 and fit_score <= 1)),
  fit_assessment text,
  last_checked_at text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table roles (
  id integer primary key autoincrement,
  company_id integer not null references companies(id) on delete cascade,
  title text not null,
  url text,
  location text,
  remote_policy text not null check (remote_policy in ('remote', 'hybrid', 'onsite', 'unknown')),
  seniority text,
  compensation text,
  summary text,
  status text not null check (status in ('researching', 'interested', 'applied', 'rejected', 'closed', 'archived')),
  fit_score real check (fit_score is null or (fit_score >= 0 and fit_score <= 1)),
  fit_assessment text,
  last_checked_at text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table notes (
  id integer primary key autoincrement,
  session_id integer references sessions(id) on delete set null,
  target_type text check (target_type is null or target_type in ('profile', 'session', 'company', 'role', 'preference', 'preference_candidate')),
  target_id integer,
  title text,
  body text not null,
  kind text not null check (kind in ('observation', 'decision', 'question', 'summary')),
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table evidence (
  id integer primary key autoincrement,
  target_type text not null check (target_type in ('profile', 'session', 'company', 'role', 'preference', 'preference_candidate')),
  target_id integer not null,
  url text not null,
  title text,
  snippet text not null,
  source_type text not null check (source_type in ('company_site', 'job_post', 'article', 'social', 'docs', 'manual', 'other')),
  confidence real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  checked_at text not null,
  created_at text not null default (datetime('now'))
);

create table tags (
  id integer primary key autoincrement,
  name text not null unique,
  color text
);

create table taggings (
  id integer primary key autoincrement,
  tag_id integer not null references tags(id) on delete cascade,
  target_type text not null check (target_type in ('profile', 'session', 'company', 'role', 'preference', 'preference_candidate')),
  target_id integer not null,
  unique (tag_id, target_type, target_id)
);

create table exports (
  id integer primary key autoincrement,
  session_id integer references sessions(id) on delete set null,
  format text not null check (format in ('markdown', 'json')),
  title text not null,
  path text not null,
  created_at text not null default (datetime('now'))
);

create index idx_sessions_profile_id on sessions(profile_id);
create index idx_roles_company_id on roles(company_id);
create index idx_notes_target on notes(target_type, target_id);
create index idx_evidence_target on evidence(target_type, target_id);
create index idx_taggings_target on taggings(target_type, target_id);
