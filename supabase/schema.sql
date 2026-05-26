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
  file_data text not null,
  download_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_progress_assessment_idx on public.user_progress(assessment_id);
create index if not exists user_progress_updated_idx on public.user_progress(updated_at desc);
create index if not exists summary_downloads_semester_block_idx on public.summary_downloads(semester, block_id);
create index if not exists summary_downloads_updated_idx on public.summary_downloads(updated_at desc);

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

-- After creating your own account, promote yourself once:
-- update public.profiles set role = 'admin' where email = 'your-email@example.com';
