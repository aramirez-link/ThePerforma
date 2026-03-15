create table if not exists public.media_kit_requests (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null check (length(trim(full_name)) between 2 and 160),
  email text not null check (length(trim(email)) between 5 and 320),
  phone text,
  interest text not null check (length(trim(interest)) between 2 and 120),
  source_path text not null default '/story' check (source_path like '/%'),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_media_kit_requests_created_at
on public.media_kit_requests(created_at desc);

create index if not exists idx_media_kit_requests_email
on public.media_kit_requests(lower(email));

alter table public.media_kit_requests enable row level security;

drop policy if exists "media_kit_requests_insert_public" on public.media_kit_requests;
drop policy if exists "media_kit_requests_select_admin" on public.media_kit_requests;

create policy "media_kit_requests_insert_public"
on public.media_kit_requests for insert
with check (true);

create policy "media_kit_requests_select_admin"
on public.media_kit_requests for select
using (public.is_store_admin());

grant insert on public.media_kit_requests to anon, authenticated;
grant select on public.media_kit_requests to authenticated;
grant usage, select on sequence public.media_kit_requests_id_seq to anon, authenticated;
