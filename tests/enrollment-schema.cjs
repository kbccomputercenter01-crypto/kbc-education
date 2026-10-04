// Local PostgreSQL smoke test with EMPTY auth/users. No student/payment fixtures.
// Set KBC_PGLITE_MODULE to a temporary installation; no project dependency needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
async function main() {
 const { PGlite } = require(process.env.KBC_PGLITE_MODULE || '@electric-sql/pglite');
 const db = new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec(fs.readFileSync('supabase/migrations/202610020001_profiles_auth.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/202610020002_course_enrollment.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/202610040001_razorpay_order_claims.sql','utf8'));
 const q = async sql => (await db.query(sql)).rows;
 assert.equal((await q('select count(*)::int as n from public.courses'))[0].n,9);
 assert.deepEqual(await q('select c.code,f.tuition_paise::int as paise,f.application_paise::int as admission,f.discount_paise::int as discount from public.courses c join public.course_fees f on f.course_id=c.id order by c.code'),
 Object.entries({adca:650000,'c-plus':250000,ccc:250000,dca:400000,dctt:720000,dfa:350000,'prime-tally':350000,'tally-erp':350000,'typing-master':300000}).map(([code,paise])=>({code,paise,admission:0,discount:0})));
 for(const table of ['profiles','enrollments','admission_applications','payments','teacher_course_assignments'])
  assert.equal((await q(`select count(*)::int as n from public.${table}`))[0].n,0);
 for(const table of ['courses','course_fees','enrollments','admission_applications','payments','teacher_course_assignments']) {
  const [flags] = await q(`select relrowsecurity,relforcerowsecurity from pg_class where oid='public.${table}'::regclass`);
  assert.equal(flags.relrowsecurity,true);assert.equal(flags.relforcerowsecurity,true);
 }
 for(const table of ['enrollments','payments','admission_applications']) for(const privilege of ['INSERT','UPDATE','DELETE']) {
  assert.equal((await q(`select has_table_privilege('authenticated','public.${table}','${privilege}') as allowed`))[0].allowed,false);
 }
 for(const signature of ['kbc_record_gateway_order(uuid,uuid,text,text)','kbc_verify_gateway_payment(text,text,text,bigint,text)','kbc_claim_razorpay_order(uuid,uuid)']) {
  for(const role of ['anon','authenticated']) assert.equal((await q(`select has_function_privilege('${role}','public.${signature}','EXECUTE') as allowed`))[0].allowed,false);
  assert.equal((await q(`select has_function_privilege('service_role','public.${signature}','EXECUTE') as allowed`))[0].allowed,true);
 }
 await db.exec('set role anon');
 assert.equal((await q('select count(*)::int as n from public.courses'))[0].n,9);
 await assert.rejects(db.query('select * from public.payments'),/permission denied/);
 await db.exec('reset role; set role authenticated');
 assert.equal((await q('select count(*)::int as n from public.payments'))[0].n,0);
 await assert.rejects(db.query("select public.kbc_start_application((select id from public.courses limit 1))"),/Verified student account required/);
 assert.equal((await q('update public.course_fees set tuition_paise=tuition_paise returning *')).length,0);
 await assert.rejects(db.query("insert into public.course_fees(course_id,tuition_paise) select id,250000 from public.courses where code='ccc'"),/row-level security/);
 await db.exec('reset role');
 const policies=await q("select tablename,policyname,cmd,qual,with_check from pg_policies where tablename in ('course_fees','enrollments','payments','admission_applications') order by tablename,policyname");
 assert(policies.some(p=>p.policyname==='kbc_admin_fees' && p.with_check.includes('kbc_is_admin')));
 assert(policies.filter(p=>['enrollments','payments','admission_applications'].includes(p.tablename)).every(p=>p.cmd==='SELECT'));
 // Render actual approved catalogue from this local DB. No account/session fixtures.
 const { JSDOM } = require(process.env.KBC_JSDOM_MODULE || 'jsdom');
 const catalogue=await q('select * from public.courses');
 const approvedFees=await q('select course_id,tuition_paise::int,application_paise::int,discount_paise::int,currency from public.course_fees');
 async function render(feeRows,courseCode) {
  const dom=new JSDOM(fs.readFileSync('enroll.html','utf8'),{url:`http://localhost:8000/enroll.html?course=${courseCode}`,runScripts:'outside-only'});
  let listener;
  dom.window.kbcSupabase={from:table=>{
   const result={data:table==='courses'?catalogue:feeRows,error:null};
   const query={select:()=>query,eq:()=>query,order:()=>Promise.resolve(result),then:(resolve,reject)=>Promise.resolve(result).then(resolve,reject)};
   return query;
  },auth:{getUser:async()=>({data:{user:null},error:null}),onAuthStateChange:cb=>{listener=cb;}}};
  dom.window.eval(fs.readFileSync('js/enrollment.js','utf8'));
  for(let tries=0;tries<20;tries++){await new Promise(resolve=>setTimeout(resolve,5));if(dom.window.document.querySelector('[data-enrollment-status]').textContent)break;}
  return {dom,listener};
 }
 for(const course of catalogue) {
  const {dom,listener}=await render(approvedFees,course.code);
  assert.equal(dom.window.document.querySelectorAll('[data-course-select] option').length,10);
  const summary=dom.window.document.querySelector('[data-fee-summary]').textContent;
  const fee=approvedFees.find(f=>f.course_id===course.id);
  assert(summary.includes(new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(fee.tuition_paise/100)));
  assert(summary.includes('Admission/application fee₹0.00Discount₹0.00'));
  assert.equal(dom.window.sessionStorage.getItem('kbc-selected-course'),course.code);
  assert.equal(dom.window.document.querySelector('[data-proceed-payment]').hidden,true);
  listener('SIGNED_OUT');assert.equal(dom.window.document.querySelector('[data-fee-summary]').textContent,'');
  dom.window.close();
 }
 const {dom}=await render([],'ccc');
 assert.equal(dom.window.document.querySelector('[data-fee-summary]').textContent,'Fee information will be updated by the institute.');
 dom.window.close();
 console.log(JSON.stringify({passed:true,seededCourses:9,configuredFees:9,privateRecords:0,rlsTables:6,uiChecks:'nine fee summaries, zero extras, course preservation, missing fee, inactive payment, signed-out clearing',checks:'approved fees, migration execution, RLS flags, grants, service-only verification, anonymous denial, student-role gate, fee-write denial',policies},null,2));
 await db.close();
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
