alter table public.fan_feed_posts
  add column if not exists live_session_id uuid references public.live_sessions(id) on delete set null;

alter table public.fan_feed_posts
  add column if not exists post_kind text not null default 'standard';

alter table public.fan_feed_posts
  alter column post_kind set default 'standard';

alter table public.fan_feed_posts
  add column if not exists is_pinned boolean not null default false;

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

create table if not exists public.live_session_reactions (
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('fire', 'bolt', 'hands', 'heart')),
  created_at timestamptz not null default now(),
  primary key (session_id, user_id, reaction_type)
);

update public.fan_feed_posts
set post_kind = 'poll'
where coalesce(post_kind, 'standard') = 'standard'
  and exists (
    select 1
    from public.fan_feed_polls polls
    where polls.post_id = fan_feed_posts.id
  );

create index if not exists idx_fan_feed_posts_live_session_created
on public.fan_feed_posts(live_session_id, created_at desc);

create index if not exists idx_fan_feed_posts_live_session_pinned
on public.fan_feed_posts(live_session_id, is_pinned desc, created_at desc);

create index if not exists idx_live_session_reactions_session
on public.live_session_reactions(session_id, created_at desc);

create index if not exists idx_live_session_reactions_type
on public.live_session_reactions(session_id, reaction_type, created_at desc);

alter table public.live_session_reactions enable row level security;

drop policy if exists "fan_feed_posts_insert_own" on public.fan_feed_posts;
drop policy if exists "fan_feed_posts_update_own" on public.fan_feed_posts;
drop policy if exists "live_session_reactions_select_authenticated" on public.live_session_reactions;
drop policy if exists "live_session_reactions_insert_own" on public.live_session_reactions;
drop policy if exists "live_session_reactions_delete_own_or_admin" on public.live_session_reactions;

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
      and tablename = 'live_session_reactions'
  ) then
    alter publication supabase_realtime add table public.live_session_reactions;
  end if;
exception
  when insufficient_privilege then
    null;
end
$$;
