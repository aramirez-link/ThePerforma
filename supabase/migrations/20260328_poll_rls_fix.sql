create or replace function public.can_access_feed_post(target_post_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.fan_feed_posts p
    where p.id = target_post_id
      and (
        p.moderation_status = 'approved'
        or p.user_id = auth.uid()
        or public.is_store_admin()
      )
  );
$$;

create or replace function public.can_manage_feed_post(target_post_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.fan_feed_posts p
    where p.id = target_post_id
      and (
        p.user_id = auth.uid()
        or public.is_store_admin()
      )
  );
$$;

create or replace function public.can_vote_on_feed_poll(target_post_id bigint, target_option_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.fan_feed_polls pl
    join public.fan_feed_poll_options o
      on o.poll_post_id = pl.post_id
     and o.id = target_option_id
    join public.fan_feed_posts p
      on p.id = pl.post_id
    where pl.post_id = target_post_id
      and (pl.expires_at is null or pl.expires_at > now())
      and (
        p.moderation_status = 'approved'
        or p.user_id = auth.uid()
        or public.is_store_admin()
      )
  );
$$;

grant execute on function public.can_access_feed_post(bigint) to authenticated;
grant execute on function public.can_manage_feed_post(bigint) to authenticated;
grant execute on function public.can_vote_on_feed_poll(bigint, bigint) to authenticated;

drop policy if exists "fan_feed_polls_select_authenticated" on public.fan_feed_polls;
drop policy if exists "fan_feed_polls_insert_own" on public.fan_feed_polls;
drop policy if exists "fan_feed_polls_update_own" on public.fan_feed_polls;
drop policy if exists "fan_feed_polls_delete_own" on public.fan_feed_polls;

create policy "fan_feed_polls_select_authenticated"
on public.fan_feed_polls for select
using (
  auth.role() = 'authenticated'
  and public.can_access_feed_post(post_id)
);

create policy "fan_feed_polls_insert_own"
on public.fan_feed_polls for insert
with check (public.can_manage_feed_post(post_id));

create policy "fan_feed_polls_update_own"
on public.fan_feed_polls for update
using (public.can_manage_feed_post(post_id))
with check (public.can_manage_feed_post(post_id));

create policy "fan_feed_polls_delete_own"
on public.fan_feed_polls for delete
using (public.can_manage_feed_post(post_id));

drop policy if exists "fan_feed_poll_options_select_authenticated" on public.fan_feed_poll_options;
drop policy if exists "fan_feed_poll_options_insert_own" on public.fan_feed_poll_options;
drop policy if exists "fan_feed_poll_options_update_own" on public.fan_feed_poll_options;
drop policy if exists "fan_feed_poll_options_delete_own" on public.fan_feed_poll_options;

create policy "fan_feed_poll_options_select_authenticated"
on public.fan_feed_poll_options for select
using (
  auth.role() = 'authenticated'
  and public.can_access_feed_post(poll_post_id)
);

create policy "fan_feed_poll_options_insert_own"
on public.fan_feed_poll_options for insert
with check (public.can_manage_feed_post(poll_post_id));

create policy "fan_feed_poll_options_update_own"
on public.fan_feed_poll_options for update
using (public.can_manage_feed_post(poll_post_id))
with check (public.can_manage_feed_post(poll_post_id));

create policy "fan_feed_poll_options_delete_own"
on public.fan_feed_poll_options for delete
using (public.can_manage_feed_post(poll_post_id));

drop policy if exists "fan_feed_poll_votes_select_authenticated" on public.fan_feed_poll_votes;
drop policy if exists "fan_feed_poll_votes_insert_own" on public.fan_feed_poll_votes;

create policy "fan_feed_poll_votes_select_authenticated"
on public.fan_feed_poll_votes for select
using (
  auth.role() = 'authenticated'
  and public.can_access_feed_post(poll_post_id)
);

create policy "fan_feed_poll_votes_insert_own"
on public.fan_feed_poll_votes for insert
with check (
  auth.uid() = user_id
  and public.can_vote_on_feed_poll(poll_post_id, option_id)
);

notify pgrst, 'reload schema';
