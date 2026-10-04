-- Run in SQL Editor as the authorized owner AFTER migration and real accounts.
-- Requires at least two actual students and one approved teacher. Creates no users.
-- Tests run inside a transaction and roll back all profile changes.
begin;
do $$
declare
  students uuid[];
  teacher uuid;
  touched integer;
  visible integer;
begin
  select array_agg(id) into students from
    (select id from public.profiles where role = 'student' order by created_at limit 2) s;
  select id into teacher from public.profiles where role = 'teacher' order by created_at limit 1;
  if coalesce(array_length(students, 1), 0) < 2 or teacher is null then
    raise exception 'Create two real student accounts and approve one real teacher before testing';
  end if;

  perform set_config('request.jwt.claim.sub', students[1]::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', students[1], 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into visible from public.profiles;
  if visible <> 1 then raise exception 'FAIL: student must see exactly their own profile'; end if;
  select count(*) into visible from public.profiles where id in (students[2], teacher);
  if visible <> 0 then raise exception 'FAIL: cross-user profile read'; end if;
  update public.profiles set full_name = full_name where id = students[1];
  get diagnostics touched = row_count;
  if touched <> 1 then raise exception 'FAIL: own-profile update denied'; end if;
  update public.profiles set full_name = 'Forbidden change' where id = students[2];
  get diagnostics touched = row_count;
  if touched <> 0 then raise exception 'FAIL: cross-user profile update'; end if;
  begin
    update public.profiles set role = 'admin' where id = students[1];
    raise exception 'FAIL: student can change role';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set email = 'forbidden@example.com' where id = students[1];
    raise exception 'FAIL: client can change Auth email copy';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.profiles (id, role) values (students[1], 'teacher');
    raise exception 'FAIL: client can insert profiles';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', teacher::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', teacher, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into visible from public.profiles;
  if visible <> 1 then raise exception 'FAIL: teacher must see only their own profile'; end if;
  select count(*) into visible from public.profiles where id = any(students);
  if visible <> 0 then raise exception 'FAIL: teacher can read private student profiles'; end if;
  update public.profiles set full_name = 'Forbidden change' where id = students[1];
  get diagnostics touched = row_count;
  if touched <> 0 then raise exception 'FAIL: teacher can update student'; end if;
  begin
    update public.profiles set role = 'admin' where id = teacher;
    raise exception 'FAIL: teacher can promote themselves';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';
  begin
    perform id from public.profiles;
    raise exception 'FAIL: anonymous profile read';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  raise notice 'PASS: own-row access, cross-user denial, role/email write denial, insert denial, anonymous denial';
end;
$$;
rollback;
