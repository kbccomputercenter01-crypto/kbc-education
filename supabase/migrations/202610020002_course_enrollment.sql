-- Apply once after 202610020001_profiles_auth.sql. Approved catalogue only; no users.
begin;
create sequence public.kbc_application_sequence start 1000;
create sequence public.kbc_receipt_sequence start 1000;
create table public.courses (
 id uuid primary key default gen_random_uuid(), code text unique not null,
 name text not null check (length(name) between 1 and 120), active boolean not null default true,
 created_at timestamptz not null default now()
);
insert into public.courses(code,name) values
 ('adca','ADCA'),('dctt','DCTT'),('dca','DCA'),('dfa','DFA'),('ccc','CCC'),('c-plus','C+'),
 ('typing-master','Typing Master (Hindi & English)'),('prime-tally','Prime Tally'),('tally-erp','Tally ERP 0.9');
create table public.course_fees (
 course_id uuid primary key references public.courses(id),
 tuition_paise bigint not null check(tuition_paise between 1 and 100000000),
 application_paise bigint not null default 0 check(application_paise between 0 and 100000000),
 discount_paise bigint not null default 0 check(discount_paise >= 0),
 currency text not null default 'INR' check(currency = 'INR'),
 updated_at timestamptz not null default now(),
 check(discount_paise < tuition_paise + application_paise)
);
-- Exact institute-approved fees, stored as integer paise; no extra charges.
insert into public.course_fees(course_id,tuition_paise,application_paise,discount_paise)
select c.id,v.paise,0,0 from public.courses c join (values
 ('adca',650000::bigint),('dctt',720000),('dca',400000),('dfa',350000),('ccc',250000),
 ('c-plus',250000),('typing-master',300000),('prime-tally',350000),('tally-erp',350000)
) as v(code,paise) on c.code=v.code;
create table public.enrollments (
 id uuid primary key default gen_random_uuid(),
 application_number text unique not null,
 student_id uuid not null references public.profiles(id),
 course_id uuid not null references public.courses(id),
 status text not null default 'application_started' check(status in
 ('application_started','payment_pending','payment_processing','payment_verified','enrolled','cancelled')),
 tuition_paise bigint, application_paise bigint, discount_paise bigint, amount_paise bigint,
 currency text not null default 'INR' check(currency='INR'),
 created_at timestamptz not null default now(), submitted_at timestamptz, enrolled_at timestamptz,
 unique(id,student_id),
 check ((tuition_paise is null and application_paise is null and discount_paise is null and amount_paise is null)
 or (tuition_paise is not null and application_paise is not null and discount_paise is not null and amount_paise is not null
 and tuition_paise > 0 and application_paise >= 0 and discount_paise >= 0 and amount_paise > 0
 and amount_paise = tuition_paise + application_paise - discount_paise)),
 check(status in ('application_started','cancelled') or amount_paise is not null)
);
create unique index kbc_one_active_enrollment on public.enrollments(student_id,course_id) where status <> 'cancelled';
create index kbc_enrollment_owner on public.enrollments(student_id);
create table public.admission_applications (
 enrollment_id uuid primary key,
 student_id uuid not null,
 full_name text not null check(length(full_name) between 1 and 80),
 phone text not null check(phone ~ '^[0-9]{10,15}$'),
 address text not null check(length(address) between 1 and 500),
 qualification text not null check(length(qualification) between 1 and 120),
 submitted_at timestamptz not null default now(),
 foreign key(enrollment_id,student_id) references public.enrollments(id,student_id)
);
create table public.payments (
 id uuid primary key default gen_random_uuid(), enrollment_id uuid not null, student_id uuid not null,
 gateway text not null check(length(gateway) between 1 and 60),
 order_reference text not null check(length(trim(order_reference)) between 1 and 200), payment_reference text,
 amount_paise bigint not null check(amount_paise > 0), currency text not null check(currency='INR'),
 status text not null default 'pending' check(status in ('pending','processing','verified','failed')),
 receipt_number text unique,
 created_at timestamptz not null default now(), verified_at timestamptz,
 foreign key(enrollment_id,student_id) references public.enrollments(id,student_id),
 unique(gateway,order_reference), unique(gateway,payment_reference),
 check((status='verified' and verified_at is not null and payment_reference is not null and receipt_number is not null)
 or (status<>'verified' and verified_at is null and receipt_number is null))
);
create unique index kbc_one_open_payment on public.payments(enrollment_id) where status in ('pending','processing','verified');
create index kbc_payment_owner on public.payments(student_id);
create table public.teacher_course_assignments (
 teacher_id uuid not null references public.profiles(id), enrollment_id uuid not null references public.enrollments(id),
 primary key(teacher_id,enrollment_id)
);

