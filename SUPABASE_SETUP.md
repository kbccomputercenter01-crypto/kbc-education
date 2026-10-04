# Supabase connection

The existing static pages load Supabase JS 2.117.2 from jsDelivr, followed by
`js/supabase-config.js` and `js/supabase-client.js`. The client is available as
`window.kbcSupabase`. Phase 7 adds the real Auth and profile frontend plus a
database migration. Session persistence, refresh, and URL session detection
are enabled for the Auth flows, using the `kbc-auth-session` browser storage key.
See `PHASE7_SETUP.md` before enabling the portal in production.

Configuration contains only the project URL and browser-safe publishable key.
These values are public by design. Never add secret/service-role keys or a
database password to these files, HTML, or the repository.

No environment variables or npm installation are required. Plain GitHub Pages
does not inject `.env` variables into JavaScript. Update the public values in
`js/supabase-config.js` if the project or publishable key changes. No server SDK
or GitHub Actions workflow is needed.

For a read-only connectivity check, run this in the browser console:

```js
await window.checkKbcSupabaseConnection()
```

Expected result: `{ connected: true, status: 200 }`. This checks the Auth
settings endpoint with the publishable key; it does not test login, table
permissions, or storage policies. It does not create data.

Before future data features, configure and test Row Level Security on all
exposed tables and policies for private storage. A public key does not make
existing permissive database policies safe. No database policies are changed
by this connection setup.
