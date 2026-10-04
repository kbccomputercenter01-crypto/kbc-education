export async function validSignature(secret,body,signature) {
 if(typeof signature!=='string'||!/^[a-f0-9]{64}$/i.test(signature))return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,typeof body==='string'?new TextEncoder().encode(body):body));
 const supplied=Uint8Array.from(signature.match(/../g),s=>parseInt(s,16));
 let difference=0;for(let i=0;i<digest.length;i++)difference|=digest[i]^supplied[i];return difference===0;
}
export function capturedPaymentMatches(payment,order,record) {
 return payment?.status==='captured' && payment.captured===true && order?.status==='paid'
 && payment.order_id===record.order_reference && order.id===record.order_reference
 && payment.amount===Number(record.amount_paise) && order.amount===Number(record.amount_paise)
 && order.amount_paid===Number(record.amount_paise) && order.amount_due===0
 && payment.currency===record.currency && order.currency===record.currency
 && Number(payment.amount_refunded||0)===0;
}
