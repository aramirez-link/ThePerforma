alter table public.live_sessions
  add column if not exists scheduled_for timestamptz;

create index if not exists idx_live_sessions_status_scheduled_for
on public.live_sessions(status, scheduled_for asc, created_at desc);
