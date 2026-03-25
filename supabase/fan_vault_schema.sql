-- Fan Vault schema for Supabase
-- Run in Supabase SQL editor.

create table if not exists public.fan_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default 'Fan',
  bio text not null default '',
  avatar_url text,
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

create table if not exists public.fan_engagement_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Fan',
  points integer not null default 120 check (points >= 0),
  streak integer not null default 1 check (streak >= 0),
  last_seen_date date not null default current_date,
  daily_claim_date date,
  week_key text not null default '',
  weekly_signal integer not null default 0 check (weekly_signal >= 0),
  visited_paths text[] not null default '{}',
  reactions jsonb not null default '{"fire":0,"bolt":0,"hands":0}'::jsonb,
  missions jsonb not null default '{"stageMode":false,"watchAndListen":false,"innerCircle":false}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_fan_engagement_profiles_score
on public.fan_engagement_profiles ((points + weekly_signal + (streak * 17)));

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
      and tablename = 'fan_engagement_profiles'
  ) then
    alter publication supabase_realtime add table public.fan_engagement_profiles;
  end if;
exception
  when insufficient_privilege then
    null;
end
$$;

-- ===============================
-- Performa Live control plane
-- ===============================

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
  ingest_type text not null default 'rtmp' check (ingest_type in ('rtmp', 'webrtc', 'srt')),
  ingest_url text,
  webrtc_publish_url text,
  webrtc_playback_url text,
  srt_ingest_url text,
  srt_stream_id text,
  ingest_stream_key_secret_ref uuid,
  ingest_status text not null default 'IDLE' check (ingest_status in ('IDLE', 'CONNECTING', 'LIVE', 'ERROR')),
  last_webhook_at timestamptz,
  ingest_last_heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  scheduled_for timestamptz
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
create index if not exists idx_live_sessions_status_scheduled_for on public.live_sessions(status, scheduled_for asc, created_at desc);

