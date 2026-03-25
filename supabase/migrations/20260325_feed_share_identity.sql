create table if not exists public.fan_feed_shares (
  post_id bigint not null references public.fan_feed_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists idx_fan_feed_shares_post
on public.fan_feed_shares(post_id, created_at desc);

create index if not exists idx_fan_feed_shares_user
on public.fan_feed_shares(user_id, created_at desc);

alter table public.fan_feed_shares enable row level security;

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
      and tablename = 'fan_feed_shares'
  ) then
    alter publication supabase_realtime add table public.fan_feed_shares;
  end if;
exception
  when insufficient_privilege then
    null;
end
$$;
