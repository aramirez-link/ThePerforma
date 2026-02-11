-- Fan Vault schema for Supabase
-- Run in Supabase SQL editor.

create table if not exists public.fan_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default 'Fan',
  bio text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.fan_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('gallery', 'watch', 'listen')),
  item_id text not null,
  title text not null,
  href text not null,
  image text,
  saved_at timestamptz not null default now(),
  primary key (user_id, type, item_id)
);

create table if not exists public.fan_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id text not null,
  label text not null,
  tier text,
  tip text,
  updated_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table if not exists public.fan_live_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  email_alerts boolean not null default true,
  sms_alerts boolean not null default false,
  sms_phone text,
  preferred_platform text not null default 'multi' check (preferred_platform in ('youtube', 'instagram', 'facebook', 'twitch', 'multi')),
  updated_at timestamptz not null default now()
);

alter table public.fan_live_subscriptions
  add column if not exists sms_phone text;

create table if not exists public.fan_live_dispatches (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  created_by text not null default 'system',
  status text not null check (status in ('live', 'offline', 'test')),
  title text not null,
  stream_url text not null,
  platform text not null default 'multi',
  email_count integer not null default 0,
  sms_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.fan_live_engagement_events (
  id bigserial primary key,
  dispatch_id bigint references public.fan_live_dispatches(id) on delete cascade,
  event_type text not null check (event_type in ('open', 'click')),
  recipient text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.fan_engagement_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Fan',
  points integer not null default 120 check (points >= 0),
  streak integer not null default 1 check (streak >= 0),
  last_seen_date date not null default current_date,
  daily_claim_date date,
  week_key text not null default '',
  weekly_signal integer not null default 0 check (weekly_signal >= 0),
  visited_paths text[] not null default '{}',
  reactions jsonb not null default '{"fire":0,"bolt":0,"hands":0}'::jsonb,
  missions jsonb not null default '{"stageMode":false,"watchAndListen":false,"innerCircle":false}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_fan_engagement_profiles_score
on public.fan_engagement_profiles ((points + weekly_signal + (streak * 17))) desc;

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
      and tablename = 'fan_engagement_profiles'
  ) then
    alter publication supabase_realtime add table public.fan_engagement_profiles;
  end if;
exception
  when insufficient_privilege then
    null;
end
$$;

alter table public.fan_profiles enable row level security;
alter table public.fan_favorites enable row level security;
alter table public.fan_badges enable row level security;
alter table public.fan_live_subscriptions enable row level security;
alter table public.fan_live_dispatches enable row level security;
alter table public.fan_live_engagement_events enable row level security;
alter table public.fan_engagement_profiles enable row level security;

drop policy if exists "fan_profiles_select_own" on public.fan_profiles;
drop policy if exists "fan_profiles_insert_own" on public.fan_profiles;
drop policy if exists "fan_profiles_update_own" on public.fan_profiles;

create policy "fan_profiles_select_own"
on public.fan_profiles for select
using (auth.uid() = id);

create policy "fan_profiles_insert_own"
on public.fan_profiles for insert
with check (auth.uid() = id);

create policy "fan_profiles_update_own"
on public.fan_profiles for update
using (auth.uid() = id);

drop policy if exists "fan_favorites_select_own" on public.fan_favorites;
drop policy if exists "fan_favorites_insert_own" on public.fan_favorites;
drop policy if exists "fan_favorites_update_own" on public.fan_favorites;
drop policy if exists "fan_favorites_delete_own" on public.fan_favorites;

create policy "fan_favorites_select_own"
on public.fan_favorites for select
using (auth.uid() = user_id);

create policy "fan_favorites_insert_own"
on public.fan_favorites for insert
with check (auth.uid() = user_id);

create policy "fan_favorites_update_own"
on public.fan_favorites for update
using (auth.uid() = user_id);

create policy "fan_favorites_delete_own"
on public.fan_favorites for delete
using (auth.uid() = user_id);

drop policy if exists "fan_badges_select_own" on public.fan_badges;
drop policy if exists "fan_badges_insert_own" on public.fan_badges;
drop policy if exists "fan_badges_update_own" on public.fan_badges;
drop policy if exists "fan_badges_delete_own" on public.fan_badges;

create policy "fan_badges_select_own"
on public.fan_badges for select
using (auth.uid() = user_id);

create policy "fan_badges_insert_own"
on public.fan_badges for insert
with check (auth.uid() = user_id);

create policy "fan_badges_update_own"
on public.fan_badges for update
using (auth.uid() = user_id);

create policy "fan_badges_delete_own"
on public.fan_badges for delete
using (auth.uid() = user_id);

drop policy if exists "fan_live_subscriptions_select_own" on public.fan_live_subscriptions;
drop policy if exists "fan_live_subscriptions_insert_own" on public.fan_live_subscriptions;
drop policy if exists "fan_live_subscriptions_update_own" on public.fan_live_subscriptions;
drop policy if exists "fan_live_subscriptions_delete_own" on public.fan_live_subscriptions;

create policy "fan_live_subscriptions_select_own"
on public.fan_live_subscriptions for select
using (auth.uid() = user_id);

create policy "fan_live_subscriptions_insert_own"
on public.fan_live_subscriptions for insert
with check (auth.uid() = user_id);

create policy "fan_live_subscriptions_update_own"
on public.fan_live_subscriptions for update
using (auth.uid() = user_id);

create policy "fan_live_subscriptions_delete_own"
on public.fan_live_subscriptions for delete
using (auth.uid() = user_id);

drop policy if exists "fan_live_dispatches_select_none" on public.fan_live_dispatches;
create policy "fan_live_dispatches_select_none"
on public.fan_live_dispatches for select
using (false);

drop policy if exists "fan_live_engagement_events_select_none" on public.fan_live_engagement_events;
create policy "fan_live_engagement_events_select_none"
on public.fan_live_engagement_events for select
using (false);

drop policy if exists "fan_engagement_profiles_select_authenticated" on public.fan_engagement_profiles;
drop policy if exists "fan_engagement_profiles_insert_own" on public.fan_engagement_profiles;
drop policy if exists "fan_engagement_profiles_update_own" on public.fan_engagement_profiles;
drop policy if exists "fan_engagement_profiles_delete_own" on public.fan_engagement_profiles;

create policy "fan_engagement_profiles_select_authenticated"
on public.fan_engagement_profiles for select
using (auth.role() = 'authenticated');

create policy "fan_engagement_profiles_insert_own"
on public.fan_engagement_profiles for insert
with check (auth.uid() = user_id);

create policy "fan_engagement_profiles_update_own"
on public.fan_engagement_profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "fan_engagement_profiles_delete_own"
on public.fan_engagement_profiles for delete
using (auth.uid() = user_id);

-- ===============================
-- Store schema (MVP)
-- ===============================

create table if not exists public.store_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'support')),
  created_at timestamptz not null default now()
);

