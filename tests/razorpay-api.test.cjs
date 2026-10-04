const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const app = require('../server.js');

let server;
let baseUrl;

test.before(async () => {
  await new Promise(resolve => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
});

test('POST /api/create-order validates minimum amount of 100 paise', async () => {
  const res = await fetch(`${baseUrl}/api/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 50 }) // Below 100 paise
  });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.match(json.error, /100 paise/);
});

test('POST /api/create-order creates real Razorpay order with valid amount', async () => {
  const res = await fetch(`${baseUrl}/api/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 50000, currency: 'INR', receipt: 'test_rcpt_1' })
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(json.order_id && json.order_id.startsWith('order_'));
  assert.equal(json.amount, 50000);
  assert.equal(json.currency, 'INR');
  assert.equal(json.key_id, process.env.RAZORPAY_KEY_ID);
});

test('POST /api/verify-payment rejects missing fields', async () => {
  const res = await fetch(`${baseUrl}/api/verify-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ razorpay_order_id: 'order_123' }) // missing payment_id & signature
  });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.success, false);
  assert.match(json.error, /Missing required/);
});

test('POST /api/verify-payment rejects invalid signature', async () => {
  const res = await fetch(`${baseUrl}/api/verify-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: 'order_fake_123',
      razorpay_payment_id: 'pay_fake_456',
      razorpay_signature: '0000000000000000000000000000000000000000000000000000000000000000'
    })
  });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.success, false);
  assert.match(json.error, /Signature verification failed/);
});

test('POST /api/verify-payment accepts valid HMAC-SHA256 signature', async () => {
  const orderId = 'order_test_789';
  const paymentId = 'pay_test_012';
  const validSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const res = await fetch(`${baseUrl}/api/verify-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: validSig
    })
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.order_id, orderId);
  assert.equal(json.payment_id, paymentId);
});
