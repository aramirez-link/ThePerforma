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
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_booking_concierge_sessions_created
on public.booking_concierge_sessions(created_at desc);

create index if not exists idx_booking_concierge_sessions_status
on public.booking_concierge_sessions(status, created_at desc);

create index if not exists idx_booking_concierge_sessions_contact_email
on public.booking_concierge_sessions(lower(contact_email));

alter table public.booking_concierge_sessions enable row level security;

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
