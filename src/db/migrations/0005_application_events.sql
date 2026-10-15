-- Append-only history of application stage changes and recorded feedback.
-- `fit_score` snapshots the target's fit score when the event was written, so
-- calibration compares outcomes with the score that preceded them rather than
-- a score revised after the fact. `feedback` is stored verbatim.
create table application_events (
  id integer primary key autoincrement,
  application_id integer not null references applications(id) on delete cascade,
  stage text not null check (stage in ('researching', 'warm_intro', 'reached_out', 'applied', 'interviewing', 'offer', 'rejected', 'paused')),
  feedback text,
  fit_score real check (fit_score is null or (fit_score >= 0 and fit_score <= 1)),
  source text not null check (source in ('recorded', 'backfill')),
  occurred_at text not null,
  created_at text not null default (datetime('now'))
);

create index idx_application_events_application on application_events(application_id, occurred_at);

-- Seed one event per existing application from its current row. These scores
-- are taken now, not when the stage was reached, so they are marked `backfill`.
insert into application_events (application_id, stage, fit_score, source, occurred_at)
select
  a.id,
  a.stage,
  case a.target_type
    when 'company' then (select fit_score from companies where id = a.target_id)
    when 'role' then (select fit_score from roles where id = a.target_id)
  end,
  'backfill',
  a.updated_at
from applications a;
