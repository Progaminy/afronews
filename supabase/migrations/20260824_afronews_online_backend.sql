-- AfroNews online backend.
-- Applied to Supabase project uvypcuixxrjikjaduvyo on 2026-08-24.
-- The initial admin membership was seeded separately from the project's existing site administrator.

create table if not exists public.afronews_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.afronews_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) > 0),
  body text not null check (char_length(btrim(body)) > 0),
  category text not null check (category in ('África','Europa','América','Rússia','Ásia','Oceania')),
  image_urls text[] not null default '{}'::text[],
  video_urls text[] not null default '{}'::text[],
  status text not null default 'published' check (status in ('draft','published')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.afronews_admins enable row level security;
alter table public.afronews_posts enable row level security;

grant select on public.afronews_admins to authenticated;
grant select on public.afronews_posts to anon, authenticated;
grant insert, update, delete on public.afronews_posts to authenticated;

drop policy if exists "afronews_admin_self_read" on public.afronews_admins;
create policy "afronews_admin_self_read"
on public.afronews_admins for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "afronews_public_read_published" on public.afronews_posts;
create policy "afronews_public_read_published"
on public.afronews_posts for select to anon, authenticated
using (status = 'published');

drop policy if exists "afronews_admin_read_all" on public.afronews_posts;
create policy "afronews_admin_read_all"
on public.afronews_posts for select to authenticated
using (exists (
  select 1 from public.afronews_admins a
  where a.user_id = (select auth.uid())
));

drop policy if exists "afronews_admin_insert" on public.afronews_posts;
create policy "afronews_admin_insert"
on public.afronews_posts for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.afronews_admins a
    where a.user_id = (select auth.uid())
  )
);

drop policy if exists "afronews_admin_update" on public.afronews_posts;
create policy "afronews_admin_update"
on public.afronews_posts for update to authenticated
using (exists (
  select 1 from public.afronews_admins a
  where a.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.afronews_admins a
  where a.user_id = (select auth.uid())
));

drop policy if exists "afronews_admin_delete" on public.afronews_posts;
create policy "afronews_admin_delete"
on public.afronews_posts for delete to authenticated
using (exists (
  select 1 from public.afronews_admins a
  where a.user_id = (select auth.uid())
));

insert into storage.buckets (id, name, public)
values ('afronews-media', 'afronews-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "afronews_media_admin_insert" on storage.objects;
create policy "afronews_media_admin_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'afronews-media'
  and exists (
    select 1 from public.afronews_admins a
    where a.user_id = (select auth.uid())
  )
);

drop policy if exists "afronews_media_admin_select" on storage.objects;
create policy "afronews_media_admin_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'afronews-media'
  and exists (
    select 1 from public.afronews_admins a
    where a.user_id = (select auth.uid())
  )
);

drop policy if exists "afronews_media_admin_update" on storage.objects;
create policy "afronews_media_admin_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'afronews-media'
  and exists (
    select 1 from public.afronews_admins a
    where a.user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'afronews-media'
  and exists (
    select 1 from public.afronews_admins a
    where a.user_id = (select auth.uid())
  )
);

drop policy if exists "afronews_media_admin_delete" on storage.objects;
create policy "afronews_media_admin_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'afronews-media'
  and exists (
    select 1 from public.afronews_admins a
    where a.user_id = (select auth.uid())
  )
);
