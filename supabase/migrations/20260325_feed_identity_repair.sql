create or replace function public.get_fan_identity_profiles(profile_ids uuid[])
returns table (
  id uuid,
  name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    profiles.id,
    coalesce(
      nullif(btrim(profiles.name), ''),
      nullif(btrim(users.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
      nullif(initcap(replace(replace(replace(split_part(coalesce(users.email, profiles.email), '@', 1), '.', ' '), '_', ' '), '-', ' ')), ''),
      'Fan'
    ) as name,
    nullif(btrim(profiles.avatar_url), '') as avatar_url
  from public.fan_profiles profiles
  left join auth.users users on users.id = profiles.id
  where profiles.id = any (coalesce(profile_ids, '{}'::uuid[]));
$$;

grant execute on function public.get_fan_identity_profiles(uuid[]) to authenticated;

update public.fan_profiles profiles
set name = coalesce(
  nullif(btrim(profiles.name), ''),
  nullif(btrim(users.raw_user_meta_data ->> 'name'), ''),
  nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
  nullif(initcap(replace(replace(replace(split_part(coalesce(users.email, profiles.email), '@', 1), '.', ' '), '_', ' '), '-', ' ')), ''),
  'Fan'
)
from auth.users users
where users.id = profiles.id
  and (
    profiles.name is null
    or btrim(profiles.name) = ''
    or lower(btrim(profiles.name)) = 'fan'
  );

update public.fan_feed_posts posts
set
  author_name = coalesce(
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
from public.fan_profiles profiles
left join auth.users users on users.id = profiles.id
where posts.user_id = profiles.id
  and (
    posts.author_name is null
    or btrim(posts.author_name) = ''
    or lower(btrim(posts.author_name)) = 'fan'
  );

update public.fan_feed_comments comments
set
  author_name = coalesce(
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
from public.fan_profiles profiles
left join auth.users users on users.id = profiles.id
where comments.user_id = profiles.id
  and (
    comments.author_name is null
    or btrim(comments.author_name) = ''
    or lower(btrim(comments.author_name)) = 'fan'
  );
