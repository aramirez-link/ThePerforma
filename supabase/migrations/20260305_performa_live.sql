-- Performa Live control plane migration
-- Mirrors the live schema block in supabase/fan_vault_schema.sql

do $$
begin
  if not exists (select 1 from pg_type where typname = 'live_session_status') then
    create type public.live_session_status as enum ('DRAFT', 'READY', 'LIVE', 'ENDED');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'live_provider') then
    create type public.live_provider as enum ('cloudflare_stream', 'livepeer_studio');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'live_destination_provider') then
    create type public.live_destination_provider as enum ('twitch', 'facebook', 'instagram_manual', 'custom_rtmp');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'live_destination_status') then
    create type public.live_destination_status as enum ('DISABLED', 'CONNECTING', 'LIVE', 'ERROR');
  end if;
end
$$;

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 180),
  status public.live_session_status not null default 'DRAFT',
  provider public.live_provider not null default 'cloudflare_stream',
  provider_input_id text,
  provider_playback_id text,
  ingest_type text not null default 'rtmp' check (ingest_type in ('rtmp')),
  ingest_url text,
  ingest_stream_key_secret_ref uuid,
  ingest_status text not null default 'IDLE' check (ingest_status in ('IDLE', 'CONNECTING', 'LIVE', 'ERROR')),
  last_webhook_at timestamptz,
  ingest_last_heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

create table if not exists public.live_destinations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  provider public.live_destination_provider not null,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  enabled boolean not null default true,
  status public.live_destination_status not null default 'DISABLED',
  rtmp_url text not null,
  stream_key_secret_ref uuid not null,
  provider_output_id text,
  last_error text,
  last_success_at timestamptz,
  destination_heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, provider, display_name)
);

create table if not exists public.secret_store (
  id uuid primary key default gen_random_uuid(),
  encrypted_value text not null,
  key_version text not null default 'v1',
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'live_sessions_ingest_stream_key_secret_ref_fkey'
  ) then
    alter table public.live_sessions
      add constraint live_sessions_ingest_stream_key_secret_ref_fkey
      foreign key (ingest_stream_key_secret_ref)
      references public.secret_store(id)
      on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'live_destinations_stream_key_secret_ref_fkey'
  ) then
    alter table public.live_destinations
      add constraint live_destinations_stream_key_secret_ref_fkey
      foreign key (stream_key_secret_ref)
      references public.secret_store(id)
      on delete restrict;
  end if;
end
$$;

create table if not exists public.audit_log (
  id bigserial primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  object_type text not null,
  object_id text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_live_sessions_creator_created on public.live_sessions(creator_id, created_at desc);
create index if not exists idx_live_sessions_status_created on public.live_sessions(status, created_at desc);
create index if not exists idx_live_destinations_session on public.live_destinations(session_id);
create index if not exists idx_live_destinations_status on public.live_destinations(status);
create index if not exists idx_audit_log_object on public.audit_log(object_type, object_id, created_at desc);
create index if not exists idx_audit_log_actor on public.audit_log(actor_id, created_at desc);

alter table public.live_sessions enable row level security;
alter table public.live_destinations enable row level security;
alter table public.secret_store enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "live_sessions_select_own" on public.live_sessions;
drop policy if exists "live_sessions_insert_own" on public.live_sessions;
drop policy if exists "live_sessions_update_own" on public.live_sessions;
drop policy if exists "live_sessions_delete_own" on public.live_sessions;

create policy "live_sessions_select_own"
on public.live_sessions for select
using (auth.uid() = creator_id);

create policy "live_sessions_insert_own"
on public.live_sessions for insert
with check (auth.uid() = creator_id);

create policy "live_sessions_update_own"
on public.live_sessions for update
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

create policy "live_sessions_delete_own"
on public.live_sessions for delete
using (auth.uid() = creator_id);

drop policy if exists "live_destinations_select_own" on public.live_destinations;
drop policy if exists "live_destinations_insert_own" on public.live_destinations;
drop policy if exists "live_destinations_update_own" on public.live_destinations;
drop policy if exists "live_destinations_delete_own" on public.live_destinations;

create policy "live_destinations_select_own"
on public.live_destinations for select
using (
  exists (
    select 1
    from public.live_sessions s
    where s.id = session_id
      and s.creator_id = auth.uid()
  )
);

create policy "live_destinations_insert_own"
on public.live_destinations for insert
with check (
  exists (
    select 1
    from public.live_sessions s
    where s.id = session_id
      and s.creator_id = auth.uid()
  )
);

create policy "live_destinations_update_own"
on public.live_destinations for update
using (
  exists (
    select 1
    from public.live_sessions s
    where s.id = session_id
      and s.creator_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.live_sessions s
    where s.id = session_id
      and s.creator_id = auth.uid()
  )
);

create policy "live_destinations_delete_own"
on public.live_destinations for delete
using (
  exists (
    select 1
    from public.live_sessions s
    where s.id = session_id
      and s.creator_id = auth.uid()
  )
);

drop policy if exists "secret_store_deny_client_select" on public.secret_store;
drop policy if exists "secret_store_deny_client_insert" on public.secret_store;
drop policy if exists "secret_store_deny_client_update" on public.secret_store;
drop policy if exists "secret_store_deny_client_delete" on public.secret_store;

create policy "secret_store_deny_client_select"
on public.secret_store for select
using (false);

create policy "secret_store_deny_client_insert"
on public.secret_store for insert
with check (false);

create policy "secret_store_deny_client_update"
on public.secret_store for update
using (false)
with check (false);

create policy "secret_store_deny_client_delete"
on public.secret_store for delete
using (false);

drop policy if exists "audit_log_select_own" on public.audit_log;
create policy "audit_log_select_own"
on public.audit_log for select
using (auth.uid() = actor_id);

