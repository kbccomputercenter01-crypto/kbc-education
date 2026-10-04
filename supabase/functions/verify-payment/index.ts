import {reply,settings,database,cors,student,body,verifyCaptured} from '../_shared/razorpay.ts';
import {validSignature} from '../_shared/razorpay-crypto.mjs';
Deno.serve(async req=>{
 let headers:Record<string,string>={};
 try{
  headers=cors(req);if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply(405,{error:'Method not allowed'},headers);
  const config=settings(),db=database(),owner=await student(req,db),input=await body(req);
  if(!input||!/^order_[A-Za-z0-9]+$/.test(input.razorpay_order_id||'')||!/^pay_[A-Za-z0-9]+$/.test(input.razorpay_payment_id||''))return reply(400,{error:'Invalid reference'},headers);
  const {data:record,error}=await db.from('payments').select('*').eq('student_id',owner).eq('gateway','razorpay').eq('order_reference',input.razorpay_order_id).single();
  if(error||!record)return reply(404,{error:'Payment unavailable'},headers);
  if(!await validSignature(config.secret,record.order_reference+'|'+input.razorpay_payment_id,input.razorpay_signature))return reply(400,{error:'Signature rejected'},headers);
  const verified=await verifyCaptured(db,record,input.razorpay_payment_id);
  return reply(verified?200:202,{verified},headers);
 }catch(error){return reply(error instanceof Error&&error.message==='auth'?401:503,{error:'Verification unavailable. Check enrollment status before retrying.'},headers);}
});
