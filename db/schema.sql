-- Single migration. Applied automatically on first use (CREATE ... IF NOT EXISTS) and safe to re-run.
create table if not exists runs (
  id text primary key,
  created_at timestamptz not null default now(),
  parent_run_id text null,
  root_id text not null,
  version int not null,
  label text not null,
  input jsonb not null,
  config jsonb not null,
  result jsonb not null
);
create index if not exists runs_parent_idx on runs (parent_run_id);
create index if not exists runs_created_idx on runs (created_at);
create index if not exists runs_root_idx on runs (root_id, version);

create table if not exists messages (
  id serial primary key,
  run_id text not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_run_idx on messages (run_id, created_at);
