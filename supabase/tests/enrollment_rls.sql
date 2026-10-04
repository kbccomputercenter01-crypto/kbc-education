-- Owner SQL Editor, AFTER migration and real accounts/admission details exist.
-- Uses only existing real records and rolls back. Does not create Auth users/payments.
-- At least two actual students, one teacher, and one student's genuine submitted
-- admission application are required. If absent, STOP; do not invent details.
begin;
do $$
declare
 a uuid; b uuid; teacher uuid; selected_course uuid;
 existing_app public.admission_applications; first_app public.enrollments; again public.enrollments;
 visible integer; touched integer;
begin
 select appdata.* into existing_app from public.admission_applications appdata
 join public.profiles owner_profile on owner_profile.id=appdata.student_id
 where owner_profile.role='student' limit 1;
 if not found then raise exception 'Pending: a real student must submit genuine admission details first'; end if;
 a:=existing_app.student_id;
 select id into b from public.profiles where role='student' and id<>a limit 1;
 select id into teacher from public.profiles where role='teacher' limit 1;
 select c.id into selected_course from public.courses c join public.course_fees f on f.course_id=c.id
 where c.active and not exists(select 1 from public.enrollments e where e.student_id=a and e.course_id=c.id and e.status<>'cancelled') limit 1;
 if b is null or teacher is null or selected_course is null then raise exception 'Pending: second real student, approved teacher, and another available course required'; end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 select * into first_app from public.kbc_start_application(selected_course);
 select * into again from public.kbc_start_application(selected_course);
 if first_app.id<>again.id or first_app.student_id<>a or first_app.status<>'application_started' then raise exception 'FAIL: ownership/duplicate handling'; end if;
 select * into first_app from public.kbc_submit_application(first_app.id,existing_app.full_name,existing_app.phone,existing_app.address,existing_app.qualification);
 if first_app.status<>'payment_pending' or first_app.amount_paise is null then raise exception 'FAIL: fee snapshot/pending state'; end if;
 update public.course_fees set tuition_paise=tuition_paise;
 get diagnostics touched=row_count;
 if touched<>0 then raise exception 'FAIL: student fee write'; end if;
 begin
  update public.enrollments set status='enrolled' where id=first_app.id;
  raise exception 'FAIL: enrollment status write';
 exception when insufficient_privilege then null; end;
 begin
  update public.payments set status='verified';
  raise exception 'FAIL: payment status write';
 exception when insufficient_privilege then null; end;
 if has_function_privilege('authenticated','public.kbc_verify_gateway_payment(text,text,text,bigint,text)','EXECUTE') then raise exception 'FAIL: verification RPC exposed'; end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',b,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 select count(*) into visible from public.enrollments where id=first_app.id;
 if visible<>0 then raise exception 'FAIL: other student enrollment read'; end if;
 select count(*) into visible from public.admission_applications where enrollment_id=first_app.id;
 if visible<>0 then raise exception 'FAIL: other student admission read'; end if;
 select count(*) into visible from public.payments where student_id=a;
 if visible<>0 then raise exception 'FAIL: other student payment read'; end if;
 begin
  perform public.kbc_submit_application(first_app.id,existing_app.full_name,existing_app.phone,existing_app.address,existing_app.qualification);
  raise exception 'FAIL: other student admission write';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',teacher::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',teacher,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 select count(*) into visible from public.payments;
 if visible<>0 then raise exception 'FAIL: teacher payment access'; end if;
 select count(*) into visible from public.enrollments;
 if visible<>0 then raise exception 'FAIL: teacher direct enrollment access'; end if;
 begin
  perform public.kbc_start_application(selected_course);
  raise exception 'FAIL: teacher enrollment creation';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.jwt.claims','{}',true);
 execute 'set local role anon';
 begin
  perform id from public.enrollments;
  raise exception 'FAIL: anonymous enrollment access';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
 raise notice 'PASS: actual-account ownership, duplicate start, fee snapshot, pending state, cross-user denial, payment/status/fee protection, teacher denial';
end $$;
rollback;
