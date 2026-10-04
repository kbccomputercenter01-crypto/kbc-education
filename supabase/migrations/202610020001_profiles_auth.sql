-- Run once using the authorized project's SQL Editor. No credentials required here.
-- If public.profiles already exists, STOP and review its schema/policies instead
-- of replacing it. This migration is transactional and intentionally fails closed.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 80),
  email text not null default '' check (char_length(email) <= 254),
  phone text not null default '' check (phone = '' or phone ~ '^[0-9]{10,15}$'),
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index kbc_profiles_role_idx on public.profiles(role);
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create policy kbc_profile_read_self on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy kbc_profile_update_self on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id and role in ('student', 'teacher'))
  with check ((select auth.uid()) = id and role in ('student', 'teacher'));

-- Timestamp/immutable-column defense in addition to column privileges.
create function public.kbc_profile_before_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') and
     (new.id is distinct from old.id or new.email is distinct from old.email or
      new.role is distinct from old.role or new.created_at is distinct from old.created_at or
      new.avatar_url is distinct from old.avatar_url) then
    raise exception 'Protected profile fields cannot be changed by a client';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.kbc_profile_before_update() from public, anon, authenticated;
create trigger kbc_profile_before_update before update on public.profiles
  for each row execute function public.kbc_profile_before_update();

-- Never trust raw_user_meta_data for authorization. EVERY new user starts student.
create function public.kbc_create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare mobile text;
begin
  mobile := regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g');
  if mobile !~ '^[0-9]{10,15}$' then mobile := ''; end if;
  insert into public.profiles (id, full_name, email, phone, role)
  values (new.id, left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 80),
          coalesce(new.email, ''), mobile, 'student');
  return new;
end;
$$;
revoke all on function public.kbc_create_profile() from public, anon, authenticated;
create trigger kbc_auth_user_created after insert on auth.users
  for each row execute function public.kbc_create_profile();

-- Email belongs to Auth; keep its display copy synchronized without client writes.
create function public.kbc_sync_profile_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;
revoke all on function public.kbc_sync_profile_email() from public, anon, authenticated;
create trigger kbc_auth_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.kbc_sync_profile_email();

-- Backfill only EXISTING real Auth users. No fake users and no inferred elevation.
insert into public.profiles (id, full_name, email, phone, role)
select id, left(trim(coalesce(raw_user_meta_data ->> 'full_name', '')), 80),
       coalesce(email, ''),
       case when regexp_replace(coalesce(raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g') ~ '^[0-9]{10,15}$'
            then regexp_replace(coalesce(raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g') else '' end,
       'student'
from auth.users;

-- Harmless readiness marker; no privileged query, credentials, or private data.
create function public.kbc_auth_ready()
returns boolean language sql stable set search_path = '' as $$ select true $$;
revoke all on function public.kbc_auth_ready() from public;
grant execute on function public.kbc_auth_ready() to anon, authenticated;

commit;
