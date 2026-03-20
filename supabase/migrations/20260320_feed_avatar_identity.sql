alter table public.fan_profiles
  add column if not exists avatar_url text;

alter table public.fan_feed_posts
  add column if not exists author_name text;

alter table public.fan_feed_posts
  add column if not exists author_avatar_url text;

alter table public.fan_feed_comments
  add column if not exists author_name text;

alter table public.fan_feed_comments
  add column if not exists author_avatar_url text;

update public.fan_profiles profiles
set
  name = coalesce(
    nullif(btrim(profiles.name), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(initcap(replace(replace(replace(split_part(coalesce(users.email, profiles.email), '@', 1), '.', ' '), '_', ' '), '-', ' ')), ''),
    'Fan'
  ),
  avatar_url = nullif(btrim(profiles.avatar_url), '')
from auth.users users
where users.id = profiles.id;

update public.fan_feed_posts posts
set
  author_name = coalesce(
    nullif(btrim(posts.author_name), ''),
    nullif(btrim(profiles.name), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(initcap(replace(replace(replace(split_part(coalesce(users.email, profiles.email), '@', 1), '.', ' '), '_', ' '), '-', ' ')), ''),
    'Fan'
  ),
  author_avatar_url = coalesce(
    nullif(btrim(posts.author_avatar_url), ''),
    nullif(btrim(profiles.avatar_url), '')
  )
from auth.users users
left join public.fan_profiles profiles on profiles.id = users.id
where posts.user_id = users.id;

update public.fan_feed_comments comments
set
  author_name = coalesce(
    nullif(btrim(comments.author_name), ''),
    nullif(btrim(profiles.name), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(initcap(replace(replace(replace(split_part(coalesce(users.email, profiles.email), '@', 1), '.', ' '), '_', ' '), '-', ' ')), ''),
    'Fan'
  ),
  author_avatar_url = coalesce(
    nullif(btrim(comments.author_avatar_url), ''),
    nullif(btrim(profiles.avatar_url), '')
  )
from auth.users users
left join public.fan_profiles profiles on profiles.id = users.id
where comments.user_id = users.id;

update public.fan_feed_posts
set author_name = 'Fan'
where author_name is null or btrim(author_name) = '';

update public.fan_feed_comments
set author_name = 'Fan'
where author_name is null or btrim(author_name) = '';

alter table public.fan_feed_posts
  alter column author_name set default 'Fan';

alter table public.fan_feed_comments
  alter column author_name set default 'Fan';

alter table public.fan_feed_posts
  alter column author_name set not null;

alter table public.fan_feed_comments
  alter column author_name set not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fan-avatar-media',
  'fan-avatar-media',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fan_avatar_media_read" on storage.objects;
drop policy if exists "fan_avatar_media_upload_authenticated" on storage.objects;
drop policy if exists "fan_avatar_media_update_own" on storage.objects;
drop policy if exists "fan_avatar_media_delete_own" on storage.objects;

create policy "fan_avatar_media_read"
on storage.objects for select
using (bucket_id = 'fan-avatar-media');

create policy "fan_avatar_media_upload_authenticated"
on storage.objects for insert
with check (
  bucket_id = 'fan-avatar-media'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "fan_avatar_media_update_own"
on storage.objects for update
using (
  bucket_id = 'fan-avatar-media'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'fan-avatar-media'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "fan_avatar_media_delete_own"
on storage.objects for delete
using (
  bucket_id = 'fan-avatar-media'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);