create function public.kbc_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin')
$$;
revoke all on function public.kbc_is_admin() from public,anon;
grant execute on function public.kbc_is_admin() to authenticated;

alter table public.courses enable row level security;
alter table public.courses force row level security;
alter table public.course_fees enable row level security;
alter table public.course_fees force row level security;
alter table public.enrollments enable row level security;
alter table public.enrollments force row level security;
alter table public.admission_applications enable row level security;
alter table public.admission_applications force row level security;
alter table public.payments enable row level security;
alter table public.payments force row level security;
alter table public.teacher_course_assignments enable row level security;
alter table public.teacher_course_assignments force row level security;
revoke all on public.courses,public.course_fees,public.enrollments,public.admission_applications,public.payments,public.teacher_course_assignments from public,anon,authenticated;
revoke all on sequence public.kbc_application_sequence,public.kbc_receipt_sequence from public,anon,authenticated;
grant select on public.courses,public.course_fees to anon,authenticated;
grant select on public.enrollments,public.admission_applications,public.payments,public.teacher_course_assignments to authenticated;
grant insert,update on public.courses,public.course_fees,public.teacher_course_assignments to authenticated;
create policy kbc_public_courses on public.courses for select to anon,authenticated using(active);
create policy kbc_public_fees on public.course_fees for select to anon,authenticated using(exists(select 1 from public.courses c where c.id=course_id and c.active));
create policy kbc_admin_courses on public.courses for all to authenticated using(public.kbc_is_admin()) with check(public.kbc_is_admin());
create policy kbc_admin_fees on public.course_fees for all to authenticated using(public.kbc_is_admin()) with check(public.kbc_is_admin());
create policy kbc_own_enrollments on public.enrollments for select to authenticated using((student_id=(select auth.uid()) and exists(select 1 from public.profiles where id=auth.uid() and role='student')) or public.kbc_is_admin());
create policy kbc_own_applications on public.admission_applications for select to authenticated using((student_id=(select auth.uid()) and exists(select 1 from public.profiles where id=auth.uid() and role='student')) or public.kbc_is_admin());
create policy kbc_own_payments on public.payments for select to authenticated using((student_id=(select auth.uid()) and exists(select 1 from public.profiles where id=auth.uid() and role='student')) or public.kbc_is_admin());
create policy kbc_assignment_read on public.teacher_course_assignments for select to authenticated using(teacher_id=(select auth.uid()) or public.kbc_is_admin());
create policy kbc_assignment_admin on public.teacher_course_assignments for all to authenticated using(public.kbc_is_admin()) with check(public.kbc_is_admin());

-- Restricted workflow: caller never supplies owner, price, number, or status.
create function public.kbc_start_application(p_course uuid) returns public.enrollments
language plpgsql security definer set search_path='' as $$
declare result public.enrollments; student uuid := auth.uid();
begin
 if not exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=student and p.role='student' and u.email_confirmed_at is not null) then
  raise exception 'Verified student account required' using errcode='42501'; end if;
 if not exists(select 1 from public.courses where id=p_course and active) then raise exception 'Course unavailable'; end if;
 -- Serialize duplicate starts for this account, including concurrent tabs.
 perform 1 from public.profiles where id=student for update;
 select * into result from public.enrollments where student_id=student and course_id=p_course and status<>'cancelled';
 if found then return result; end if;
 insert into public.enrollments(application_number,student_id,course_id)
 values('KBC-'||extract(year from now())::text||'-'||nextval('public.kbc_application_sequence')::text,student,p_course)
 returning * into result;
 return result;
end $$;
revoke all on function public.kbc_start_application(uuid) from public,anon;
grant execute on function public.kbc_start_application(uuid) to authenticated;

create function public.kbc_submit_application(p_enrollment uuid,p_name text,p_phone text,p_address text,p_qualification text)
returns public.enrollments language plpgsql security definer set search_path='' as $$
declare result public.enrollments; fee public.course_fees;
begin
 if not exists(select 1 from public.profiles p join auth.users u on p.id=u.id where p.id=auth.uid() and p.role='student' and u.email_confirmed_at is not null) then raise exception 'Verified student required' using errcode='42501'; end if;
 select * into result from public.enrollments where id=p_enrollment and student_id=auth.uid() for update;
 if not found then raise exception 'Application unavailable' using errcode='42501'; end if;
 if result.status<>'application_started' then return result; end if;
 if not exists(select 1 from public.courses where id=result.course_id and active) then raise exception 'Course unavailable'; end if;
 insert into public.admission_applications(enrollment_id,student_id,full_name,phone,address,qualification)
 values(result.id,result.student_id,trim(p_name),p_phone,trim(p_address),trim(p_qualification))
 on conflict(enrollment_id) do update set full_name=excluded.full_name,phone=excluded.phone,address=excluded.address,qualification=excluded.qualification,submitted_at=now();
 select * into fee from public.course_fees where course_id=result.course_id for share;
 if found then
  update public.enrollments set tuition_paise=fee.tuition_paise,application_paise=fee.application_paise,
   discount_paise=fee.discount_paise,amount_paise=fee.tuition_paise+fee.application_paise-fee.discount_paise,
   submitted_at=now(),status='payment_pending' where id=result.id returning * into result;
 end if;
 return result;