create table if not exists public.booking_concierge_sessions (
  id bigserial primary key,
  session_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'draft' check (status in ('draft', 'estimate_ready', 'submitted', 'emailed', 'follow_up')),
  event_type text,
  venue_type text,
  event_name text,
  location_city text,
  location_state text,
  location_country text,
  target_date date,
  attendee_count integer,
  ticketing_model text,
  audience_description text,
  vibe_profile text,
  package_preference text,
  production_ambition text,
  live_elements text[] not null default '{}',
  production_needs text[] not null default '{}',
  budget_signal text,
  next_step_intent text,
  contact_name text,
  contact_email text,
  contact_phone text,
  organization text,
  role text,
  contact_preference text,
  follow_up_consent boolean not null default false,
  outreach_consent boolean not null default false,
  ai_summary text,
  estimate_breakdown jsonb not null default '{}'::jsonb,
  total_range_low integer,
  total_range_high integer,
  pricing_profile_key text,
  pricing_profile_snapshot jsonb not null default '{}'::jsonb,
  proposal_brief jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_booking_concierge_sessions_created
on public.booking_concierge_sessions(created_at desc);

create index if not exists idx_booking_concierge_sessions_status
on public.booking_concierge_sessions(status, created_at desc);

create index if not exists idx_booking_concierge_sessions_contact_email
on public.booking_concierge_sessions(lower(contact_email));

create table if not exists public.performance_pricing_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_key text not null unique,
  profile_name text not null,
  is_active boolean not null default true,
  currency text not null default 'usd',
  artist_name text not null default 'Chip Lee / The Performa',
  base_overview text not null default '',
  ai_guidance text not null default '',
  event_type_rates jsonb not null default '[]'::jsonb,
  package_tiers jsonb not null default '[]'::jsonb,
  attendance_bands jsonb not null default '[]'::jsonb,
  ambition_multipliers jsonb not null default '[]'::jsonb,
  travel_zones jsonb not null default '[]'::jsonb,
  live_element_rates jsonb not null default '[]'::jsonb,
  production_need_rates jsonb not null default '[]'::jsonb,
  security_bands jsonb not null default '[]'::jsonb,
  permit_allowances jsonb not null default '[]'::jsonb,
  staffing_formula jsonb not null default '{}'::jsonb,
  commercial_terms jsonb not null default '{}'::jsonb,
  proposal_sections jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_performance_pricing_profiles_active
on public.performance_pricing_profiles(is_active, updated_at desc);
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
using (auth.uid() = creator_id or public.is_store_admin());

create policy "live_sessions_insert_own"
on public.live_sessions for insert
with check (auth.uid() = creator_id);

create policy "live_sessions_update_own"
on public.live_sessions for update
using (auth.uid() = creator_id or public.is_store_admin())
with check (auth.uid() = creator_id or public.is_store_admin());

create policy "live_sessions_delete_own"
on public.live_sessions for delete
using (auth.uid() = creator_id or public.is_store_admin());

drop policy if exists "live_destinations_select_own" on public.live_destinations;
drop policy if exists "live_destinations_insert_own" on public.live_destinations;
drop policy if exists "live_destinations_update_own" on public.live_destinations;
drop policy if exists "live_destinations_delete_own" on public.live_destinations;

create policy "live_destinations_select_own"
on public.live_destinations for select
using (
  public.is_store_admin() or exists (
    select 1
    from public.live_sessions s
    where s.id = session_id
      and s.creator_id = auth.uid()
  )
);

create policy "live_destinations_insert_own"
on public.live_destinations for insert
with check (
  public.is_store_admin() or exists (
    select 1
    from public.live_sessions s
    where s.id = session_id
      and s.creator_id = auth.uid()
  )
);

create policy "live_destinations_update_own"
on public.live_destinations for update
using (
  public.is_store_admin() or exists (
    select 1
    from public.live_sessions s
    where s.id = session_id
      and s.creator_id = auth.uid()
  )
)
with check (
  public.is_store_admin() or exists (
    select 1
    from public.live_sessions s
    where s.id = session_id
      and s.creator_id = auth.uid()
  )
);

create policy "live_destinations_delete_own"
on public.live_destinations for delete
using (
  public.is_store_admin() or exists (
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

-- ===============================
-- Fan Feed media storage
-- ===============================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fan-feed-media',
  'fan-feed-media',
  true,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fan_feed_media_read" on storage.objects;
drop policy if exists "fan_feed_media_upload_authenticated" on storage.objects;
drop policy if exists "fan_feed_media_update_own" on storage.objects;
drop policy if exists "fan_feed_media_delete_own" on storage.objects;

create policy "fan_feed_media_read"
on storage.objects for select
using (bucket_id = 'fan-feed-media');

create policy "fan_feed_media_upload_authenticated"
on storage.objects for insert
with check (
  bucket_id = 'fan-feed-media'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "fan_feed_media_update_own"
on storage.objects for update
using (
  bucket_id = 'fan-feed-media'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'fan-feed-media'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "fan_feed_media_delete_own"
on storage.objects for delete
using (
  bucket_id = 'fan-feed-media'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ===============================
-- Fan avatar media storage
-- ===============================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fan-avatar-media',
  'fan-avatar-media',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fan_avatar_media_read" on storage.objects;
drop policy if exists "fan_avatar_media_upload_authenticated" on storage.objects;
drop policy if exists "fan_avatar_media_update_own" on storage.objects;
drop policy if exists "fan_avatar_media_delete_own" on storage.objects;

create policy "fan_avatar_media_read"
on storage.objects for select
using (bucket_id = 'fan-avatar-media');

create policy "fan_avatar_media_upload_authenticated"
on storage.objects for insert
with check (
  bucket_id = 'fan-avatar-media'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "fan_avatar_media_update_own"
on storage.objects for update
using (
  bucket_id = 'fan-avatar-media'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'fan-avatar-media'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "fan_avatar_media_delete_own"
on storage.objects for delete
using (
  bucket_id = 'fan-avatar-media'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ===============================
-- Store product media storage
-- ===============================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-product-media',
  'store-product-media',
  true,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "store_product_media_read" on storage.objects;
drop policy if exists "store_product_media_upload_admin" on storage.objects;
drop policy if exists "store_product_media_update_admin_own" on storage.objects;
drop policy if exists "store_product_media_delete_admin_own" on storage.objects;

create policy "store_product_media_read"
on storage.objects for select
using (bucket_id = 'store-product-media');

create policy "store_product_media_upload_admin"
on storage.objects for insert
with check (
  bucket_id = 'store-product-media'
  and auth.role() = 'authenticated'
  and public.is_store_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "store_product_media_update_admin_own"
on storage.objects for update
using (
  bucket_id = 'store-product-media'
  and owner = auth.uid()
  and public.is_store_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'store-product-media'
  and owner = auth.uid()
  and public.is_store_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "store_product_media_delete_admin_own"
on storage.objects for delete
using (
  bucket_id = 'store-product-media'
  and owner = auth.uid()
  and public.is_store_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

alter table public.fan_profiles enable row level security;
alter table public.fan_favorites enable row level security;
alter table public.fan_badges enable row level security;
alter table public.fan_live_subscriptions enable row level security;
alter table public.fan_live_dispatches enable row level security;
alter table public.fan_live_engagement_events enable row level security;
alter table public.fan_engagement_profiles enable row level security;

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

drop policy if exists "fan_engagement_profiles_select_authenticated" on public.fan_engagement_profiles;
drop policy if exists "fan_engagement_profiles_insert_own" on public.fan_engagement_profiles;
drop policy if exists "fan_engagement_profiles_update_own" on public.fan_engagement_profiles;
drop policy if exists "fan_engagement_profiles_delete_own" on public.fan_engagement_profiles;

create policy "fan_engagement_profiles_select_authenticated"
on public.fan_engagement_profiles for select
using (auth.role() = 'authenticated');

create policy "fan_engagement_profiles_insert_own"
on public.fan_engagement_profiles for insert
with check (auth.uid() = user_id);

create policy "fan_engagement_profiles_update_own"
on public.fan_engagement_profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "fan_engagement_profiles_delete_own"
on public.fan_engagement_profiles for delete
using (auth.uid() = user_id);

-- ===============================
-- Store schema (MVP)
-- ===============================

create table if not exists public.store_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'support')),
  created_at timestamptz not null default now()
);

create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  product_type text not null check (product_type in ('physical', 'digital_tool', 'digital_download', 'subscription', 'bundle')),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  currency text not null default 'usd',
  base_price_cents integer not null default 0 check (base_price_cents >= 0),
  cover_image text,
  gallery jsonb not null default '[]'::jsonb,
  related_product_ids uuid[] not null default '{}',
  stripe_tax_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products(id) on delete cascade,
  sku text not null unique,
  title text not null,
  price_cents integer not null check (price_cents >= 0),
  compare_at_cents integer check (compare_at_cents is null or compare_at_cents >= 0),
  inventory_mode text not null default 'unlimited' check (inventory_mode in ('finite', 'unlimited')),
  inventory_count integer check (inventory_count is null or inventory_count >= 0),
  weight_grams integer check (weight_grams is null or weight_grams >= 0),
  attributes jsonb not null default '{}'::jsonb,
  digital_delivery_url text,
  stripe_price_id text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_wishlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.store_reviews (
  id bigserial primary key,
  product_id uuid not null references public.store_products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  title text not null default '',
  body text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_orders (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  stripe_customer_email text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'refunded', 'fulfilled', 'partially_refunded')),
  currency text not null default 'usd',
  subtotal_cents integer not null default 0,
  tax_cents integer not null default 0,
  shipping_cents integer not null default 0,
  total_cents integer not null default 0,
  shipping_carrier text,
  tracking_number text,
  shipped_at timestamptz,
  fulfilled_at timestamptz,
  cancel_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_order_items (
  id bigserial primary key,
  order_id bigint not null references public.store_orders(id) on delete cascade,
  product_id uuid references public.store_products(id) on delete set null,
  variant_id uuid references public.store_product_variants(id) on delete set null,
  title text not null,
  variant_title text,
  sku text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  line_total_cents integer not null default 0 check (line_total_cents >= 0),
  delivery_url text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.store_order_events (
  id bigserial primary key,
  order_id bigint references public.store_orders(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_store_products_status on public.store_products(status);
create index if not exists idx_store_product_variants_product on public.store_product_variants(product_id);
create index if not exists idx_store_reviews_product on public.store_reviews(product_id);
create index if not exists idx_store_orders_created_at on public.store_orders(created_at desc);
create index if not exists idx_store_orders_user on public.store_orders(user_id);
create index if not exists idx_store_orders_checkout on public.store_orders(stripe_checkout_session_id);
create index if not exists idx_store_order_items_order on public.store_order_items(order_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_store_products_updated_at on public.store_products;
create trigger trg_store_products_updated_at
before update on public.store_products
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_store_product_variants_updated_at on public.store_product_variants;
create trigger trg_store_product_variants_updated_at
before update on public.store_product_variants
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_store_reviews_updated_at on public.store_reviews;
create trigger trg_store_reviews_updated_at
before update on public.store_reviews
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_store_orders_updated_at on public.store_orders;
create trigger trg_store_orders_updated_at
before update on public.store_orders
for each row
execute function public.touch_updated_at();

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_admins a
    where a.user_id = auth.uid()
  );
$$;

grant execute on function public.is_store_admin() to authenticated;

create or replace function public.get_fan_identity_profiles(profile_ids uuid[])
returns table (
  id uuid,
  name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    profiles.id,
    coalesce(
      nullif(btrim(profiles.name), ''),
      nullif(btrim(users.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
      nullif(initcap(replace(replace(replace(split_part(coalesce(users.email, profiles.email), '@', 1), '.', ' '), '_', ' '), '-', ' ')), ''),
      'Fan'
    ) as name,
    nullif(btrim(profiles.avatar_url), '') as avatar_url
  from public.fan_profiles profiles
  left join auth.users users on users.id = profiles.id
  where profiles.id = any (coalesce(profile_ids, '{}'::uuid[]));
$$;

grant execute on function public.get_fan_identity_profiles(uuid[]) to authenticated;

alter table public.store_admins enable row level security;
alter table public.store_products enable row level security;
alter table public.store_product_variants enable row level security;
alter table public.store_wishlists enable row level security;
alter table public.store_reviews enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.store_order_events enable row level security;
alter table public.booking_concierge_sessions enable row level security;
alter table public.performance_pricing_profiles enable row level security;

drop policy if exists "booking_concierge_sessions_insert_public" on public.booking_concierge_sessions;
drop policy if exists "booking_concierge_sessions_update_public" on public.booking_concierge_sessions;
drop policy if exists "booking_concierge_sessions_select_admin" on public.booking_concierge_sessions;

create policy "booking_concierge_sessions_insert_public"
on public.booking_concierge_sessions for insert
with check (true);

create policy "booking_concierge_sessions_update_public"
on public.booking_concierge_sessions for update
using (true)
with check (true);

create policy "booking_concierge_sessions_select_admin"
on public.booking_concierge_sessions for select
using (public.is_store_admin());

grant insert, update on public.booking_concierge_sessions to anon, authenticated;
grant select on public.booking_concierge_sessions to authenticated;
grant usage, select on sequence public.booking_concierge_sessions_id_seq to anon, authenticated;

drop policy if exists "performance_pricing_profiles_select_active_or_admin" on public.performance_pricing_profiles;
drop policy if exists "performance_pricing_profiles_manage_admin" on public.performance_pricing_profiles;

create policy "performance_pricing_profiles_select_active_or_admin"
on public.performance_pricing_profiles for select
using (is_active = true or public.is_store_admin());

create policy "performance_pricing_profiles_manage_admin"
on public.performance_pricing_profiles for all
using (public.is_store_admin())
with check (public.is_store_admin());

grant select on public.performance_pricing_profiles to anon, authenticated;
grant insert, update, delete on public.performance_pricing_profiles to authenticated;

drop policy if exists "store_admins_select_admin_only" on public.store_admins;
drop policy if exists "store_admins_manage_owner_only" on public.store_admins;

create policy "store_admins_select_admin_only"
on public.store_admins for select
using (auth.uid() = user_id or public.is_store_admin());

create policy "store_admins_manage_owner_only"
on public.store_admins for all
using (
  exists (
    select 1 from public.store_admins s
    where s.user_id = auth.uid()
      and s.role = 'owner'
  )
)
with check (
  exists (
    select 1 from public.store_admins s
    where s.user_id = auth.uid()
      and s.role = 'owner'
  )
);

drop policy if exists "store_products_select_public_active_or_admin" on public.store_products;
drop policy if exists "store_products_insert_admin" on public.store_products;
drop policy if exists "store_products_update_admin" on public.store_products;
drop policy if exists "store_products_delete_admin" on public.store_products;

create policy "store_products_select_public_active_or_admin"
on public.store_products for select
using (status = 'active' or public.is_store_admin());

create policy "store_products_insert_admin"
on public.store_products for insert
with check (public.is_store_admin());

create policy "store_products_update_admin"
on public.store_products for update
using (public.is_store_admin())
with check (public.is_store_admin());

create policy "store_products_delete_admin"
on public.store_products for delete
using (public.is_store_admin());

drop policy if exists "store_variants_select_public_active_or_admin" on public.store_product_variants;
drop policy if exists "store_variants_insert_admin" on public.store_product_variants;
drop policy if exists "store_variants_update_admin" on public.store_product_variants;
drop policy if exists "store_variants_delete_admin" on public.store_product_variants;

create policy "store_variants_select_public_active_or_admin"
on public.store_product_variants for select
using (
  public.is_store_admin() or (
    is_active = true and exists (
      select 1
      from public.store_products p
      where p.id = product_id
        and p.status = 'active'
    )
  )
);

create policy "store_variants_insert_admin"
on public.store_product_variants for insert
with check (public.is_store_admin());

create policy "store_variants_update_admin"
on public.store_product_variants for update
using (public.is_store_admin())
with check (public.is_store_admin());

create policy "store_variants_delete_admin"
on public.store_product_variants for delete
using (public.is_store_admin());

drop policy if exists "store_wishlists_select_own" on public.store_wishlists;
drop policy if exists "store_wishlists_insert_own" on public.store_wishlists;
drop policy if exists "store_wishlists_delete_own" on public.store_wishlists;

create policy "store_wishlists_select_own"
on public.store_wishlists for select
using (auth.uid() = user_id);

create policy "store_wishlists_insert_own"
on public.store_wishlists for insert
with check (auth.uid() = user_id);

create policy "store_wishlists_delete_own"
on public.store_wishlists for delete
using (auth.uid() = user_id);

drop policy if exists "store_reviews_select_public_or_owner_or_admin" on public.store_reviews;
drop policy if exists "store_reviews_insert_own" on public.store_reviews;
drop policy if exists "store_reviews_update_own_or_admin" on public.store_reviews;
drop policy if exists "store_reviews_delete_own_or_admin" on public.store_reviews;

create policy "store_reviews_select_public_or_owner_or_admin"
on public.store_reviews for select
using (
  status = 'approved' or auth.uid() = user_id or public.is_store_admin()
);

create policy "store_reviews_insert_own"
on public.store_reviews for insert
with check (auth.uid() = user_id);

create policy "store_reviews_update_own_or_admin"
on public.store_reviews for update
using (public.is_store_admin() or auth.uid() = user_id)
with check (public.is_store_admin() or auth.uid() = user_id);

create policy "store_reviews_delete_own_or_admin"
on public.store_reviews for delete
using (public.is_store_admin() or auth.uid() = user_id);

drop policy if exists "store_orders_select_own_or_admin" on public.store_orders;
drop policy if exists "store_orders_update_admin" on public.store_orders;

create policy "store_orders_select_own_or_admin"
on public.store_orders for select
using (auth.uid() = user_id or public.is_store_admin());

create policy "store_orders_update_admin"
on public.store_orders for update
using (public.is_store_admin())
with check (public.is_store_admin());

drop policy if exists "store_order_items_select_own_or_admin" on public.store_order_items;
drop policy if exists "store_order_items_update_admin" on public.store_order_items;

create policy "store_order_items_select_own_or_admin"
on public.store_order_items for select
using (
  public.is_store_admin() or exists (
    select 1
    from public.store_orders o
    where o.id = order_id
      and o.user_id = auth.uid()
  )
);

create policy "store_order_items_update_admin"
on public.store_order_items for update
using (public.is_store_admin())
with check (public.is_store_admin());

drop policy if exists "store_order_events_select_admin" on public.store_order_events;
drop policy if exists "store_order_events_insert_admin" on public.store_order_events;

create policy "store_order_events_select_admin"
on public.store_order_events for select
using (public.is_store_admin());

create policy "store_order_events_insert_admin"
on public.store_order_events for insert
with check (public.is_store_admin());

-- ===============================
-- Fan Feed schema
-- ===============================

create table if not exists public.fan_feed_settings (
  id smallint primary key default 1 check (id = 1),
  moderation_enabled boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.fan_feed_settings (id, moderation_enabled)
values (1, false)
on conflict (id) do nothing;

create table if not exists public.fan_feed_posts (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Fan',
  author_avatar_url text,
  body text not null default '',
  live_session_id uuid references public.live_sessions(id) on delete set null,
  post_kind text not null default 'standard' check (post_kind in ('standard', 'live_chat', 'host_prompt', 'announcement', 'poll')),
  is_pinned boolean not null default false,
  media_url text,
  media_type text check (media_type in ('image', 'video', 'link')),
  share_count integer not null default 0 check (share_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fan_feed_comments (
  id bigserial primary key,
  post_id bigint not null references public.fan_feed_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Fan',
  author_avatar_url text,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.fan_feed_likes (
  post_id bigint not null references public.fan_feed_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.fan_feed_shares (
  post_id bigint not null references public.fan_feed_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.live_session_reactions (
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('fire', 'bolt', 'hands', 'heart')),
  created_at timestamptz not null default now(),
  primary key (session_id, user_id, reaction_type)
);

create table if not exists public.fan_feed_polls (
  post_id bigint primary key references public.fan_feed_posts(id) on delete cascade,
  question text not null,
  allow_multiple boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.fan_feed_poll_options (
  id bigserial primary key,
  poll_post_id bigint not null references public.fan_feed_polls(post_id) on delete cascade,
  label text not null,
  image_url text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (poll_post_id, position)
);

create table if not exists public.fan_feed_poll_votes (
  poll_post_id bigint not null references public.fan_feed_polls(post_id) on delete cascade,
  option_id bigint not null references public.fan_feed_poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_post_id, option_id, user_id)
);

create table if not exists public.fan_feed_trivia_questions (
  id bigserial primary key,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  correct_option_index integer not null default 0 check (correct_option_index >= 0),
  category text not null default 'general',
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  image_url text,
  explanation text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fan_feed_trivia_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
  question_ids bigint[] not null default '{}',
  schedule_timezone text not null default 'UTC',
  start_at timestamptz not null,
  end_at timestamptz,
  cadence_minutes integer not null default 60 check (cadence_minutes between 1 and 1440),
  post_duration_minutes integer not null default 10 check (post_duration_minutes between 1 and 60),
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  look_and_feel jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fan_feed_trivia_posts (
  post_id bigint primary key references public.fan_feed_posts(id) on delete cascade,
  campaign_id uuid not null references public.fan_feed_trivia_campaigns(id) on delete cascade,
  question_id bigint not null references public.fan_feed_trivia_questions(id) on delete cascade,
  correct_option_id bigint references public.fan_feed_poll_options(id) on delete set null,
  look_and_feel jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.run_due_trivia_campaigns(max_posts integer default 8)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(max_posts, 8), 50));
  v_count integer := 0;
  v_campaign record;
  v_question record;
  v_post_id bigint;
  v_meta text;
  v_created_option_ids bigint[];
begin
  if auth.uid() is null or not public.is_store_admin() then
    return 0;
  end if;

  for v_campaign in
    select *
    from public.fan_feed_trivia_campaigns c
    where c.status = 'active'
      and c.next_run_at <= now()
      and (c.end_at is null or c.next_run_at <= c.end_at)
    order by c.next_run_at asc
    limit v_limit
  loop
    select q.*
    into v_question
    from public.fan_feed_trivia_questions q
    where q.is_active = true
      and q.id = any (v_campaign.question_ids)
    order by random()
    limit 1;

    if v_question.id is null then
      update public.fan_feed_trivia_campaigns
      set updated_at = now(), updated_by = auth.uid(), next_run_at = next_run_at + make_interval(mins => cadence_minutes)
      where id = v_campaign.id;
      continue;
    end if;

    v_meta := format(
      '[[TRIVIA]]%s',
      json_build_object(
        'campaignId', v_campaign.id,
        'campaignTitle', v_campaign.title,
        'questionId', v_question.id,
        'category', v_question.category,
        'difficulty', v_question.difficulty,
        'look', coalesce(v_campaign.look_and_feel, '{}'::jsonb)
      )::text
    );

    insert into public.fan_feed_posts (
      user_id,
      body,
      media_url,
      media_type,
      moderation_status,
      moderation_reason,
      is_nsfw,
      share_count
    )
    values (
      coalesce(v_campaign.created_by, auth.uid()),
      v_meta || E'\n' || coalesce(v_question.prompt, ''),
      v_question.image_url,
      case when v_question.image_url is null then null else 'image' end,
      'approved',
      null,
      false,
      0
    )
    returning id into v_post_id;

    insert into public.fan_feed_polls (post_id, question, allow_multiple, expires_at)
    values (
      v_post_id,
      v_question.prompt,
      false,
      now() + make_interval(mins => v_campaign.post_duration_minutes)
    );

    with inserted as (
      insert into public.fan_feed_poll_options (poll_post_id, label, image_url, position)
      select
        v_post_id,
        trim(value::text, '"'),
        null,
        ordinality - 1
      from jsonb_array_elements(v_question.options) with ordinality
      returning id, position
    )
    select array_agg(id order by position)
    into v_created_option_ids
    from inserted;

    insert into public.fan_feed_trivia_posts (post_id, campaign_id, question_id, correct_option_id, look_and_feel)
    values (
      v_post_id,
      v_campaign.id,
      v_question.id,
      case
        when v_created_option_ids is null or cardinality(v_created_option_ids) = 0 then null
        when v_question.correct_option_index + 1 > cardinality(v_created_option_ids) then null
        else v_created_option_ids[v_question.correct_option_index + 1]
      end,
      coalesce(v_campaign.look_and_feel, '{}'::jsonb)
    );

    update public.fan_feed_trivia_campaigns
    set
      last_run_at = now(),
      next_run_at = next_run_at + make_interval(mins => cadence_minutes),
      updated_at = now(),
      updated_by = auth.uid(),
      status = case
        when end_at is not null and (next_run_at + make_interval(mins => cadence_minutes)) > end_at then 'completed'
        else status
      end
    where id = v_campaign.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end
$$;

grant execute on function public.run_due_trivia_campaigns(integer) to authenticated;

alter table public.fan_profiles
  add column if not exists avatar_url text;

alter table public.fan_feed_posts
  add column if not exists author_name text;
alter table public.fan_feed_posts
  add column if not exists author_avatar_url text;
alter table public.fan_feed_posts
  alter column author_name set default 'Fan';
alter table public.fan_feed_posts
  add column if not exists moderation_status text not null default 'approved'
  check (moderation_status in ('pending', 'approved', 'rejected', 'flagged'));
alter table public.fan_feed_posts
  alter column moderation_status set default 'approved';
alter table public.fan_feed_posts
  add column if not exists live_session_id uuid references public.live_sessions(id) on delete set null;
alter table public.fan_feed_posts
  add column if not exists post_kind text not null default 'standard';
alter table public.fan_feed_posts
  alter column post_kind set default 'standard';
alter table public.fan_feed_posts
  add column if not exists is_pinned boolean not null default false;
alter table public.fan_feed_posts
  add column if not exists moderation_reason text;
alter table public.fan_feed_posts
  add column if not exists is_nsfw boolean not null default false;
alter table public.fan_feed_posts
  add column if not exists moderated_by uuid references auth.users(id) on delete set null;
alter table public.fan_feed_posts
  add column if not exists moderated_at timestamptz;

alter table public.fan_feed_comments
  add column if not exists author_name text;
alter table public.fan_feed_comments
  add column if not exists author_avatar_url text;
alter table public.fan_feed_comments
  alter column author_name set default 'Fan';
alter table public.fan_feed_comments
  add column if not exists moderation_status text not null default 'approved'
  check (moderation_status in ('pending', 'approved', 'rejected', 'flagged'));
alter table public.fan_feed_comments
  alter column moderation_status set default 'approved';
alter table public.fan_feed_comments
  add column if not exists moderation_reason text;
alter table public.fan_feed_comments
  add column if not exists moderated_by uuid references auth.users(id) on delete set null;
alter table public.fan_feed_comments
  add column if not exists moderated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fan_feed_posts_post_kind_check'
  ) then
    alter table public.fan_feed_posts
      add constraint fan_feed_posts_post_kind_check
      check (post_kind in ('standard', 'live_chat', 'host_prompt', 'announcement', 'poll'));
  end if;
end
$$;

create table if not exists public.fan_feed_reports (
  id bigserial primary key,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id bigint not null,
  reason_code text not null check (reason_code in ('hate', 'sexual', 'harassment', 'violence', 'spam', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fan_feed_posts_body_len_check'
  ) then
    alter table public.fan_feed_posts
      add constraint fan_feed_posts_body_len_check
      check (length(body) <= 4000);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fan_feed_posts_media_url_len_check'
  ) then
    alter table public.fan_feed_posts
      add constraint fan_feed_posts_media_url_len_check
      check (media_url is null or length(media_url) <= 2048);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fan_feed_posts_media_url_protocol_check'
  ) then
    alter table public.fan_feed_posts
      add constraint fan_feed_posts_media_url_protocol_check
      check (media_url is null or media_url ~* '^https?://');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fan_feed_comments_body_len_check'
  ) then
    alter table public.fan_feed_comments
      add constraint fan_feed_comments_body_len_check
      check (length(trim(body)) between 1 and 600);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fan_feed_polls_question_len_check'
  ) then
    alter table public.fan_feed_polls
      add constraint fan_feed_polls_question_len_check
      check (length(trim(question)) between 1 and 280);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fan_feed_poll_options_label_len_check'
  ) then
    alter table public.fan_feed_poll_options
      add constraint fan_feed_poll_options_label_len_check
      check (length(trim(label)) between 1 and 120);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fan_feed_poll_options_image_url_len_check'
  ) then
    alter table public.fan_feed_poll_options
      add constraint fan_feed_poll_options_image_url_len_check
      check (image_url is null or length(image_url) <= 2048);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fan_feed_poll_options_image_url_protocol_check'
  ) then
    alter table public.fan_feed_poll_options
      add constraint fan_feed_poll_options_image_url_protocol_check
      check (image_url is null or image_url ~* '^https?://');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fan_feed_trivia_questions_options_array_check'
  ) then
    alter table public.fan_feed_trivia_questions
      add constraint fan_feed_trivia_questions_options_array_check
      check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6);
  end if;
end
$$;

update public.fan_feed_posts
set moderation_status = 'approved'
where moderation_status = 'pending'
  and moderated_by is null;

update public.fan_profiles profiles
set
  name = coalesce(
    nullif(btrim(profiles.name), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(initcap(replace(replace(replace(split_part(coalesce(users.email, profiles.email), '@', 1), '.', ' '), '_', ' '), '-', ' ')), ''),
    'Fan'
  ),
  avatar_url = nullif(btrim(profiles.avatar_url), '')
from auth.users users
where users.id = profiles.id;

update public.fan_profiles profiles
set
  name = coalesce(
    nullif(btrim(profiles.name), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(initcap(replace(replace(replace(split_part(coalesce(users.email, profiles.email), '@', 1), '.', ' '), '_', ' '), '-', ' ')), ''),
    'Fan'
  )
from auth.users users
where users.id = profiles.id
  and (
    profiles.name is null
    or btrim(profiles.name) = ''
    or lower(btrim(profiles.name)) = 'fan'
  );

update public.fan_feed_posts posts
set
  author_name = coalesce(
    nullif(btrim(posts.author_name), ''),
    nullif(btrim(profiles.name), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(initcap(replace(replace(replace(split_part(coalesce(users.email, profiles.email), '@', 1), '.', ' '), '_', ' '), '-', ' ')), ''),
    'Fan'
  ),
  author_avatar_url = coalesce(
    nullif(btrim(posts.author_avatar_url), ''),
    nullif(btrim(profiles.avatar_url), '')
  )
from auth.users users
left join public.fan_profiles profiles on profiles.id = users.id
where posts.user_id = users.id;

update public.fan_feed_posts posts
set
  author_name = coalesce(
    nullif(btrim(profiles.name), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(initcap(replace(replace(replace(split_part(coalesce(users.email, profiles.email), '@', 1), '.', ' '), '_', ' '), '-', ' ')), ''),
    'Fan'
  ),
  author_avatar_url = coalesce(
    nullif(btrim(posts.author_avatar_url), ''),
    nullif(btrim(profiles.avatar_url), '')
  )
from auth.users users
left join public.fan_profiles profiles on profiles.id = users.id
where posts.user_id = users.id
  and (
    posts.author_name is null
    or btrim(posts.author_name) = ''
    or lower(btrim(posts.author_name)) = 'fan'
  );

update public.fan_feed_comments
set moderation_status = 'approved'
where moderation_status = 'pending'
  and moderated_by is null;

update public.fan_feed_comments comments
set
  author_name = coalesce(
    nullif(btrim(comments.author_name), ''),
    nullif(btrim(profiles.name), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(initcap(replace(replace(replace(split_part(coalesce(users.email, profiles.email), '@', 1), '.', ' '), '_', ' '), '-', ' ')), ''),
    'Fan'
  ),
  author_avatar_url = coalesce(
    nullif(btrim(comments.author_avatar_url), ''),
    nullif(btrim(profiles.avatar_url), '')
  )
from auth.users users
left join public.fan_profiles profiles on profiles.id = users.id
where comments.user_id = users.id;

update public.fan_feed_comments comments
set
  author_name = coalesce(
    nullif(btrim(profiles.name), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(initcap(replace(replace(replace(split_part(coalesce(users.email, profiles.email), '@', 1), '.', ' '), '_', ' '), '-', ' ')), ''),
    'Fan'
  ),
  author_avatar_url = coalesce(
    nullif(btrim(comments.author_avatar_url), ''),
    nullif(btrim(profiles.avatar_url), '')
  )
from auth.users users
left join public.fan_profiles profiles on profiles.id = users.id
where comments.user_id = users.id
  and (
    comments.author_name is null
    or btrim(comments.author_name) = ''
    or lower(btrim(comments.author_name)) = 'fan'
  );

update public.fan_feed_posts
set author_name = 'Fan'
where author_name is null or btrim(author_name) = '';

update public.fan_feed_comments
set author_name = 'Fan'
where author_name is null or btrim(author_name) = '';

alter table public.fan_feed_posts
  alter column author_name set not null;

alter table public.fan_feed_comments
  alter column author_name set not null;

update public.fan_feed_posts
set post_kind = 'poll'
where coalesce(post_kind, 'standard') = 'standard'
  and exists (
    select 1
    from public.fan_feed_polls polls
    where polls.post_id = fan_feed_posts.id
  );

create index if not exists idx_fan_feed_posts_created on public.fan_feed_posts(created_at desc);
create index if not exists idx_fan_feed_posts_live_session_created on public.fan_feed_posts(live_session_id, created_at desc);
create index if not exists idx_fan_feed_posts_live_session_pinned on public.fan_feed_posts(live_session_id, is_pinned desc, created_at desc);
create index if not exists idx_fan_feed_comments_post on public.fan_feed_comments(post_id, created_at);
create index if not exists idx_fan_feed_likes_post on public.fan_feed_likes(post_id);
create index if not exists idx_fan_feed_shares_post on public.fan_feed_shares(post_id, created_at desc);
create index if not exists idx_fan_feed_shares_user on public.fan_feed_shares(user_id, created_at desc);
create index if not exists idx_live_session_reactions_session on public.live_session_reactions(session_id, created_at desc);
create index if not exists idx_live_session_reactions_type on public.live_session_reactions(session_id, reaction_type, created_at desc);
create index if not exists idx_fan_feed_polls_expires_at on public.fan_feed_polls(expires_at);
create index if not exists idx_fan_feed_poll_options_poll on public.fan_feed_poll_options(poll_post_id, position);
create index if not exists idx_fan_feed_poll_votes_poll on public.fan_feed_poll_votes(poll_post_id, option_id);
create index if not exists idx_fan_feed_poll_votes_user on public.fan_feed_poll_votes(user_id, poll_post_id);
create index if not exists idx_fan_feed_trivia_questions_active on public.fan_feed_trivia_questions(is_active, created_at desc);
create index if not exists idx_fan_feed_trivia_campaigns_status_next_run on public.fan_feed_trivia_campaigns(status, next_run_at);
create index if not exists idx_fan_feed_trivia_posts_campaign on public.fan_feed_trivia_posts(campaign_id, created_at desc);
create index if not exists idx_fan_feed_posts_moderation_status on public.fan_feed_posts(moderation_status, created_at desc);
create index if not exists idx_fan_feed_comments_moderation_status on public.fan_feed_comments(moderation_status, created_at desc);
create index if not exists idx_fan_feed_reports_status on public.fan_feed_reports(status, created_at desc);
create index if not exists idx_fan_feed_reports_target on public.fan_feed_reports(target_type, target_id);

drop trigger if exists trg_fan_feed_posts_updated_at on public.fan_feed_posts;
create trigger trg_fan_feed_posts_updated_at
before update on public.fan_feed_posts
for each row
execute function public.touch_updated_at();

alter table public.fan_feed_posts enable row level security;
alter table public.fan_feed_comments enable row level security;
alter table public.fan_feed_likes enable row level security;
alter table public.fan_feed_shares enable row level security;
alter table public.live_session_reactions enable row level security;
alter table public.fan_feed_reports enable row level security;
alter table public.fan_feed_settings enable row level security;
alter table public.fan_feed_polls enable row level security;
alter table public.fan_feed_poll_options enable row level security;
alter table public.fan_feed_poll_votes enable row level security;
alter table public.fan_feed_trivia_questions enable row level security;
alter table public.fan_feed_trivia_campaigns enable row level security;
alter table public.fan_feed_trivia_posts enable row level security;

drop policy if exists "fan_feed_settings_select_authenticated" on public.fan_feed_settings;
drop policy if exists "fan_feed_settings_update_admin" on public.fan_feed_settings;
drop policy if exists "fan_feed_settings_insert_admin" on public.fan_feed_settings;

create policy "fan_feed_settings_select_authenticated"
on public.fan_feed_settings for select
using (auth.role() = 'authenticated');

create policy "fan_feed_settings_update_admin"
on public.fan_feed_settings for update
using (public.is_store_admin())
with check (public.is_store_admin());

create policy "fan_feed_settings_insert_admin"
on public.fan_feed_settings for insert
with check (public.is_store_admin());

drop policy if exists "fan_feed_posts_select_authenticated" on public.fan_feed_posts;
drop policy if exists "fan_feed_posts_insert_own" on public.fan_feed_posts;
drop policy if exists "fan_feed_posts_update_own" on public.fan_feed_posts;
drop policy if exists "fan_feed_posts_delete_own" on public.fan_feed_posts;
drop policy if exists "fan_feed_posts_moderate_admin" on public.fan_feed_posts;
drop policy if exists "live_session_reactions_select_authenticated" on public.live_session_reactions;
drop policy if exists "live_session_reactions_insert_own" on public.live_session_reactions;
drop policy if exists "live_session_reactions_delete_own_or_admin" on public.live_session_reactions;

create policy "fan_feed_posts_select_authenticated"
on public.fan_feed_posts for select
using (
  auth.role() = 'authenticated'
  and (
    moderation_status = 'approved'
    or user_id = auth.uid()
    or public.is_store_admin()
  )
);

create policy "fan_feed_posts_insert_own"
on public.fan_feed_posts for insert
with check (
  auth.uid() = user_id
  and moderation_status = 'approved'
  and moderated_by is null
  and (
    public.is_store_admin()
    or (
      is_pinned = false
      and post_kind in ('standard', 'live_chat', 'poll')
    )
  )
);

create policy "fan_feed_posts_update_own"
on public.fan_feed_posts for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and moderation_status = 'approved'
  and moderated_by is null
  and (
    public.is_store_admin()
    or (
      is_pinned = false
      and post_kind in ('standard', 'live_chat', 'poll')
    )
  )
);

create policy "fan_feed_posts_delete_own"
on public.fan_feed_posts for delete
using (auth.uid() = user_id);

create policy "fan_feed_posts_moderate_admin"
on public.fan_feed_posts for update
using (public.is_store_admin())
with check (public.is_store_admin());

drop policy if exists "fan_feed_comments_select_authenticated" on public.fan_feed_comments;
drop policy if exists "fan_feed_comments_insert_own" on public.fan_feed_comments;
drop policy if exists "fan_feed_comments_update_own" on public.fan_feed_comments;
drop policy if exists "fan_feed_comments_delete_own" on public.fan_feed_comments;
drop policy if exists "fan_feed_comments_moderate_admin" on public.fan_feed_comments;

create policy "fan_feed_comments_select_authenticated"
on public.fan_feed_comments for select
using (
  auth.role() = 'authenticated'
  and (
    moderation_status = 'approved'
    or user_id = auth.uid()
    or public.is_store_admin()
  )
  and exists (
    select 1
    from public.fan_feed_posts p
    where p.id = post_id
      and (
        p.moderation_status = 'approved'
        or p.user_id = auth.uid()
        or public.is_store_admin()
      )
  )
);

create policy "fan_feed_comments_insert_own"
on public.fan_feed_comments for insert
with check (
  auth.uid() = user_id
  and moderation_status = 'approved'
  and moderated_by is null
);

create policy "fan_feed_comments_delete_own"
on public.fan_feed_comments for delete
using (auth.uid() = user_id);

create policy "fan_feed_comments_moderate_admin"
on public.fan_feed_comments for update
using (public.is_store_admin())
with check (public.is_store_admin());

drop policy if exists "fan_feed_likes_select_authenticated" on public.fan_feed_likes;
drop policy if exists "fan_feed_likes_insert_own" on public.fan_feed_likes;
drop policy if exists "fan_feed_likes_delete_own" on public.fan_feed_likes;

create policy "fan_feed_likes_select_authenticated"
on public.fan_feed_likes for select
using (
  auth.role() = 'authenticated'
  and exists (
    select 1
    from public.fan_feed_posts p
    where p.id = post_id
      and (
        p.moderation_status = 'approved'
        or p.user_id = auth.uid()
        or public.is_store_admin()
      )
  )
);

create policy "fan_feed_likes_insert_own"
on public.fan_feed_likes for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.fan_feed_posts p
    where p.id = post_id
      and (
        p.moderation_status = 'approved'
        or p.user_id = auth.uid()
        or public.is_store_admin()
      )
  )
);

create policy "fan_feed_likes_delete_own"
on public.fan_feed_likes for delete
using (auth.uid() = user_id);

drop policy if exists "fan_feed_shares_select_authenticated" on public.fan_feed_shares;
drop policy if exists "fan_feed_shares_insert_own" on public.fan_feed_shares;
drop policy if exists "fan_feed_shares_delete_own_or_admin" on public.fan_feed_shares;

create policy "fan_feed_shares_select_authenticated"
on public.fan_feed_shares for select
using (
  auth.role() = 'authenticated'
  and exists (
    select 1
    from public.fan_feed_posts p
    where p.id = post_id
      and (
        p.moderation_status = 'approved'
        or p.user_id = auth.uid()
        or public.is_store_admin()
      )
  )
);

create policy "fan_feed_shares_insert_own"
on public.fan_feed_shares for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.fan_feed_posts p
    where p.id = post_id
      and (
        p.moderation_status = 'approved'
        or p.user_id = auth.uid()
        or public.is_store_admin()
      )
  )
);

create policy "fan_feed_shares_delete_own_or_admin"
on public.fan_feed_shares for delete
using (auth.uid() = user_id or public.is_store_admin());

create policy "live_session_reactions_select_authenticated"
on public.live_session_reactions for select
using (auth.role() = 'authenticated');

create policy "live_session_reactions_insert_own"
on public.live_session_reactions for insert
with check (
  auth.role() = 'authenticated'
  and auth.uid() = user_id
);

create policy "live_session_reactions_delete_own_or_admin"
on public.live_session_reactions for delete
using (auth.uid() = user_id or public.is_store_admin());

drop policy if exists "fan_feed_polls_select_authenticated" on public.fan_feed_polls;
drop policy if exists "fan_feed_polls_insert_own" on public.fan_feed_polls;
drop policy if exists "fan_feed_polls_update_own" on public.fan_feed_polls;
drop policy if exists "fan_feed_polls_delete_own" on public.fan_feed_polls;
drop policy if exists "fan_feed_polls_moderate_admin" on public.fan_feed_polls;

create policy "fan_feed_polls_select_authenticated"
on public.fan_feed_polls for select
using (
  auth.role() = 'authenticated'
  and exists (
    select 1
    from public.fan_feed_posts p
    where p.id = post_id
      and (
        p.moderation_status = 'approved'
        or p.user_id = auth.uid()
        or public.is_store_admin()
      )
  )
);

create policy "fan_feed_polls_insert_own"
on public.fan_feed_polls for insert
with check (
  exists (
    select 1
    from public.fan_feed_posts p
    where p.id = post_id
      and p.user_id = auth.uid()
  )
);

create policy "fan_feed_polls_update_own"
on public.fan_feed_polls for update
using (
  exists (
    select 1
    from public.fan_feed_posts p
    where p.id = post_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.fan_feed_posts p
    where p.id = post_id
      and p.user_id = auth.uid()
  )
);

create policy "fan_feed_polls_delete_own"
on public.fan_feed_polls for delete
using (
  exists (
    select 1
    from public.fan_feed_posts p
    where p.id = post_id
      and p.user_id = auth.uid()
  )
);

create policy "fan_feed_polls_moderate_admin"
on public.fan_feed_polls for all
using (public.is_store_admin())
with check (public.is_store_admin());

drop policy if exists "fan_feed_poll_options_select_authenticated" on public.fan_feed_poll_options;
drop policy if exists "fan_feed_poll_options_insert_own" on public.fan_feed_poll_options;
drop policy if exists "fan_feed_poll_options_update_own" on public.fan_feed_poll_options;
drop policy if exists "fan_feed_poll_options_delete_own" on public.fan_feed_poll_options;
drop policy if exists "fan_feed_poll_options_moderate_admin" on public.fan_feed_poll_options;

create policy "fan_feed_poll_options_select_authenticated"
on public.fan_feed_poll_options for select
using (
  auth.role() = 'authenticated'
  and exists (
    select 1
    from public.fan_feed_posts p
    where p.id = poll_post_id
      and (
        p.moderation_status = 'approved'
        or p.user_id = auth.uid()
        or public.is_store_admin()
      )
  )
);

create policy "fan_feed_poll_options_insert_own"
on public.fan_feed_poll_options for insert
with check (
  exists (
    select 1
    from public.fan_feed_posts p
    where p.id = poll_post_id
      and p.user_id = auth.uid()
  )
);

create policy "fan_feed_poll_options_update_own"
on public.fan_feed_poll_options for update
using (
  exists (
    select 1
    from public.fan_feed_posts p
    where p.id = poll_post_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.fan_feed_posts p
    where p.id = poll_post_id
      and p.user_id = auth.uid()
  )
);

create policy "fan_feed_poll_options_delete_own"
on public.fan_feed_poll_options for delete
using (
  exists (
    select 1
    from public.fan_feed_posts p
    where p.id = poll_post_id
      and p.user_id = auth.uid()
  )
);

create policy "fan_feed_poll_options_moderate_admin"
on public.fan_feed_poll_options for all
using (public.is_store_admin())
with check (public.is_store_admin());

drop policy if exists "fan_feed_poll_votes_select_authenticated" on public.fan_feed_poll_votes;
drop policy if exists "fan_feed_poll_votes_insert_own" on public.fan_feed_poll_votes;
drop policy if exists "fan_feed_poll_votes_delete_own_or_admin" on public.fan_feed_poll_votes;

create policy "fan_feed_poll_votes_select_authenticated"
on public.fan_feed_poll_votes for select
using (
  auth.role() = 'authenticated'
  and exists (
    select 1
    from public.fan_feed_posts p
    where p.id = poll_post_id
      and (
        p.moderation_status = 'approved'
        or p.user_id = auth.uid()
        or public.is_store_admin()
      )
  )
);

create policy "fan_feed_poll_votes_insert_own"
on public.fan_feed_poll_votes for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.fan_feed_poll_options o
    where o.id = option_id
      and o.poll_post_id = poll_post_id
  )
  and exists (
    select 1
    from public.fan_feed_polls pl
    where pl.post_id = poll_post_id
      and (pl.expires_at is null or pl.expires_at > now())
  )
);

create policy "fan_feed_poll_votes_delete_own_or_admin"
on public.fan_feed_poll_votes for delete
using (auth.uid() = user_id or public.is_store_admin());

drop policy if exists "fan_feed_trivia_questions_select_admin" on public.fan_feed_trivia_questions;
drop policy if exists "fan_feed_trivia_questions_insert_admin" on public.fan_feed_trivia_questions;
drop policy if exists "fan_feed_trivia_questions_update_admin" on public.fan_feed_trivia_questions;
drop policy if exists "fan_feed_trivia_questions_delete_admin" on public.fan_feed_trivia_questions;

create policy "fan_feed_trivia_questions_select_admin"
on public.fan_feed_trivia_questions for select
using (public.is_store_admin());

create policy "fan_feed_trivia_questions_insert_admin"
on public.fan_feed_trivia_questions for insert
with check (public.is_store_admin());

create policy "fan_feed_trivia_questions_update_admin"
on public.fan_feed_trivia_questions for update
using (public.is_store_admin())
with check (public.is_store_admin());

create policy "fan_feed_trivia_questions_delete_admin"
on public.fan_feed_trivia_questions for delete
using (public.is_store_admin());

drop policy if exists "fan_feed_trivia_campaigns_select_admin" on public.fan_feed_trivia_campaigns;
drop policy if exists "fan_feed_trivia_campaigns_insert_admin" on public.fan_feed_trivia_campaigns;
drop policy if exists "fan_feed_trivia_campaigns_update_admin" on public.fan_feed_trivia_campaigns;
drop policy if exists "fan_feed_trivia_campaigns_delete_admin" on public.fan_feed_trivia_campaigns;

create policy "fan_feed_trivia_campaigns_select_admin"
on public.fan_feed_trivia_campaigns for select
using (public.is_store_admin());

create policy "fan_feed_trivia_campaigns_insert_admin"
on public.fan_feed_trivia_campaigns for insert
with check (public.is_store_admin());

create policy "fan_feed_trivia_campaigns_update_admin"
on public.fan_feed_trivia_campaigns for update
using (public.is_store_admin())
with check (public.is_store_admin());

create policy "fan_feed_trivia_campaigns_delete_admin"
on public.fan_feed_trivia_campaigns for delete
using (public.is_store_admin());

drop policy if exists "fan_feed_trivia_posts_select_authenticated" on public.fan_feed_trivia_posts;
drop policy if exists "fan_feed_trivia_posts_insert_admin" on public.fan_feed_trivia_posts;
drop policy if exists "fan_feed_trivia_posts_update_admin" on public.fan_feed_trivia_posts;
drop policy if exists "fan_feed_trivia_posts_delete_admin" on public.fan_feed_trivia_posts;

create policy "fan_feed_trivia_posts_select_authenticated"
on public.fan_feed_trivia_posts for select
using (auth.role() = 'authenticated');

create policy "fan_feed_trivia_posts_insert_admin"
on public.fan_feed_trivia_posts for insert
with check (public.is_store_admin());

create policy "fan_feed_trivia_posts_update_admin"
on public.fan_feed_trivia_posts for update
using (public.is_store_admin())
with check (public.is_store_admin());

create policy "fan_feed_trivia_posts_delete_admin"
on public.fan_feed_trivia_posts for delete
using (public.is_store_admin());

drop policy if exists "fan_feed_reports_select_own_or_admin" on public.fan_feed_reports;
drop policy if exists "fan_feed_reports_insert_own" on public.fan_feed_reports;
drop policy if exists "fan_feed_reports_update_admin" on public.fan_feed_reports;

create policy "fan_feed_reports_select_own_or_admin"
on public.fan_feed_reports for select
using (auth.uid() = reporter_user_id or public.is_store_admin());

create policy "fan_feed_reports_insert_own"
on public.fan_feed_reports for insert
with check (auth.uid() = reporter_user_id);

create policy "fan_feed_reports_update_admin"
on public.fan_feed_reports for update
using (public.is_store_admin())
with check (public.is_store_admin());

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'fan_feed_posts'
    ) then
      alter publication supabase_realtime add table public.fan_feed_posts;
    end if;
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'fan_feed_comments'
    ) then
      alter publication supabase_realtime add table public.fan_feed_comments;
    end if;
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'fan_feed_likes'
    ) then
      alter publication supabase_realtime add table public.fan_feed_likes;
    end if;
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'fan_feed_shares'
    ) then
      alter publication supabase_realtime add table public.fan_feed_shares;
    end if;
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'live_session_reactions'
    ) then
      alter publication supabase_realtime add table public.live_session_reactions;
    end if;
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'fan_feed_polls'
    ) then
      alter publication supabase_realtime add table public.fan_feed_polls;
    end if;
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'fan_feed_poll_options'
    ) then
      alter publication supabase_realtime add table public.fan_feed_poll_options;
    end if;
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'fan_feed_poll_votes'
    ) then
      alter publication supabase_realtime add table public.fan_feed_poll_votes;
    end if;
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'fan_feed_trivia_posts'
    ) then
      alter publication supabase_realtime add table public.fan_feed_trivia_posts;
    end if;
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'fan_feed_reports'
    ) then
      alter publication supabase_realtime add table public.fan_feed_reports;
    end if;
  end if;
exception
  when insufficient_privilege then
    null;
end
$$;
