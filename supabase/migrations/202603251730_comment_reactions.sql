create table if not exists public.fan_feed_comment_reactions (
  comment_id bigint not null references public.fan_feed_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('thumbs_up', 'smile', 'mad', 'surprised', 'thinking', 'exclaim')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, reaction_type)
);

create index if not exists idx_fan_feed_comment_reactions_comment
on public.fan_feed_comment_reactions(comment_id, reaction_type, created_at desc);

create index if not exists idx_fan_feed_comment_reactions_user
on public.fan_feed_comment_reactions(user_id, created_at desc);

alter table public.fan_feed_comment_reactions enable row level security;

drop policy if exists "fan_feed_comment_reactions_select_authenticated" on public.fan_feed_comment_reactions;
drop policy if exists "fan_feed_comment_reactions_insert_own" on public.fan_feed_comment_reactions;
drop policy if exists "fan_feed_comment_reactions_delete_own_or_admin" on public.fan_feed_comment_reactions;

create policy "fan_feed_comment_reactions_select_authenticated"
on public.fan_feed_comment_reactions for select
using (
  auth.role() = 'authenticated'
  and exists (
    select 1
    from public.fan_feed_comments c
    join public.fan_feed_posts p on p.id = c.post_id
    where c.id = comment_id
      and (
        c.moderation_status = 'approved'
        or c.user_id = auth.uid()
        or public.is_store_admin()
      )
      and (
        p.moderation_status = 'approved'
        or p.user_id = auth.uid()
        or public.is_store_admin()
      )
  )
);

create policy "fan_feed_comment_reactions_insert_own"
on public.fan_feed_comment_reactions for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.fan_feed_comments c
    join public.fan_feed_posts p on p.id = c.post_id
    where c.id = comment_id
      and (
        c.moderation_status = 'approved'
        or c.user_id = auth.uid()
        or public.is_store_admin()
      )
      and (
        p.moderation_status = 'approved'
        or p.user_id = auth.uid()
        or public.is_store_admin()
      )
  )
);

create policy "fan_feed_comment_reactions_delete_own_or_admin"
on public.fan_feed_comment_reactions for delete
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
      and tablename = 'fan_feed_comment_reactions'
  ) then
    alter publication supabase_realtime add table public.fan_feed_comment_reactions;
  end if;
exception
  when insufficient_privilege then
    null;
end
$$;