create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  product_type text not null check (product_type in ('physical', 'digital_tool', 'digital_download', 'subscription', 'bundle')),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  currency text not null default 'usd',
  base_price_cents integer not null default 0 check (base_price_cents >= 0),
  cover_image text,
  gallery jsonb not null default '[]'::jsonb,
  related_product_ids uuid[] not null default '{}',
  stripe_tax_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products(id) on delete cascade,
  sku text not null unique,
  title text not null,
  price_cents integer not null check (price_cents >= 0),
  compare_at_cents integer check (compare_at_cents is null or compare_at_cents >= 0),
  inventory_mode text not null default 'unlimited' check (inventory_mode in ('finite', 'unlimited')),
  inventory_count integer check (inventory_count is null or inventory_count >= 0),
  weight_grams integer check (weight_grams is null or weight_grams >= 0),
  attributes jsonb not null default '{}'::jsonb,
  digital_delivery_url text,
  stripe_price_id text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_wishlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.store_reviews (
  id bigserial primary key,
  product_id uuid not null references public.store_products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  title text not null default '',
  body text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_orders (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  stripe_customer_email text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'refunded', 'fulfilled', 'partially_refunded')),
  currency text not null default 'usd',
  subtotal_cents integer not null default 0,
  tax_cents integer not null default 0,
  shipping_cents integer not null default 0,
  total_cents integer not null default 0,
  shipping_carrier text,
  tracking_number text,
  shipped_at timestamptz,
  fulfilled_at timestamptz,
  cancel_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_order_items (
  id bigserial primary key,
  order_id bigint not null references public.store_orders(id) on delete cascade,
  product_id uuid references public.store_products(id) on delete set null,
  variant_id uuid references public.store_product_variants(id) on delete set null,
  title text not null,
  variant_title text,
  sku text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  line_total_cents integer not null default 0 check (line_total_cents >= 0),
  delivery_url text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.store_order_events (
  id bigserial primary key,
  order_id bigint references public.store_orders(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_store_products_status on public.store_products(status);
create index if not exists idx_store_product_variants_product on public.store_product_variants(product_id);
create index if not exists idx_store_reviews_product on public.store_reviews(product_id);
create index if not exists idx_store_orders_created_at on public.store_orders(created_at desc);
create index if not exists idx_store_orders_user on public.store_orders(user_id);
create index if not exists idx_store_orders_checkout on public.store_orders(stripe_checkout_session_id);
create index if not exists idx_store_order_items_order on public.store_order_items(order_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_store_products_updated_at on public.store_products;
create trigger trg_store_products_updated_at
before update on public.store_products
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_store_product_variants_updated_at on public.store_product_variants;
create trigger trg_store_product_variants_updated_at
before update on public.store_product_variants
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_store_reviews_updated_at on public.store_reviews;
create trigger trg_store_reviews_updated_at
before update on public.store_reviews
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_store_orders_updated_at on public.store_orders;
create trigger trg_store_orders_updated_at
before update on public.store_orders
for each row
execute function public.touch_updated_at();

create or replace function public.is_store_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.store_admins a
    where a.user_id = auth.uid()
  );
$$;

alter table public.store_admins enable row level security;
alter table public.store_products enable row level security;
alter table public.store_product_variants enable row level security;
alter table public.store_wishlists enable row level security;
alter table public.store_reviews enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.store_order_events enable row level security;

drop policy if exists "store_admins_select_admin_only" on public.store_admins;
drop policy if exists "store_admins_manage_owner_only" on public.store_admins;

create policy "store_admins_select_admin_only"
on public.store_admins for select
using (public.is_store_admin());

create policy "store_admins_manage_owner_only"
on public.store_admins for all
using (
  exists (
    select 1 from public.store_admins s
    where s.user_id = auth.uid()
      and s.role = 'owner'
  )
)
with check (
  exists (
    select 1 from public.store_admins s
    where s.user_id = auth.uid()
      and s.role = 'owner'
  )
);

drop policy if exists "store_products_select_public_active_or_admin" on public.store_products;
drop policy if exists "store_products_insert_admin" on public.store_products;
drop policy if exists "store_products_update_admin" on public.store_products;
drop policy if exists "store_products_delete_admin" on public.store_products;

create policy "store_products_select_public_active_or_admin"
on public.store_products for select
using (status = 'active' or public.is_store_admin());

create policy "store_products_insert_admin"
on public.store_products for insert
with check (public.is_store_admin());

create policy "store_products_update_admin"
on public.store_products for update
using (public.is_store_admin())
with check (public.is_store_admin());

create policy "store_products_delete_admin"
on public.store_products for delete
using (public.is_store_admin());

drop policy if exists "store_variants_select_public_active_or_admin" on public.store_product_variants;
drop policy if exists "store_variants_insert_admin" on public.store_product_variants;
drop policy if exists "store_variants_update_admin" on public.store_product_variants;
drop policy if exists "store_variants_delete_admin" on public.store_product_variants;

create policy "store_variants_select_public_active_or_admin"
on public.store_product_variants for select
using (
  public.is_store_admin() or (
    is_active = true and exists (
      select 1
      from public.store_products p
      where p.id = product_id
        and p.status = 'active'
    )
  )
);

create policy "store_variants_insert_admin"
on public.store_product_variants for insert
with check (public.is_store_admin());

create policy "store_variants_update_admin"
on public.store_product_variants for update
using (public.is_store_admin())
with check (public.is_store_admin());

create policy "store_variants_delete_admin"
on public.store_product_variants for delete
using (public.is_store_admin());

drop policy if exists "store_wishlists_select_own" on public.store_wishlists;
drop policy if exists "store_wishlists_insert_own" on public.store_wishlists;
drop policy if exists "store_wishlists_delete_own" on public.store_wishlists;

create policy "store_wishlists_select_own"
on public.store_wishlists for select
using (auth.uid() = user_id);

create policy "store_wishlists_insert_own"
on public.store_wishlists for insert
with check (auth.uid() = user_id);

create policy "store_wishlists_delete_own"
on public.store_wishlists for delete
using (auth.uid() = user_id);

drop policy if exists "store_reviews_select_public_or_owner_or_admin" on public.store_reviews;
drop policy if exists "store_reviews_insert_own" on public.store_reviews;
drop policy if exists "store_reviews_update_own_or_admin" on public.store_reviews;
drop policy if exists "store_reviews_delete_own_or_admin" on public.store_reviews;

create policy "store_reviews_select_public_or_owner_or_admin"
on public.store_reviews for select
using (
  status = 'approved' or auth.uid() = user_id or public.is_store_admin()
);

create policy "store_reviews_insert_own"
on public.store_reviews for insert
with check (auth.uid() = user_id);

create policy "store_reviews_update_own_or_admin"
on public.store_reviews for update
using (public.is_store_admin() or auth.uid() = user_id)
with check (public.is_store_admin() or auth.uid() = user_id);

create policy "store_reviews_delete_own_or_admin"
on public.store_reviews for delete
using (public.is_store_admin() or auth.uid() = user_id);

drop policy if exists "store_orders_select_own_or_admin" on public.store_orders;
drop policy if exists "store_orders_update_admin" on public.store_orders;

create policy "store_orders_select_own_or_admin"
on public.store_orders for select
using (auth.uid() = user_id or public.is_store_admin());

create policy "store_orders_update_admin"
on public.store_orders for update
using (public.is_store_admin())
with check (public.is_store_admin());

drop policy if exists "store_order_items_select_own_or_admin" on public.store_order_items;
drop policy if exists "store_order_items_update_admin" on public.store_order_items;

create policy "store_order_items_select_own_or_admin"
on public.store_order_items for select
using (
  public.is_store_admin() or exists (
    select 1
    from public.store_orders o
    where o.id = order_id
      and o.user_id = auth.uid()
  )
);

create policy "store_order_items_update_admin"
on public.store_order_items for update
using (public.is_store_admin())
with check (public.is_store_admin());

drop policy if exists "store_order_events_select_admin" on public.store_order_events;
drop policy if exists "store_order_events_insert_admin" on public.store_order_events;

create policy "store_order_events_select_admin"
on public.store_order_events for select
using (public.is_store_admin());

create policy "store_order_events_insert_admin"
on public.store_order_events for insert
with check (public.is_store_admin());
