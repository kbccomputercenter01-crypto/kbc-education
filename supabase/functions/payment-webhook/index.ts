import {reply,settings,database,verifyCaptured} from '../_shared/razorpay.ts';
import {validSignature} from '../_shared/razorpay-crypto.mjs';
Deno.serve(async req=>{
 if(req.method!=='POST')return reply(405,{error:'Method not allowed'});
 try{
  const config=settings(),bytes=new Uint8Array(await req.arrayBuffer());if(bytes.length>262144)return reply(413,{error:'Payload too large'});
  if(!await validSignature(config.webhook,bytes,req.headers.get('x-razorpay-signature')))return reply(400,{error:'Signature rejected'});
  const event=JSON.parse(new TextDecoder().decode(bytes));if(!['payment.captured','order.paid'].includes(event.event))return reply(200,{ignored:true});
  const payment=event.payload?.payment?.entity;
  if(!/^pay_[A-Za-z0-9]+$/.test(payment?.id||'')||!/^order_[A-Za-z0-9]+$/.test(payment?.order_id||''))return reply(400,{error:'Invalid event'});
  const db=database(),{data:record,error}=await db.from('payments').select('*').eq('gateway','razorpay').eq('order_reference',payment.order_id).single();
  if(error||!record)return reply(503,{error:'Order awaiting reconciliation'});
  if(!await verifyCaptured(db,record,payment.id))return reply(409,{error:'Capture not reconciled'});
  return reply(200,{received:true});
 }catch{return reply(503,{error:'Verification temporarily unavailable'});}
});
