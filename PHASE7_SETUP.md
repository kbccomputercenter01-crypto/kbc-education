# Phase 7 — Student and teacher authentication

This is a real Supabase Auth frontend, not a demo login. It uses only the existing
project URL/publishable key. Existing Phase 6 files are retained. No commit,
push or deployment is performed automatically.

## Required manual Supabase setup

The project currently has signup enabled and email confirmation enabled. A
read-only schema probe returned PGRST205: public.profiles does not yet exist.
The owner must apply the migration before registration/login can proceed.
The frontend readiness check deliberately blocks signup until this is done.

1. Open the KBC Computer Education project in the Supabase dashboard.
2. In SQL Editor, review and run
   `supabase/migrations/202610020001_profiles_auth.sql` as the authorized owner.
   It creates profiles, triggers, RLS, column privileges and a harmless readiness
   marker. It backfills ONLY existing Auth users as students. It creates no users
   or sample records. If profiles already exists, the transaction fails rather
   than overwriting it; stop and review that schema first. Apply this file once.
3. In Authentication > URL Configuration, set Site URL to
   `https://kbccomputercenter01-crypto.github.io/kbc-education/`.
   Add these exact Redirect URLs:
   - `https://kbccomputercenter01-crypto.github.io/kbc-education/student-login.html`
   - `https://kbccomputercenter01-crypto.github.io/kbc-education/reset-password.html`
   - `http://localhost:8000/student-login.html`
   - `http://localhost:8000/reset-password.html`
   Use the same hostname/port throughout local testing. Do not add broad wildcards.
4. In Authentication > Providers > Email, keep email signup and Confirm email
   enabled. Configure the Auth password policy to match the UI's minimum 12
   characters and uppercase/lowercase/numeric requirements. Review rate limits
   and email delivery; use an institute-controlled SMTP provider for real student
   mail if the default mail service is insufficient. Keep SMTP credentials only
   in Supabase's dashboard, never in this repository.
5. Keep Supabase's default confirmation/recovery email templates that redirect
   through the configured RedirectTo URL, or review any custom templates for
   compatibility. The site uses Supabase's browser redirect/session handling.

No secret/service-role key, database password, server SDK or GitHub Actions
workflow is needed in the frontend. The publishable key cannot apply SQL,
change Auth settings, or approve teachers. Do those actions inside your existing
authorized Supabase dashboard session.

## Teacher approval — owner-only operation

No public teacher signup exists. Use Authentication > Users to create or invite
an actual authorized teacher. Verify the email and identity through KBC's normal
process. For an invited user, complete the email invitation and then use Forgot
Password to choose a password using the recovery flow if necessary.

Every new Auth user starts as student regardless of user metadata. After creating
the teacher, copy their actual Auth UUID and run this in the owner's SQL Editor,
replacing the UUID. This is NOT a browser API and is never exposed as an RPC:

```sql
update public.profiles
set role = 'teacher'
where id = 'REPLACE_WITH_ACTUAL_TEACHER_AUTH_UUID'::uuid
returning id, role;
```

Check that exactly the intended user is returned. Do not approve roles from
unverified names or self-submitted metadata. Do not share passwords in chat or
commit them. Admin is reserved for a later phase; no admin pages are implemented.

## Security model

- Supabase owns password storage, verification, recovery and sessions.
- The Auth insert trigger creates profiles and always assigns student.
- Profile IDs reference real auth.users IDs. Email is synchronized from Auth.
- RLS allows authenticated users to select only their own profile.
- Students/teachers can update only their own full_name and phone.
- Role, ID, email, avatar and created_at are not client-writable. No client
  insert/delete grants or policies exist. An update trigger adds defense in depth.
- Trigger functions use a fixed empty search_path and cannot be called by
  public/anon/authenticated through RPC.
- Teachers have no access to private student rows. No assignment table is needed
  until that feature is implemented. No unrelated tables/policies are changed.
- Page guards first read the SDK session, verify it through getUser, then fetch
  the own profile under RLS. User metadata is never used as authorization.
- Missing profiles, network failures and wrong roles keep dashboard data hidden.
- Guards recheck on Auth events, focus, visibility and restored history pages.
- Local-device logout clears the persistent session and propagates to other tabs.
  As with Supabase JWTs generally, issued access tokens remain valid until expiry;
  do not claim instant server-side revocation of an already issued token.
- Static dashboard HTML shells are publicly downloadable on GitHub Pages. They
  contain no private records. Database policies, not HTML redirects, protect data.
- Password reset is enabled only after the SDK verifies a PASSWORD_RECOVERY
  event. An ordinary URL query or logged-in session alone cannot enable the form.
- Auth forms default to disabled fieldsets and POST, preventing password-in-URL
  submission if JavaScript fails. Passwords are never logged or written to tables.
- Login/registration/recovery/dashboard pages have noindex metadata and are not
  added to the public sitemap. All application links use the repository base path.

## Live acceptance checklist (real accounts required)

Use two real student accounts owned by authorized testers and one actual approved
teacher. Accounts must have accessible inboxes. Do not invent users or treat
mock/unit tests as live authentication verification.

1. Student Registration: verify required fields and password confirmation;
   submit valid details, receive confirmation email, verify email, and sign in.
2. Confirm a corresponding own profile exists with role student. Inspect the
   trigger to confirm a supplied metadata role would be ignored.
3. Reload the student dashboard and open another tab: session persists and only
   the real student's profile appears. Edit own name/phone and reload.
4. Visit teacher-dashboard.html as student: redirect through Student Login back
   to the student dashboard. No teacher workspace/data should be revealed.
5. Logout, use browser Back and reload: protected content stays hidden and login
   is required. Open both dashboards without a session: both must redirect.
6. Login as the approved teacher; verify the teacher dashboard and own profile.
   Visit the student dashboard: student-only content must remain hidden.
7. Test a deliberately incorrect password for your own real account; verify a
   clear error and no session. Also check expired/revoked-session handling.
8. Request recovery for a real account, open the email link, choose a new password,
   then sign in with it. Reused/expired links must not enable the reset form.
9. Run `supabase/tests/profiles_rls.sql` in SQL Editor. It uses existing real
   account IDs, tests own-row/cross-row access, role/email write denial, profile
   insert denial and anonymous denial, then rolls back every profile update.
   Missing real accounts abort the test. Save its PASS result for the audit.
10. Review Database Security Advisor and the policies/grants on public.profiles.

Before steps 1/6/8, the migration, exact redirect URLs and email delivery must
be configured. Before public production usage, all live acceptance steps must
pass. No claim of fully verified live authentication is made before that.

## Local checks

Run `node --test tests/auth-rules.test.cjs` for pure validation/route unit tests,
`node --check js/auth.js` and `git diff --check`. Unit checks do not authenticate
or create users. Browser checks can verify public forms and unauthenticated
guards without credentials. Authenticated dashboards, persistence, cross-role
guards and RLS require the real-account acceptance steps above.

Dashboard sections without backend implementations show Coming Soon, not fake
records. Public notices remain a link to the existing notice board. Payment,
attendance backend, certificates, admin UI and other future features are absent.
