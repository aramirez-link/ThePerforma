alter table public.booking_concierge_sessions
  add column if not exists pricing_profile_key text;

alter table public.booking_concierge_sessions
  add column if not exists pricing_profile_snapshot jsonb not null default '{}'::jsonb;

alter table public.booking_concierge_sessions
  add column if not exists proposal_brief jsonb not null default '{}'::jsonb;

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

alter table public.performance_pricing_profiles enable row level security;

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
