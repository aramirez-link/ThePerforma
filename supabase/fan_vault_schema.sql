-- Fan Vault schema for Supabase
-- Run in Supabase SQL editor.

create table if not exists public.fan_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default 'Fan',
  bio text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.fan_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('gallery', 'watch', 'listen')),
  item_id text not null,
  title text not null,
  href text not null,
  image text,
  saved_at timestamptz not null default now(),
  primary key (user_id, type, item_id)
);

create table if not exists public.fan_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id text not null,
  label text not null,
  tier text,
  tip text,
  updated_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table if not exists public.fan_live_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  email_alerts boolean not null default true,
  sms_alerts boolean not null default false,
  sms_phone text,
  preferred_platform text not null default 'multi' check (preferred_platform in ('youtube', 'instagram', 'facebook', 'twitch', 'multi')),
  updated_at timestamptz not null default now()
);

alter table public.fan_live_subscriptions
  add column if not exists sms_phone text;

create table if not exists public.fan_live_dispatches (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  created_by text not null default 'system',
  status text not null check (status in ('live', 'offline', 'test')),
  title text not null,
  stream_url text not null,
  platform text not null default 'multi',
  email_count integer not null default 0,
  sms_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.fan_live_engagement_events (
  id bigserial primary key,
  dispatch_id bigint references public.fan_live_dispatches(id) on delete cascade,
  event_type text not null check (event_type in ('open', 'click')),
  recipient text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.fan_profiles enable row level security;
alter table public.fan_favorites enable row level security;
alter table public.fan_badges enable row level security;
alter table public.fan_live_subscriptions enable row level security;
alter table public.fan_live_dispatches enable row level security;
alter table public.fan_live_engagement_events enable row level security;

drop policy if exists "fan_profiles_select_own" on public.fan_profiles;
drop policy if exists "fan_profiles_insert_own" on public.fan_profiles;
drop policy if exists "fan_profiles_update_own" on public.fan_profiles;

create policy "fan_profiles_select_own"
on public.fan_profiles for select
using (auth.uid() = id);

create policy "fan_profiles_insert_own"
on public.fan_profiles for insert
with check (auth.uid() = id);

create policy "fan_profiles_update_own"
on public.fan_profiles for update
using (auth.uid() = id);

drop policy if exists "fan_favorites_select_own" on public.fan_favorites;
drop policy if exists "fan_favorites_insert_own" on public.fan_favorites;
drop policy if exists "fan_favorites_update_own" on public.fan_favorites;
drop policy if exists "fan_favorites_delete_own" on public.fan_favorites;

create policy "fan_favorites_select_own"
on public.fan_favorites for select
using (auth.uid() = user_id);

create policy "fan_favorites_insert_own"
on public.fan_favorites for insert
with check (auth.uid() = user_id);

create policy "fan_favorites_update_own"
on public.fan_favorites for update
using (auth.uid() = user_id);

create policy "fan_favorites_delete_own"
on public.fan_favorites for delete
using (auth.uid() = user_id);

drop policy if exists "fan_badges_select_own" on public.fan_badges;
drop policy if exists "fan_badges_insert_own" on public.fan_badges;
drop policy if exists "fan_badges_update_own" on public.fan_badges;
drop policy if exists "fan_badges_delete_own" on public.fan_badges;

create policy "fan_badges_select_own"
on public.fan_badges for select
using (auth.uid() = user_id);

create policy "fan_badges_insert_own"
on public.fan_badges for insert
with check (auth.uid() = user_id);

create policy "fan_badges_update_own"
on public.fan_badges for update
using (auth.uid() = user_id);

create policy "fan_badges_delete_own"
on public.fan_badges for delete
using (auth.uid() = user_id);

drop policy if exists "fan_live_subscriptions_select_own" on public.fan_live_subscriptions;
drop policy if exists "fan_live_subscriptions_insert_own" on public.fan_live_subscriptions;
drop policy if exists "fan_live_subscriptions_update_own" on public.fan_live_subscriptions;
drop policy if exists "fan_live_subscriptions_delete_own" on public.fan_live_subscriptions;

create policy "fan_live_subscriptions_select_own"
on public.fan_live_subscriptions for select
using (auth.uid() = user_id);

create policy "fan_live_subscriptions_insert_own"
on public.fan_live_subscriptions for insert
with check (auth.uid() = user_id);

create policy "fan_live_subscriptions_update_own"
on public.fan_live_subscriptions for update
using (auth.uid() = user_id);

create policy "fan_live_subscriptions_delete_own"
on public.fan_live_subscriptions for delete
using (auth.uid() = user_id);

drop policy if exists "fan_live_dispatches_select_none" on public.fan_live_dispatches;
create policy "fan_live_dispatches_select_none"
on public.fan_live_dispatches for select
using (false);

drop policy if exists "fan_live_engagement_events_select_none" on public.fan_live_engagement_events;
create policy "fan_live_engagement_events_select_none"
on public.fan_live_engagement_events for select
using (false);
