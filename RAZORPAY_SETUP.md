# Razorpay integration — prepared, not deployed or activated

The checkout, order endpoint, signature verification and capture reconciliation
are implemented locally. No real order/payment/user was created. Existing nine
fees remain unchanged, admission/discount remain zero, and no extra charges are added.
The old Phase 8 reports describe its earlier inactive scaffolds; this guide is the
current integration status. Supabase connection/Auth/profiles RLS are preserved.

## Required owner setup (never share secrets in chat)

1. Confirm Phase 8 migration is installed in project yvgzxtblrijxtnqbvprq. If not,
   apply ONLY 202610020002_course_enrollment.sql after the already-applied profiles
   migration. Then apply 202610040001_razorpay_order_claims.sql once. Do not rerun
   existing migrations or change existing records to paid.
2. Supabase Dashboard > Edge Functions > Secrets: configure these values privately:
   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET,
   RAZORPAY_MODE=live, RAZORPAY_ENABLED=false initially,
   KBC_ALLOWED_ORIGINS=https://kbccomputercenter01-crypto.github.io
   (comma-separated exact localhost origins only if local testing is needed).
   Generate the webhook secret privately; use the SAME value in Razorpay webhook
   configuration. It is distinct from the Razorpay API Key Secret.
   Supabase injects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY into hosted Edge
   Functions; do not copy these into frontend files, GitHub or chat.
3. Authenticate the Supabase CLI locally as the project owner, then deploy:

```powershell
supabase functions deploy create-payment-order --project-ref yvgzxtblrijxtnqbvprq
supabase functions deploy verify-payment --project-ref yvgzxtblrijxtnqbvprq
supabase functions deploy payment-webhook --project-ref yvgzxtblrijxtnqbvprq
```

   The config.toml disables platform legacy-JWT checking only for these functions.
   Browser endpoints enforce getUser verification and student ownership themselves;
   webhook enforces Razorpay's HMAC over original bytes. Never remove those checks.
4. Razorpay Dashboard > Webhooks: configure the production URL:
   https://yvgzxtblrijxtnqbvprq.supabase.co/functions/v1/payment-webhook
   Events: payment.captured and order.paid. Configure the private webhook secret.
5. Configure automatic capture in Razorpay. An authorized payment alone DOES NOT
   confirm enrollment. Actual captured payment and paid order must match the stored
   exact amount/currency. Review institute refund/cancellation policy separately.
6. Test in a SEPARATE Supabase sandbox with Razorpay Test Mode, KBC_PAYMENT_ENVIRONMENT
   set to sandbox and matching test keys. Production project explicitly rejects
   Test Mode so simulated money cannot confirm production enrollments.
7. After sandbox verification and review, set production RAZORPAY_ENABLED=true.
   An authorized human must perform any real transaction themselves. Verify signed
   webhook delivery and resulting own enrollment/receipt with real student account.
   Publish website changes only after explicit commit/push/deploy authorization.

## Security and retry behavior

- Browser sends only enrollment ID when requesting an order. Price and owner come
  from the database and validated Supabase identity; the public Key ID is returned
  by server only when configured. No private key appears in browser assets.
- SQL serializes order claims for an enrollment. Existing persisted orders are
  reused; if provider succeeded but the HTTP response/DB save was lost, future
  requests stop for owner reconciliation rather than creating a second order.
- Reconcile uncertain claims in Razorpay Dashboard using receipt=enrollment UUID.
  Retrieve the actual provider order with authenticated server API; confirm exact
  amount/currency and ownership. Persist only that actual order through the
  server-only kbc_record_gateway_order RPC. NEVER clear a claim blindly or invent
  a payment reference. Only after proving no external order exists may the owner
  reset the claim for a new request. This manual path is intentionally fail-closed.
- Checkout signatures use the stored order ID, not an untrusted supplied ID.
  Webhooks verify raw-byte HMAC. Both paths fetch current payment/order from
  Razorpay and require captured status, fully paid INR amount and no refund.
- Existing verification RPC locks records and is idempotent: replays/duplicate
  webhook deliveries cannot generate another receipt or enrollment confirmation.
  We do not trust webhook body prices or client success; the API reconciles them.
- Refunded/disputed payment lifecycle is NOT implemented by this integration.
  Capture verification does not guarantee no later refund/dispute; owner must
  reconcile those separately before production scale. No refund is initiated here.
- Avoid key/account rotation while orders are pending; reconcile them first.
- Set Supabase/Razorpay operational rate limits and review logs without recording
  JWTs, HMAC signatures, card details, UPI PINs or credentials.

## Changed files

js/enrollment.js; enroll.html; supabase/config.toml;
supabase/migrations/202610040001_razorpay_order_claims.sql;
supabase/functions/create-payment-order/index.ts;
supabase/functions/verify-payment/index.ts;
supabase/functions/payment-webhook/index.ts;
supabase/functions/_shared/razorpay.ts;
supabase/functions/_shared/razorpay-crypto.mjs;
tests/razorpay-security.test.mjs; tests/enrollment-schema.cjs; RAZORPAY_SETUP.md.

Local tests are isolated and create no live or mock database payments/users.
No secret values are saved in repository files. No commit, push, deployment or
activation has been performed by this task. Hosted tests require owner access,
migrations, configured secrets, deployed functions, and real accounts.
