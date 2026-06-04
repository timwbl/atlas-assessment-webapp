-- ATLAS Assessment WebApp: optional account sync and admin progress dashboard.
-- Run this in the Supabase SQL editor after creating a new project.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.user_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  assessment_id text not null,
  progress jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, assessment_id)
);

create table if not exists public.summary_downloads (
  id text primary key,
  title text not null,
  semester text not null check (semester in ('HS2025', 'FS2026')),
  block_id text not null,
  block_title text not null,
  description text,
  version text,
  file_name text not null,
  file_type text not null,
  file_size bigint not null,
  upload_date timestamptz not null default now(),
  copyright_owner text not null default 'Tim Weibel' check (copyright_owner = 'Tim Weibel'),
  file_data text,
  file_path text,
  download_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_block_recommendations (
  id text primary key,
  semester text not null check (semester in ('HS2025', 'FS2026')),
  block_id text not null,
  block_title text not null,
  rating integer check (rating between 1 and 10),
  comment text,
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_reviews (
  id text primary key,
  assessment_id text not null,
  assessment_title text not null,
  lecture_code text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_email text not null,
  display_name text,
  rating integer not null check (rating between 1 and 5),
  comment text,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, assessment_id)
);

create table if not exists public.altfragen_access_requests (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_email text not null,
  display_name text not null,
  study_year integer not null check (study_year between 1 and 6),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.online_presence (
  session_id text primary key,
  path text not null default '/',
  user_agent text,
  last_seen_at timestamptz not null default now()
);

alter table public.summary_downloads add column if not exists file_path text;
alter table public.summary_downloads alter column file_data drop not null;

insert into storage.buckets (id, name, public, file_size_limit)
values ('summary-downloads', 'summary-downloads', true, 314572800)
on conflict (id) do update
set public = true,
    file_size_limit = 314572800;

create index if not exists user_progress_assessment_idx on public.user_progress(assessment_id);
create index if not exists user_progress_updated_idx on public.user_progress(updated_at desc);
create index if not exists summary_downloads_semester_block_idx on public.summary_downloads(semester, block_id);
create index if not exists summary_downloads_updated_idx on public.summary_downloads(updated_at desc);
create index if not exists assessment_block_recommendations_semester_block_idx on public.assessment_block_recommendations(semester, block_id);
create index if not exists assessment_reviews_assessment_idx on public.assessment_reviews(assessment_id);
create index if not exists assessment_reviews_updated_idx on public.assessment_reviews(updated_at desc);
create index if not exists altfragen_access_requests_status_idx on public.altfragen_access_requests(status, updated_at desc);
create index if not exists altfragen_access_requests_user_idx on public.altfragen_access_requests(user_id);
create index if not exists online_presence_last_seen_idx on public.online_presence(last_seen_at desc);

create or replace function public.is_admin(check_user uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = check_user
      and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data->>'name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin(auth.uid()) then
    if tg_op = 'INSERT' then
      new.role := 'student';
    else
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role_insert on public.profiles;
create trigger protect_profile_role_insert
before insert on public.profiles
for each row execute function public.protect_profile_role();

drop trigger if exists protect_profile_role_update on public.profiles;
create trigger protect_profile_role_update
before update on public.profiles
for each row execute function public.protect_profile_role();

alter table public.profiles enable row level security;
alter table public.user_progress enable row level security;
alter table public.summary_downloads enable row level security;
alter table public.assessment_block_recommendations enable row level security;
alter table public.assessment_reviews enable row level security;
alter table public.altfragen_access_requests enable row level security;
alter table public.online_presence enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (id = auth.uid());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles
for update
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "user_progress_select_own_or_admin" on public.user_progress;
create policy "user_progress_select_own_or_admin"
on public.user_progress
for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_progress_insert_own" on public.user_progress;
create policy "user_progress_insert_own"
on public.user_progress
for insert
with check (user_id = auth.uid());

drop policy if exists "user_progress_update_own_or_admin" on public.user_progress;
create policy "user_progress_update_own_or_admin"
on public.user_progress
for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_progress_delete_own_or_admin" on public.user_progress;
create policy "user_progress_delete_own_or_admin"
on public.user_progress
for delete
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "summary_downloads_select_public" on public.summary_downloads;
create policy "summary_downloads_select_public"
on public.summary_downloads
for select
using (true);

drop policy if exists "summary_downloads_insert_admin" on public.summary_downloads;
create policy "summary_downloads_insert_admin"
on public.summary_downloads
for insert
with check (public.is_admin());

drop policy if exists "summary_downloads_update_admin" on public.summary_downloads;
create policy "summary_downloads_update_admin"
on public.summary_downloads
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "summary_downloads_delete_admin" on public.summary_downloads;
create policy "summary_downloads_delete_admin"
on public.summary_downloads
for delete
using (public.is_admin());

drop policy if exists "summary_storage_select_public" on storage.objects;
create policy "summary_storage_select_public"
on storage.objects
for select
using (bucket_id = 'summary-downloads');

drop policy if exists "summary_storage_insert_admin" on storage.objects;
create policy "summary_storage_insert_admin"
on storage.objects
for insert
with check (bucket_id = 'summary-downloads' and public.is_admin());

drop policy if exists "summary_storage_update_admin" on storage.objects;
create policy "summary_storage_update_admin"
on storage.objects
for update
using (bucket_id = 'summary-downloads' and public.is_admin())
with check (bucket_id = 'summary-downloads' and public.is_admin());

drop policy if exists "summary_storage_delete_admin" on storage.objects;
create policy "summary_storage_delete_admin"
on storage.objects
for delete
using (bucket_id = 'summary-downloads' and public.is_admin());

drop policy if exists "assessment_block_recommendations_select_public" on public.assessment_block_recommendations;
create policy "assessment_block_recommendations_select_public"
on public.assessment_block_recommendations
for select
using (true);

drop policy if exists "assessment_block_recommendations_insert_admin" on public.assessment_block_recommendations;
create policy "assessment_block_recommendations_insert_admin"
on public.assessment_block_recommendations
for insert
with check (public.is_admin());

drop policy if exists "assessment_block_recommendations_update_admin" on public.assessment_block_recommendations;
create policy "assessment_block_recommendations_update_admin"
on public.assessment_block_recommendations
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "assessment_block_recommendations_delete_admin" on public.assessment_block_recommendations;
create policy "assessment_block_recommendations_delete_admin"
on public.assessment_block_recommendations
for delete
using (public.is_admin());

drop policy if exists "assessment_reviews_select_public_approved_or_admin" on public.assessment_reviews;
create policy "assessment_reviews_select_public_approved_or_admin"
on public.assessment_reviews
for select
using (approved = true or user_id = auth.uid() or public.is_admin());

drop policy if exists "assessment_reviews_insert_own" on public.assessment_reviews;
create policy "assessment_reviews_insert_own"
on public.assessment_reviews
for insert
with check (user_id = auth.uid() and approved = false);

drop policy if exists "assessment_reviews_update_own_unapproved" on public.assessment_reviews;
create policy "assessment_reviews_update_own_unapproved"
on public.assessment_reviews
for update
using (user_id = auth.uid())
with check (user_id = auth.uid() and approved = false);

drop policy if exists "assessment_reviews_update_admin" on public.assessment_reviews;
create policy "assessment_reviews_update_admin"
on public.assessment_reviews
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "assessment_reviews_delete_admin" on public.assessment_reviews;
create policy "assessment_reviews_delete_admin"
on public.assessment_reviews
for delete
using (public.is_admin());

drop policy if exists "altfragen_access_requests_select_own_or_admin" on public.altfragen_access_requests;
create policy "altfragen_access_requests_select_own_or_admin"
on public.altfragen_access_requests
for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "altfragen_access_requests_insert_own" on public.altfragen_access_requests;
create policy "altfragen_access_requests_insert_own"
on public.altfragen_access_requests
for insert
with check (user_id = auth.uid() and id = auth.uid()::text and status = 'pending');

drop policy if exists "altfragen_access_requests_update_own_pending_or_admin" on public.altfragen_access_requests;
create policy "altfragen_access_requests_update_own_pending_or_admin"
on public.altfragen_access_requests
for update
using (user_id = auth.uid() or public.is_admin())
with check ((user_id = auth.uid() and id = auth.uid()::text and status = 'pending') or public.is_admin());

drop policy if exists "altfragen_access_requests_delete_admin" on public.altfragen_access_requests;
create policy "altfragen_access_requests_delete_admin"
on public.altfragen_access_requests
for delete
using (public.is_admin());

drop policy if exists "online_presence_select_public" on public.online_presence;
create policy "online_presence_select_public"
on public.online_presence
for select
using (true);

drop policy if exists "online_presence_insert_public" on public.online_presence;
create policy "online_presence_insert_public"
on public.online_presence
for insert
with check (true);

drop policy if exists "online_presence_update_public" on public.online_presence;
create policy "online_presence_update_public"
on public.online_presence
for update
using (true)
with check (true);

drop policy if exists "online_presence_delete_public" on public.online_presence;
create policy "online_presence_delete_public"
on public.online_presence
for delete
using (true);

-- After creating your own account, promote yourself once:
-- update public.profiles set role = 'admin' where email = 'your-email@example.com';
