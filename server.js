const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Verify required environment variables
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  console.warn('WARNING: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set in environment variables.');
}

// Initialize Razorpay client
const razorpay = new Razorpay({
  key_id: keyId || '',
  key_secret: keySecret || ''
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static website files from root
app.use(express.static(__dirname));

/**
 * Public config endpoint: returns public key_id safely (KEY_SECRET is never exposed)
 */
app.get('/api/config', (req, res) => {
  if (!process.env.RAZORPAY_KEY_ID) {
    return res.status(500).json({ error: 'Razorpay key is not configured' });
  }
  res.json({ key_id: process.env.RAZORPAY_KEY_ID });
});

/**
 * STEP 1: Backend - Create Order
 * Endpoint: POST /api/create-order
 * Request body: { amount (in paise), currency (optional, default 'INR'), receipt (optional) }
 * Return: { order_id, amount, currency, key_id }
 */
app.post('/api/create-order', async (req, res) => {
  try {
    const rawAmount = req.body?.amount;
    const amount = Number(rawAmount);

    // Validate amount >= 100 paise (min limit per Razorpay specification)
    if (!amount || isNaN(amount) || amount < 100) {
      return res.status(400).json({
        error: 'Invalid amount. Minimum amount required is 100 paise (₹1.00).'
      });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        error: 'Razorpay credentials are not configured on server.'
      });
    }

    const options = {
      amount: Math.round(amount),
      currency: (req.body?.currency || 'INR').toUpperCase(),
      receipt: (req.body?.receipt || `rcpt_${Date.now()}`).substring(0, 40)
    };

    const order = await razorpay.orders.create(options);

    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);

    // Handle authentication failures
    if (err.statusCode === 401 || (err.error?.code === 'BAD_REQUEST_ERROR' && err.error?.description?.includes('auth'))) {
      return res.status(401).json({
        error: 'Authentication failed with payment gateway. Please check Razorpay credentials.'
      });
    }

    // Handle general Razorpay API errors
    return res.status(500).json({
      error: err.error?.description || err.message || 'Failed to create payment order.'
    });
  }
});

/**
 * STEP 3: Backend - Verify Signature
 * Endpoint: POST /api/verify-payment
 * Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * Compare generated signature with razorpay_signature
 */
app.post('/api/verify-payment', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    // Validate missing fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment verification parameters: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.'
      });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Razorpay secret key is not configured on server.'
      });
    }

    // Generate expected HMAC-SHA256 signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    // Timing-safe signature comparison
    const isMatch = (
      expectedSignature.length === razorpay_signature.length &&
      crypto.timingSafeEqual(Buffer.from(expectedSignature, 'utf8'), Buffer.from(razorpay_signature, 'utf8'))
    );

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Signature verification failed. The payment signature is invalid or has been tampered with.'
      });
    }

    // Signatures match
    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully.',
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id
    });
  } catch (err) {
    console.error('Error verifying payment signature:', err);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred during payment verification.'
    });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`KBC Server with Razorpay running at http://localhost:${PORT}`);
    console.log(`Razorpay Key ID: ${keyId ? keyId.substring(0, 8) + '...' : 'NOT SET'}`);
  });
}

module.exports = app;