end $$;
revoke all on function public.kbc_submit_application(uuid,text,text,text,text) from public,anon;
grant execute on function public.kbc_submit_application(uuid,text,text,text,text) to authenticated;

-- Server adapter only. Owner must come from a verified JWT, not request body.
create function public.kbc_record_gateway_order(p_student uuid,p_enrollment uuid,p_gateway text,p_order text)
returns public.payments language plpgsql security definer set search_path='' as $$
declare e public.enrollments; result public.payments;
begin
 if not exists(select 1 from public.profiles where id=p_student and role='student') then raise exception 'Student account required'; end if;
 select * into e from public.enrollments where id=p_enrollment and student_id=p_student for update;
 if not found or e.status not in ('payment_pending','payment_processing') or e.amount_paise is null then raise exception 'Enrollment not payable'; end if;
 select * into result from public.payments where enrollment_id=e.id and status in ('pending','processing','verified');
 if found then return result; end if;
 insert into public.payments(enrollment_id,student_id,gateway,order_reference,amount_paise,currency)
 values(e.id,e.student_id,p_gateway,p_order,e.amount_paise,e.currency) returning * into result;
 update public.enrollments set status='payment_processing' where id=e.id;
 return result;
end $$;
revoke all on function public.kbc_record_gateway_order(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.kbc_record_gateway_order(uuid,uuid,text,text) to service_role;

-- Invoke only AFTER signed webhook verification AND provider API reconciliation.
-- Idempotent repeated callbacks; mismatches abort the entire transaction.
create function public.kbc_verify_gateway_payment(p_gateway text,p_order text,p_reference text,p_amount bigint,p_currency text)
returns public.payments language plpgsql security definer set search_path='' as $$
declare result public.payments; e public.enrollments;
begin
 select * into result from public.payments where gateway=p_gateway and order_reference=p_order;
 if not found then raise exception 'Unknown gateway order'; end if;
 select * into e from public.enrollments where id=result.enrollment_id for update;
 select * into result from public.payments where id=result.id for update;
 if p_reference is null or length(trim(p_reference))=0 or p_amount is null or p_currency is null or p_amount<>result.amount_paise or p_currency<>result.currency
 or p_amount<>e.amount_paise then raise exception 'Payment mismatch'; end if;
 if result.status='verified' then
  if result.payment_reference<>p_reference then raise exception 'Reference mismatch'; end if;
  return result;
 end if;
 if result.status not in ('pending','processing') or e.status not in ('payment_pending','payment_processing') then raise exception 'Invalid payment transition'; end if;
 update public.payments set status='verified',payment_reference=p_reference,verified_at=now(),
 receipt_number='KBC-R-'||extract(year from now())::text||'-'||nextval('public.kbc_receipt_sequence')::text
 where id=result.id returning * into result;
 update public.enrollments set status='payment_verified' where id=e.id;
 update public.enrollments set status='enrolled',enrolled_at=now() where id=e.id;
 return result;
end $$;
revoke all on function public.kbc_verify_gateway_payment(text,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.kbc_verify_gateway_payment(text,text,text,bigint,text) to service_role;

-- Teacher projection deliberately excludes fees, applications, and payments.
create function public.kbc_assigned_students()
returns table(application_number text,course_name text,student_name text)
language sql stable security definer set search_path='' as $$
 select e.application_number,c.name,p.full_name from public.teacher_course_assignments a
 join public.enrollments e on e.id=a.enrollment_id join public.courses c on c.id=e.course_id
 join public.profiles p on p.id=e.student_id
 where a.teacher_id=auth.uid() and e.status='enrolled'
 and exists(select 1 from public.profiles t where t.id=auth.uid() and t.role='teacher')
$$;
revoke all on function public.kbc_assigned_students() from public,anon;
grant execute on function public.kbc_assigned_students() to authenticated;
commit;
