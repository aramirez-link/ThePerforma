create table if not exists public.watch_featured_reels (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  platform text not null default 'youtube' check (platform in ('youtube', 'vimeo', 'custom')),
  source_url text not null,
  embed_url text not null,
  thumbnail_url text,
  go_live_at timestamptz not null default now(),
  retire_at timestamptz,
  is_active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  check (retire_at is null or retire_at > go_live_at)
);

create index if not exists idx_watch_featured_reels_go_live
on public.watch_featured_reels(is_active, go_live_at desc);

create index if not exists idx_watch_featured_reels_retire
on public.watch_featured_reels(is_active, retire_at asc);

drop trigger if exists trg_watch_featured_reels_updated_at on public.watch_featured_reels;
create trigger trg_watch_featured_reels_updated_at
before update on public.watch_featured_reels
for each row
execute function public.touch_updated_at();

alter table public.watch_featured_reels enable row level security;

drop policy if exists "watch_featured_reels_select_public_or_admin" on public.watch_featured_reels;
drop policy if exists "watch_featured_reels_manage_admin" on public.watch_featured_reels;

create policy "watch_featured_reels_select_public_or_admin"
on public.watch_featured_reels for select
using (
  public.is_store_admin()
  or (
    is_active = true
    and go_live_at <= now()
    and (retire_at is null or retire_at > now())
  )
);

create policy "watch_featured_reels_manage_admin"
on public.watch_featured_reels for all
using (public.is_store_admin())
with check (public.is_store_admin());

grant select on public.watch_featured_reels to anon, authenticated;
grant insert, update, delete on public.watch_featured_reels to authenticated;

insert into public.watch_featured_reels (
  title,
  platform,
  source_url,
  embed_url,
  thumbnail_url,
  go_live_at,
  is_active,
  notes
)
select
  'Chip Lee - Live Reel 2',
  'youtube',
  'https://www.youtube.com/watch?v=x4iF1AXYWn4',
  'https://www.youtube.com/embed/x4iF1AXYWn4',
  '/assets/img/200NewChip_4K.jpg',
  now(),
  true,
  'Seeded from the legacy featured reels list on the watch page.'
where not exists (
  select 1
  from public.watch_featured_reels
);
