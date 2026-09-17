-- Profile years and admin-managed Close Circle. Safe to re-run.
begin;
alter table public.profiles add column if not exists study_year integer check (study_year between 1 and 6);
alter table public.profiles add column if not exists close_circle boolean not null default false;

-- Membership is never taken from user-editable auth metadata.
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin(auth.uid()) then
    if tg_op = 'INSERT' then
      new.role := 'student';
      new.close_circle := false;
    else
      new.role := old.role;
      new.close_circle := old.close_circle;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.sync_profile_study_year()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set study_year = case
    when new.raw_user_meta_data #>> '{atlas_study_settings,studyYear}' ~ '^year[1-6]$'
    then right(new.raw_user_meta_data #>> '{atlas_study_settings,studyYear}', 1)::integer
    else null end
  where id = new.id;
  return new;
end;
$$;
drop trigger if exists sync_profile_study_year on auth.users;
create trigger sync_profile_study_year after insert or update of raw_user_meta_data on auth.users
for each row execute function public.sync_profile_study_year();

update public.profiles p set study_year = case
  when u.raw_user_meta_data #>> '{atlas_study_settings,studyYear}' ~ '^year[1-6]$'
  then right(u.raw_user_meta_data #>> '{atlas_study_settings,studyYear}', 1)::integer
  else null end
from auth.users u where u.id = p.id;
commit;
