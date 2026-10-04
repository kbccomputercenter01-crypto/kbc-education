begin;
create table public.razorpay_order_claims(enrollment_id uuid primary key references public.enrollments(id),created_at timestamptz not null default now());
alter table public.razorpay_order_claims enable row level security;
alter table public.razorpay_order_claims force row level security;
revoke all on public.razorpay_order_claims from public,anon,authenticated;
-- A lost external response requires reconciliation, never blind order creation retry.
create function public.kbc_claim_razorpay_order(p_student uuid,p_enrollment uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare e public.enrollments; touched integer;
begin
 select * into e from public.enrollments where id=p_enrollment and student_id=p_student for update;
 if not found or e.status not in ('payment_pending','payment_processing') or e.amount_paise is null then raise exception 'Enrollment unavailable'; end if;
 if not exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=p_student and p.role='student' and u.email_confirmed_at is not null) then raise exception 'Verified student required'; end if;
 if exists(select 1 from public.payments where enrollment_id=e.id and status in ('pending','processing','verified')) then return false; end if;
 insert into public.razorpay_order_claims(enrollment_id) values(e.id) on conflict do nothing;
 get diagnostics touched=row_count; return touched=1;
end $$;
revoke all on function public.kbc_claim_razorpay_order(uuid,uuid) from public,anon,authenticated;
grant execute on function public.kbc_claim_razorpay_order(uuid,uuid) to service_role;
commit;
