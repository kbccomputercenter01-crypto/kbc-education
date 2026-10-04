# Phase 8 review — prepared locally, not deployed

## Implemented

- Nine exact approved courses/fees; admission fee 0, discount 0, no automatic extras.
- Course catalogue keeps the site's visual system; DTC becomes approved DCA and
  generic Tally becomes Prime Tally, with C+ and Tally ERP 0.9 added.
- `Enroll Now` entry points and `enroll.html`: course selection, login/register
  continuation, admission form, database fee summary, inactive payment guidance.
- Server-generated KBC-year-sequence application numbers and one active application
  per student/course; student accounts can apply for multiple different courses.
- Database-owned fee snapshots/statuses. No frontend payment-success path.
- Own-record dashboard sections: My Enrollments, My Courses, Payment History,
  Receipts and Admission Details. No demo rows or simulated successful payments.
- Teachers get only the assigned-enrolled-student projection, no financial access.
- Prepared transactional migration plus inactive HTTP-503 order/webhook scaffolds.

## Exact files changed in THIS phase

Modified existing local files:

1. `index.html` — Enroll Now CTA; approved course label/link correction.
2. `about.html` — approved course label/link correction.
3. `courses.html` — nine-course catalogue, exact fees and enrollment links.
4. `admission.html` — enrollment CTA and approved enquiry course options.
5. `student-dashboard.html` — own-record sections and enrollment script/CSS.
6. `teacher-dashboard.html` — explicitly assigned students section/script.
7. `js/auth.js` — student-only continuation for allowlisted selected course codes.

Added:

8. `enroll.html`
9. `css/enrollment.css`
10. `js/enrollment.js`
11. `js/teacher-enrollments.js`
12. `supabase/migrations/202610020002_course_enrollment.sql`
13. `supabase/functions/create-payment-order/index.ts`
14. `supabase/functions/payment-webhook/index.ts`
15. `supabase/tests/enrollment_rls.sql`
16. `tests/enrollment-schema.cjs`
17. `PHASE8_SETUP.md`
18. `PHASE8_REVIEW.md`

Phase 6/7 already had uncommitted modifications/untracked files when Phase 8 began.
`git diff --stat` compares against HEAD and includes that earlier work; untracked
files (including existing Phase 7 dashboards/auth.js) are absent from its stats.
Do not describe that aggregate diff as Phase 8 alone, or commit everything blindly.

## Database/RLS review

New migration: `202610020002_course_enrollment.sql`, after the already-applied
profiles migration. It adds six tables and two sequences, seeds only nine approved
course/fee rows, and does not modify existing profiles policies/Auth triggers.
No DROP/TRUNCATE, fake users, enrollment seeds, or payment seeds.

| Policies | Purpose |
|---|---|
| kbc_public_courses / kbc_public_fees | Public active catalogue/fee reads |
| kbc_admin_courses / kbc_admin_fees | Verified admin role only for configuration |
| kbc_own_enrollments | Student's own records; authorized admin read |
| kbc_own_applications | Student's own records; authorized admin read |
| kbc_own_payments | Student's own records; authorized admin read |
| kbc_assignment_read / kbc_assignment_admin | Own teacher assignments/admin management |

All six tables have enabled AND forced RLS. Students have no direct writes to
enrollments/applications/payments; narrow authenticated RPCs own the workflow.
Teachers have no direct access to private enrollment/application/payment rows.
The teacher RPC returns only assigned enrolled students' name/course/application number.
Payment-order recording and verification RPCs are executable only by the server role,
not anonymous/authenticated browser roles. Role names in SQL are permissions, not keys.

## Executed tests

- Local PostgreSQL/PGlite: both migrations execute successfully with empty Auth/users.
- Exact nine prices, 0 admission, 0 discount: pass.
- RLS enabled/forced for six tables; SELECT-only private table grants: pass.
- Anonymous private-payment access denied; no-identity application RPC denied: pass.
- Student/no-admin fee update affects zero rows; fee insert rejected: pass.
- Server payment RPC execution denied to anon/authenticated, allowed to server role: pass.
- Local jsdom summaries for all nine approved DB prices, selected course persistence,
  missing fee text, hidden payment action and signed-out clearing: pass.
  These are isolated tests using the local approved catalogue, NOT live user sessions.
- Existing Auth unit tests: 4/4 pass. New/modified JS and both inactive TS functions
  pass Node syntax checks.
- Browser layout: 66 checks across 11 pages at 320/375/425/768/1024/1440px,
  plus 12 final rechecks for courses/enroll after exact-name updates: no overflow.
- Anonymous student/teacher dashboards redirect to their respective login pages.
- 16 HTML pages: 722 local link/asset/anchor references, no missing targets/duplicate IDs.
- Browser warning/error log check: none captured during reviewed public/anonymous pages.
- Secret-pattern scan of 16 implementation/test files: no credential values found.
- `git diff --check`: pass; Git reports only existing LF/CRLF conversion warnings.

## Pending live acceptance — do not claim pass

- Apply ONLY the new migration to the hosted project via authorized owner SQL Editor.
  Enrollment currently displays the expected setup-required state because it is absent.
- With real accounts, test new application creation, concurrent duplicate starts,
  admission submission, fee snapshots and payment-pending records.
- Run `supabase/tests/enrollment_rls.sql` against real account/data prerequisites.
  This is transactional; no production payment-success record is fabricated.
- Live cross-student/teacher ownership and existing login/logout/session tests remain
  pending; local policy/grant checks are not a substitute for those tests.
- Authenticated dashboard rendering/long real records and form interactions need
  final browser verification with the actual accounts; current width checks cover
  public/anonymous states only.
- Gateway-specific order/signature/webhook reconciliation implementation is deliberately
  deferred. No gateway credentials requested/stored; no function or site deployed.

## Preservation

Existing Supabase URL/publishable configuration, shared Supabase client, original
profiles migration/RLS, authentication validation and public enquiry email-draft
behavior were not altered in this phase. A small auth.js redirect addition preserves
course selection through existing login/register. No admin dashboard, payment gateway
activation, account creation, commit, push, history rewrite or deployment performed.
