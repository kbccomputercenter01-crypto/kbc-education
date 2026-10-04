# Phase 7 implementation and verification

Status: frontend and SQL migration prepared locally. Live authentication and RLS
acceptance testing are PENDING manual Supabase setup and real accounts.
No commit, push, deployment, SQL application, Auth user creation, or role approval
was performed. Existing uncommitted Phase 6 files remain present.

## Implemented

- Real Supabase student registration, student/teacher login, local-device logout,
  email recovery/reset, persistent sessions, token refresh and email verification.
- Reusable server-verified user/own-profile role checks; fail-closed dashboard guards.
- Student and teacher dashboard foundations with actual own-profile rendering and
  name/phone editing. Unimplemented services have honest Coming Soon states.
- Public account links in the footer on all public pages. Signed-in navigation
  derives Dashboard/Logout from the real own profile. No admin/teacher registration UI.
- Transactional profiles migration, self-only RLS, limited update column grants,
  protected role/email fields, fixed-search-path triggers, no metadata role trust.
- No teacher-student assignment table or private student access is granted yet.
- Existing publishable configuration/key unchanged. No privileged credentials.

## Verification actually performed

| Check | Result |
|---|---|
| Node validation/routes unit tests | 4 passed; no accounts or API authentication used |
| All JavaScript syntax checks | Passed |
| HTML, IDs, labels, local asset paths and anchors | Passed across 15 pages |
| Local HTTP endpoints | 33 returned HTTP 200 |
| Auth forms + static dashboard shell layout | 49 checks across 320/375/425/768/1024/1280/1440px; no horizontal overflow |
| Existing 8 public pages | 56 checks at the same widths; no overflow |
| Real unauthenticated dashboard guards | 14 checks (2 routes x 7 widths), all redirected to the correct login |
| Teacher registration | No public teacher registration link or form |
| Reset form without verified recovery event | Hidden; a type=recovery query did not unlock it |
| Empty login submission | Required email validation prevented submission; forms use POST |
| Console | No errors/warnings captured in these normal page/layout/guard checks |
| Project credential-pattern scan + source review | No privileged keys, JWT credentials, database URLs/passwords or private keys found |
| git diff --check | Passed |

Dashboard layout checks used temporary STATIC shells with Auth omitted and no
profile data. They were not simulated sign-ins and are not evidence that login,
role authorization, or live database policies passed. The fixtures were removed.

## Live checks NOT performed

Student registration/email confirmation/login/logout/persistence, teacher login/
logout, authenticated profile updates, cross-role redirects, wrong-password
responses, expired authenticated sessions and the email/password recovery cycle
require real accounts and inboxes after Supabase setup. No fake credentials or
users were created to report those checks as passed.

The publishable-key profiles probe returned HTTP 404 / PGRST205 (table missing).
Signup is enabled; email auto-confirm is disabled. The SQL migration has NOT been
run, so live RLS is NOT verified and the portal is not ready for public usage yet.

## SQL files

- supabase/migrations/202610020001_profiles_auth.sql — apply once in the authorized
  KBC Supabase SQL Editor. Stops transactionally if profiles already exists.
- supabase/tests/profiles_rls.sql — run AFTER setup with two real student accounts
  and one approved teacher. Tests own/cross-row access, role/email write denial,
  insertion denial and anonymous denial; rolls back all attempted updates.

See PHASE7_SETUP.md for exact redirect URLs, email settings, teacher approval,
real-account acceptance tests and the security model. No secret key or database
password is needed or requested. Approval and SQL execution stay in the owner's
Supabase dashboard.

## Git inventory

The inventory below includes the previously uncommitted Phase 6 metadata/assets.
Tracked diff against HEAD includes both phases. Phase 7's additional tracked
changes are account navigation/script/style references on the eight public pages,
shared session settings, and updated Supabase setup documentation.

```text
 M SUPABASE_SETUP.md
 M about.html
 M admission.html
 M contact.html
 M courses.html
 M gallery.html
 M index.html
 M js/supabase-client.js
 M notices.html
 M results.html
?? PHASE6_REVIEW.md
?? PHASE7_REVIEW.md
?? PHASE7_SETUP.md
?? assets/icons/apple-touch-icon.png
?? assets/icons/favicon-32.png
?? assets/icons/favicon.svg
?? assets/images/social-preview.png
?? css/auth.css
?? favicon.ico
?? forgot-password.html
?? js/auth-rules.js
?? js/auth.js
?? reset-password.html
?? robots.txt
?? sitemap.xml
?? student-dashboard.html
?? student-login.html
?? student-register.html
?? supabase/migrations/202610020001_profiles_auth.sql
?? supabase/tests/profiles_rls.sql
?? teacher-dashboard.html
?? teacher-login.html
?? tests/auth-rules.test.cjs
```

Tracked diff summary:

```text
 SUPABASE_SETUP.md     |  7 ++++---
 about.html            | 25 ++++++++++++++++++++++++-
 admission.html        | 25 ++++++++++++++++++++++++-
 contact.html          | 25 ++++++++++++++++++++++++-
 courses.html          | 25 ++++++++++++++++++++++++-
 gallery.html          | 25 ++++++++++++++++++++++++-
 index.html            | 25 ++++++++++++++++++++++++-
 js/supabase-client.js | 15 +++++++++++++--
 notices.html          | 25 ++++++++++++++++++++++++-
 results.html          | 25 ++++++++++++++++++++++++-
 10 files changed, 209 insertions(+), 13 deletions(-)
```
