create table if not exists public.live_session_presence (
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Fan',
  user_email text not null default '',
  avatar_url text,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_path text,
  device_kind text not null default 'web' check (device_kind in ('web', 'mobile_web', 'tablet_web')),
  primary key (session_id, user_id)
);

create index if not exists idx_live_session_presence_session_seen
on public.live_session_presence(session_id, last_seen_at desc);

create index if not exists idx_live_session_presence_user_seen
on public.live_session_presence(user_id, last_seen_at desc);

alter table public.live_session_presence enable row level security;

drop policy if exists "live_session_presence_select_own_or_admin" on public.live_session_presence;
drop policy if exists "live_session_presence_insert_own" on public.live_session_presence;
drop policy if exists "live_session_presence_update_own" on public.live_session_presence;
drop policy if exists "live_session_presence_delete_own_or_admin" on public.live_session_presence;

create policy "live_session_presence_select_own_or_admin"
on public.live_session_presence for select
using (auth.uid() = user_id or public.is_store_admin());

create policy "live_session_presence_insert_own"
on public.live_session_presence for insert
with check (
  auth.role() = 'authenticated'
  and auth.uid() = user_id
);

create policy "live_session_presence_update_own"
on public.live_session_presence for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "live_session_presence_delete_own_or_admin"
on public.live_session_presence for delete
using (auth.uid() = user_id or public.is_store_admin());

grant select, insert, update, delete on public.live_session_presence to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'live_session_presence'
  ) then
    alter publication supabase_realtime add table public.live_session_presence;
  end if;
exception
  when insufficient_privilege then
    null;
end
$$;
