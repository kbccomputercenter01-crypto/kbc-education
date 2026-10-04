import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {validSignature,capturedPaymentMatches} from '../supabase/functions/_shared/razorpay-crypto.mjs';
test('HMAC rejects wrong secret, tampered raw bytes and malformed signatures',async()=>{
 const sample='unit-test-only',raw='{"event":"unit-test"}';
 const signature=createHmac('sha256',sample).update(raw).digest('hex');
 assert.equal(await validSignature(sample,raw,signature),true);
 assert.equal(await validSignature(sample,raw+' ',signature),false);
 assert.equal(await validSignature('different-unit-value',raw,signature),false);
 assert.equal(await validSignature(sample,raw,'abc'),false);
 assert.equal(await validSignature(sample,raw,null),false);
});
test('authorized payment, wrong amount/currency/order, partial payment and refunds cannot confirm',()=>{
 // Isolated verifier inputs only. Never sent to Razorpay or inserted in Supabase.
 const record={order_reference:'unit-order',amount_paise:250000,currency:'INR'};
 const payment={status:'captured',captured:true,order_id:'unit-order',amount:250000,currency:'INR',amount_refunded:0};
 const order={id:'unit-order',status:'paid',amount:250000,amount_paid:250000,amount_due:0,currency:'INR'};
 assert.equal(capturedPaymentMatches(payment,order,record),true);
 for(const patch of [{status:'authorized'},{captured:false},{amount:1},{currency:'USD'},{order_id:'other'},{amount_refunded:1}])assert.equal(capturedPaymentMatches({...payment,...patch},order,record),false);
 for(const patch of [{status:'created'},{amount_paid:1},{amount_due:1},{amount:1},{id:'other'},{currency:'USD'}])assert.equal(capturedPaymentMatches(payment,{...order,...patch},record),false);
});
