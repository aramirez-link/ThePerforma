drop policy if exists "live_sessions_select_own" on public.live_sessions;
drop policy if exists "live_sessions_update_own" on public.live_sessions;
drop policy if exists "live_sessions_delete_own" on public.live_sessions;

create policy "live_sessions_select_own"
on public.live_sessions for select
using (auth.uid() = creator_id or public.is_store_admin());

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
