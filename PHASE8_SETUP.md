# Phase 8 — course enrollment foundation

## Current state

The public website and student/teacher Auth remain. `enroll.html` uses the existing
Supabase browser client and publishable configuration, without privileged credentials.
The new migration is prepared and locally validated, NOT applied to hosted Supabase.
Payments remain INACTIVE. Both Edge Function scaffolds return HTTP 503 and write nothing.
No gateway credentials are needed or requested in Phase 8.

## Approved catalogue

| Course | Tuition INR |
|---|---:|
| ADCA | 6500 |
| DCTT | 7200 |
| DCA | 4000 |
| DFA | 3500 |
| CCC | 2500 |
| C+ | 2500 |
| Typing Master (Hindi & English) | 3000 |
| Prime Tally | 3500 |
| Tally ERP 0.9 | 3500 |

All fees are integer paise in SQL. Admission fee is 0; discount is 0. There are no
automatic taxes, gateway charges, convenience fees, or surcharges. Preserve the
client's exact course names; duration and eligibility remain unverified.

## Database installation

1. Review `supabase/migrations/202610020002_course_enrollment.sql` in the correct
   authorized project, AFTER the already-applied profiles migration. Do NOT rerun
   the profiles migration. This migration is transactional and intentionally not
   destructive/idempotent: existing conflicting tables abort instead of replacing them.
2. Apply the new migration once through the authorized owner's SQL Editor.
3. Verify the nine `courses` and `course_fees` rows, six RLS-enabled/forced tables,
   policies, and RPC privileges. No actual enrollments/users/payments are seeded.
4. Reload the website. Until installation, enrollment shows an explicit setup
   message. Public course overviews and existing Auth continue working.
5. Use the existing Phase 7 real-account checklist first. Then use two real students
   and an approved teacher. Submit genuine admission details for a student.
6. Run `supabase/tests/enrollment_rls.sql` in owner SQL Editor. It uses real existing
   data and rolls back all trial records. Sequences may consume numbers on rollback;
   gaps are normal. Do not invent data to satisfy prerequisites.

## Workflow and ownership

Course selection is required. Registration/login remembers ONLY the course code in
sessionStorage; it is never trusted as authorization. A verified student may call
`kbc_start_application(course_uuid)`. SQL generates a unique application number,
sets the caller as owner, checks the actual profile role, and serializes duplicate
starts. A student may enroll in different courses. Same-course active applications
return the existing record; repeat enrollment requires authorized cancellation
or a future batch model, not frontend duplication.

`kbc_submit_application` validates genuine name/phone/address/qualification and
captures the current database fee in a locked immutable enrollment snapshot.
Application becomes `payment_pending`, never `enrolled`. If the fee is missing,
details are saved and status stays `application_started`; the UI states
“Fee information will be updated by the institute.” Continue after fee configuration.
Submitted fee snapshots are unaffected by later catalogue updates.

Students have SELECT-only grants on own enrollments, applications and payments.
They cannot write fees, owner IDs, status, receipts or payment references directly.
Teacher roles cannot read those financial/admission tables, including former
student records. `kbc_assigned_students()` returns only student name, course and
application number for explicit assignments to enrolled students. No assignment
is created automatically. Approved admin profiles can manage catalogue/fees and
assignments under RLS; there is no admin dashboard or public role-assignment API.
Use owner SQL Editor for configuration now. Public price text in courses.html must
be reviewed alongside any future fee changes to avoid stale marketing prices.

## Future payment adapter contract — NOT implemented/activated

The inactive endpoints are a safe integration boundary, not a functioning gateway.
Configuration alone cannot activate a missing provider adapter. A later phase must:

1. Select the institute's gateway and obtain authorization to enable payments.
2. Store provider credentials and privileged Supabase access ONLY in hosted Edge
   Function secrets. Never put values in HTML, browser JS, GitHub, URL parameters,
   build variables that become public assets, logs, or the GitHub Pages repository.
3. Order endpoint verifies the user's JWT with Supabase, email confirmation, role
   and enrollment ownership. It reads amount/currency from the frozen enrollment;
   it accepts only enrollment ID, never client price, owner or status.
4. Authenticate the provider order API and use a durable idempotency key per
   enrollment. Reconcile retries/crashes so an external order is not orphaned or
   created twice. Persist only the reconciled order using the server-only
   `kbc_record_gateway_order` RPC. Its arguments must come from verified identity
   and provider response. Enforce method, exact origin CORS, rate limits and input bounds.
5. Webhook endpoint verifies the provider signature over the untouched raw body,
   uses constant-time comparisons, validates event type/capture state, and checks
   gateway payment/order identifiers, exact paise amount and INR currency against
   stored order AND provider API. Enforce timestamp/replay rules and event-ID dedup.
6. Only after all checks call server-only `kbc_verify_gateway_payment`. SQL locks
   the enrollment/payment consistently, rejects mismatches, handles retries
   idempotently, assigns receipt, and commits verified payment + enrollment atomically.
7. Implement genuine failure/retry, reconciliation, refunds and monitoring with
   explicit server-side state transitions; Phase 8 does not handle refund accounting.
8. Test signatures, tampered prices/IDs, duplicate/concurrent webhooks, lost callbacks,
   revoked users, provider timeouts and amount/currency mismatches in the gateway's
   authorized sandbox. Do not create fake successful records in production.

Frontend returns/query strings/localStorage never create verified payments. Receipts
are displayed only from RLS-protected verified payment rows. No card, UPI PIN or
payment credential is collected. Current “Proceed to Payment” explicitly explains
that online payments are inactive, and changes no status.

## Local validation

`node --test tests/auth-rules.test.cjs`; `node --check js/enrollment.js`;
`node --check js/teacher-enrollments.js`; `git diff --check`.

`tests/enrollment-schema.cjs` executes both migrations using temporary PGlite
PostgreSQL with EMPTY Auth tables. Install PGlite outside the repository, set
`KBC_PGLITE_MODULE` to that module path. Install jsdom in the same temporary directory
and set `KBC_JSDOM_MODULE` to its module path. Run `node tests/enrollment-schema.cjs`.
This tests approved prices, DDL, RLS flags, grants and UI summaries using that actual
local catalogue. The UI adapter is mocked with NO authenticated account; it does
not call the hosted project. It creates no mock students,
enrollments or payments. It is NOT live hosted Auth/RLS acceptance testing.

GitHub Pages serves only static assets; Edge Functions must be hosted separately
on Supabase in a future authorized integration. No workflow or deployment is added.
