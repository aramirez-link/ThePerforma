drop policy if exists "performance_pricing_profiles_select_active_or_admin" on public.performance_pricing_profiles;
drop policy if exists "performance_pricing_profiles_manage_admin" on public.performance_pricing_profiles;

create policy "performance_pricing_profiles_select_active_or_admin"
on public.performance_pricing_profiles for select
using (is_active = true or public.is_store_admin());

create policy "performance_pricing_profiles_manage_admin"
on public.performance_pricing_profiles for all
using (public.is_store_admin())
with check (public.is_store_admin());

notify pgrst, 'reload schema';
