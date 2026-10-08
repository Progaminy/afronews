-- AfroNews site settings: editable branding/contact links for administrators.

create table if not exists public.afronews_site_settings (
  id boolean primary key default true check (id),
  primary_color text not null default '#f2c300' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  profile_image_url text not null default '',
  whatsapp_number text not null default '',
  facebook_url text not null default '',
  youtube_url text not null default '',
  tiktok_url text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.afronews_site_settings enable row level security;

grant select on public.afronews_site_settings to anon, authenticated;
grant update on public.afronews_site_settings to authenticated;

drop policy if exists "afronews_settings_public_read" on public.afronews_site_settings;
create policy "afronews_settings_public_read"
on public.afronews_site_settings for select to anon, authenticated
using (true);

drop policy if exists "afronews_settings_admin_update" on public.afronews_site_settings;
create policy "afronews_settings_admin_update"
on public.afronews_site_settings for update to authenticated
using (exists (
  select 1 from public.afronews_admins a
  where a.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.afronews_admins a
  where a.user_id = (select auth.uid())
));

insert into public.afronews_site_settings (
  id, primary_color, whatsapp_number, facebook_url, youtube_url, tiktok_url
)
values (
  true, '#f2c300', '+258 72 599 084',
  'https://www.facebook.com/opiniaoafro',
  'https://www.youtube.com/@MUSSAGINIKOZI-t4k',
  'https://www.tiktok.com/'
)
on conflict (id) do nothing;
