import {reply,settings,database,cors,student,body,gateway} from '../_shared/razorpay.ts';
Deno.serve(async req=>{
 let headers:Record<string,string>={};
 try {
  headers=cors(req);if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply(405,{error:'Method not allowed'},headers);
  settings();const db=database(),owner=await student(req,db),input=await body(req);
  if(!input||Object.keys(input).length!==1||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.enrollment_id||''))return reply(400,{error:'Enrollment ID required'},headers);
  const {data:e,error}=await db.from('enrollments').select('*').eq('id',input.enrollment_id).eq('student_id',owner).single();
  if(error||!e||!['payment_pending','payment_processing'].includes(e.status)||!Number.isSafeInteger(Number(e.amount_paise))||Number(e.amount_paise)<=0)return reply(409,{error:'Enrollment not payable'},headers);
  const {data:claimed,error:claimError}=await db.rpc('kbc_claim_razorpay_order',{p_student:owner,p_enrollment:e.id});
  if(claimError)throw Error('database');let record;
  if(!claimed) {
   const {data,error}=await db.from('payments').select('*').eq('enrollment_id',e.id).eq('gateway','razorpay').in('status',['pending','processing']).maybeSingle();
   if(error||!data)return reply(409,{error:'Order awaiting reconciliation. Contact KBC; do not pay again.'},headers);record=data;
  }else{
   const order=await gateway('orders','POST',{amount:Number(e.amount_paise),currency:e.currency,receipt:e.id,partial_payment:false});
   if(!/^order_[A-Za-z0-9]+$/.test(order.id||'')||order.amount!==Number(e.amount_paise)||order.currency!==e.currency||order.receipt!==e.id)throw Error('gateway');
   const {data,error}=await db.rpc('kbc_record_gateway_order',{p_student:owner,p_enrollment:e.id,p_gateway:'razorpay',p_order:order.id});if(error)throw Error('database');record=data;
  }
  return reply(200,{key_id:settings().key,order_id:record.order_reference,amount:Number(record.amount_paise),currency:record.currency},headers);
 }catch(error){const reason=error instanceof Error?error.message:'';return reply(reason==='origin'?403:reason==='auth'?401:503,{error:reason==='auth'?'Verified student login required.':'Payment unavailable. Contact KBC before retrying.'},headers);}
});
