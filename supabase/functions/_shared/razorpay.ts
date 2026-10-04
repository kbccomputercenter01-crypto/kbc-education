import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {capturedPaymentMatches} from './razorpay-crypto.mjs';
export const reply=(status:number,body:unknown,headers:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
export function settings() {
 const key=Deno.env.get('RAZORPAY_KEY_ID')||'',secret=Deno.env.get('RAZORPAY_KEY_SECRET')||'',webhook=Deno.env.get('RAZORPAY_WEBHOOK_SECRET')||'',mode=Deno.env.get('RAZORPAY_MODE');
 if(Deno.env.get('RAZORPAY_ENABLED')!=='true'||!['test','live'].includes(mode||'')||!key.startsWith(`rzp_${mode}_`)||!secret||!webhook)throw Error('disabled');
 // Test keys cannot confirm enrollments in KBC's production Supabase project.
 if(mode==='test' && (Deno.env.get('KBC_PAYMENT_ENVIRONMENT')!=='sandbox'||Deno.env.get('SUPABASE_URL')==='https://yvgzxtblrijxtnqbvprq.supabase.co'))throw Error('disabled');
 return {key,secret,webhook};
}
export function database() {
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)throw Error('disabled');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function cors(req:Request) {
 const origin=req.headers.get('origin')||'';
 if(!(Deno.env.get('KBC_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean).includes(origin))throw Error('origin');
 return {'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
}
export async function student(req:Request,db:ReturnType<typeof database>) {
 const header=req.headers.get('authorization')||'';if(!header.startsWith('Bearer '))throw Error('auth');
 const {data,error}=await db.auth.getUser(header.slice(7));if(error||!data.user?.email_confirmed_at)throw Error('auth');
 const {data:profile,error:pe}=await db.from('profiles').select('role').eq('id',data.user.id).single();
 if(pe||profile?.role!=='student')throw Error('auth');return data.user.id;
}
export async function body(req:Request) {const raw=await req.text();if(raw.length>4096)throw Error('input');return JSON.parse(raw);}
export async function gateway(path:string,method='GET',payload?:unknown) {
 const {key,secret}=settings();
 const response=await fetch(`https://api.razorpay.com/v1/${path}`,{method,headers:{Authorization:`Basic ${btoa(`${key}:${secret}`)}`,'Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('gateway');return response.json();
}
export async function verifyCaptured(db:ReturnType<typeof database>,record:any,paymentId:string) {
 const [payment,order]=await Promise.all([gateway(`payments/${encodeURIComponent(paymentId)}`),gateway(`orders/${encodeURIComponent(record.order_reference)}`)]);
 if(!capturedPaymentMatches(payment,order,record))return false;
 const {error}=await db.rpc('kbc_verify_gateway_payment',{p_gateway:'razorpay',p_order:record.order_reference,p_reference:paymentId,p_amount:payment.amount,p_currency:payment.currency});
 if(error)throw Error('database');return true;
}
