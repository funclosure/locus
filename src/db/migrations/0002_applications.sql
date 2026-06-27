create table applications (
  id integer primary key autoincrement,
  target_type text not null check (target_type in ('company', 'role')),
  target_id integer not null,
  stage text not null check (stage in ('researching', 'warm_intro', 'reached_out', 'applied', 'interviewing', 'offer', 'rejected', 'paused')),
  next_action text,
  next_action_at text,
  last_contacted_at text,
  notes text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  unique (target_type, target_id)
);

create index idx_applications_target on applications(target_type, target_id);
