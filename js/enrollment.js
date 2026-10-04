/* Client collects inputs; SQL/RLS owns prices, identity and workflow status. */
(() => {
 'use strict';
 const client = window.kbcSupabase;
 const root = document.querySelector('[data-enrollment-root]');
 if (!root || !client) return;
 const status = root.querySelector('[data-enrollment-status]');
 const selector = root.querySelector('[data-course-select]');
 const summary = root.querySelector('[data-fee-summary]');
 const application = root.querySelector('[data-application-form]');
 let courses = [], fees = [], current = null, userId = null, generation = 0, busy = false;
 const money = (paise) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(paise/100);
 const say = (text) => { status.textContent = text; };
 const node = (tag,text) => { const el=document.createElement(tag); el.textContent=text; return el; };
 const link = (text,id) => { const a=node('a',text); a.href=`enroll.html?application=${encodeURIComponent(id)}`; a.className='text-link'; return a; };
 const fail = (error) => { if(selector && !courses.length) {selector.replaceChildren(node('option','Course catalogue unavailable'));selector.firstChild.value='';selector.disabled=true;} say(['PGRST205','PGRST202','42P01','42883'].includes(error?.code)
  ? 'The institute must finish the enrollment database setup. Please contact KBC.'
  : 'Unable to load or save your application. Please retry or contact KBC.'); };
 const clearPrivate = () => {
  userId=null; current=null; generation++;
  application?.reset(); if(application) application.hidden=true;
  summary?.replaceChildren(); if(selector) selector.disabled=!courses.length;
  const pay=root.querySelector('[data-proceed-payment]'); if(pay) pay.hidden=true;
  root.querySelectorAll('[data-enrollment-list],[data-payment-list],[data-admission-list],[data-my-courses],[data-receipt-list]').forEach(el=>el.replaceChildren());
 };
 const feeDisplay = () => {
  if(!summary) return;
  summary.replaceChildren();
  const fee=current?.amount_paise != null ? current : fees.find(f=>f.course_id===selector?.value);
  if(!fee) { summary.append(node('p','Fee information will be updated by the institute.')); return; }
  const dl=document.createElement('dl'); dl.className='profile-info';
  for(const [label,value] of [['Course fee',fee.tuition_paise],['Admission/application fee',fee.application_paise],['Discount',fee.discount_paise],['Final payable amount',fee.amount_paise ?? fee.tuition_paise+fee.application_paise-fee.discount_paise]]) {
   const row=document.createElement('div'); row.append(node('dt',label),node('dd',money(value))); dl.append(row);
  }
  summary.append(dl);
 };
 const renderApplication = async (enrollment,run) => {
  if(run!==generation) return;
  current=enrollment;
  if(selector) { selector.value=enrollment.course_id; selector.disabled=true; }
  feeDisplay();
  say(`${enrollment.application_number} — ${enrollment.status.replaceAll('_',' ')}`);
  const {data,error}=await client.from('admission_applications').select('full_name,phone,address,qualification').eq('enrollment_id',enrollment.id).maybeSingle();
  if(run!==generation) return;
  if(error) throw error;
  if(application) {
   application.hidden=false;
   application.querySelector('fieldset').disabled=enrollment.status!=='application_started';
   if(data) for(const key of ['full_name','phone','address','qualification']) application.elements.namedItem(key).value=data[key];
  }
  const pay=root.querySelector('[data-proceed-payment]');
  if(pay) { pay.hidden=!['payment_pending','payment_processing'].includes(enrollment.status); pay.disabled=false; }
  const note=root.querySelector('[data-payment-note]');
  if(note) note.textContent=enrollment.status==='enrolled' ? 'Enrollment confirmed by server-verified payment.' : 'Payment availability is checked securely when you proceed. An application is not a confirmed enrollment.';
 };
 const list = (selectorName,rows,build,empty) => {
  const host=root.querySelector(selectorName); if(!host) return;
  host.replaceChildren(); if(!rows.length) host.append(node('p',empty));
  rows.forEach(row=>{const card=document.createElement('article');card.className='enrollment-record';build(card,row);host.append(card);});
 };
 const load = async () => {
  const run=++generation;
  try {
   const {data:c,error:ce}=await client.from('courses').select('id,code,name,active').eq('active',true).order('created_at');
   if(ce) throw ce;
   const {data:f,error:fe}=await client.from('course_fees').select('course_id,tuition_paise,application_paise,discount_paise,currency');
   if(fe) throw fe;
   if(run!==generation) return;
   courses=c;fees=f;
   if(selector) {
    const old=selector.value; selector.disabled=false; selector.replaceChildren(node('option','Choose Course'));selector.firstChild.value='';
    courses.forEach(course=>{const opt=node('option',course.name);opt.value=course.id;selector.append(opt);});
    const code=new URLSearchParams(location.search).get('course') || sessionStorage.getItem('kbc-selected-course');
    const chosen=courses.find(course=>course.code===code);
    selector.value=chosen?.id || old;
    if(chosen) sessionStorage.setItem('kbc-selected-course',chosen.code);
    feeDisplay();
   }
   const {data:u,error:ue}=await client.auth.getUser();
   if(run!==generation) return;
   if(ue || !u.user) { say('Choose a course, then register or sign in to continue.'); return; }
   const {data:p,error:pe}=await client.from('profiles').select('role').eq('id',u.user.id).single();
   if(pe) throw pe;
   if(run!==generation) return;
   if(p.role!=='student') {say('Enrollment is available to verified student accounts.');return;}
   userId=u.user.id;
   if(selector) {
    const id=new URLSearchParams(location.search).get('application');
    if(id) {
     const {data:e,error}=await client.from('enrollments').select('*').eq('id',id).eq('student_id',userId).single();
     if(error) throw error; await renderApplication(e,run);
    } else say('Choose Course to start your application.');
   } else {
    const [{data:e,error:ee},{data:payments,error:payError},{data:apps,error:appError}]=await Promise.all([
     client.from('enrollments').select('*').eq('student_id',userId).order('created_at',{ascending:false}),
     client.from('payments').select('id,enrollment_id,amount_paise,currency,status,receipt_number,verified_at,created_at').eq('student_id',userId).order('created_at',{ascending:false}),
     client.from('admission_applications').select('enrollment_id,full_name,phone,address,qualification,submitted_at').eq('student_id',userId)]);
    if(ee||payError||appError) throw ee||payError||appError;
    if(run!==generation) return;
    const courseName=id=>courses.find(c=>c.id===id)?.name || 'Course';
    list('[data-enrollment-list]',e,(card,row)=>{card.append(node('h3',courseName(row.course_id)),node('p',`${row.application_number} — ${row.status.replaceAll('_',' ')}`),link('View Enrollment',row.id));},'No applications yet.');
    list('[data-my-courses]',e.filter(row=>row.status==='enrolled'),(card,row)=>card.append(node('h3',courseName(row.course_id)),node('p',row.application_number)),'No confirmed course enrollments yet.');
    list('[data-payment-list]',payments,(card,row)=>card.append(node('p',`${money(row.amount_paise)} — ${row.status}`),link('View Enrollment',row.enrollment_id)),'No payment records.');
    list('[data-admission-list]',apps,(card,row)=>card.append(node('h3',row.full_name),node('p',`${row.phone} · ${row.qualification}`),node('p',row.address),link('View Enrollment',row.enrollment_id)),'No submitted admission details.');
    list('[data-receipt-list]',payments.filter(row=>row.status==='verified'&&row.receipt_number),(card,row)=>{
     const details=document.createElement('details');details.append(node('summary','View Receipt'),node('p',`Receipt: ${row.receipt_number}`),node('p',`Paid: ${money(row.amount_paise)}`),node('p',`Verified: ${new Date(row.verified_at).toLocaleString()}`));card.append(details);
    },'Receipts appear only after server-verified payment.');
    say('Your enrollment records are up to date.');
   }
  } catch(error) {if(run===generation) fail(error);}
 };
 selector?.addEventListener('change',()=>{current=null;const chosen=courses.find(c=>c.id===selector.value);
  if(chosen)sessionStorage.setItem('kbc-selected-course',chosen.code);else sessionStorage.removeItem('kbc-selected-course');feeDisplay();});
 root.querySelector('[data-start-application]')?.addEventListener('click',async()=>{
  if(busy) return;
  if(!selector.value) {say('Please select a course.');selector.focus();return;}
  const course=courses.find(c=>c.id===selector.value); if(!course) return;
  sessionStorage.setItem('kbc-selected-course',course.code); // Selection only, never status or payment authorization.
  if(!userId) {location.href='student-login.html';return;}
  busy=true; const run=generation;
  try {const {data,error}=await client.rpc('kbc_start_application',{p_course:selector.value});if(error) throw error;
   if(run!==generation) return;
   location.href=`enroll.html?application=${encodeURIComponent(data.id)}`;
  } catch(error) {if(run===generation) fail(error);} finally {busy=false;}
 });
 application?.addEventListener('submit',async event=>{
  event.preventDefault(); if(busy||!current||!userId||!application.reportValidity()) return;
  if(!window.KBCAuthRules.validPhone(application.elements.namedItem('phone').value)) {say('Enter a phone number with 10 to 15 digits.');return;}
  busy=true; const run=generation;
  const val=name=>application.elements.namedItem(name).value.trim();
  try {
   const {data,error}=await client.rpc('kbc_submit_application',{p_enrollment:current.id,p_name:val('full_name'),p_phone:val('phone').replace(/\D/g,''),p_address:val('address'),p_qualification:val('qualification')});
   if(error) throw error; await renderApplication(data,run);
   if(run===generation && data.amount_paise==null) say('Admission details saved. Fee information will be updated by the institute. Continue this application after fees are configured.');
  } catch(error) {if(run===generation) fail(error);} finally {busy=false;}
 });
 let checkoutLoading;
 const checkoutScript=()=>{
  if(window.Razorpay)return Promise.resolve();
  if(!checkoutLoading) checkoutLoading=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';
   script.onload=()=>window.Razorpay?resolve():reject(new Error('Checkout unavailable'));
   script.onerror=()=>{script.remove();checkoutLoading=null;reject(new Error('Checkout unavailable'));};document.head.append(script);
  });return checkoutLoading;
 };
 root.querySelector('[data-proceed-payment]')?.addEventListener('click',async()=>{
  if(busy||!current||!userId||!['payment_pending','payment_processing'].includes(current.status))return;
  busy=true;const run=generation,button=root.querySelector('[data-proceed-payment]');button.disabled=true;
  try {
   const {data,error}=await client.functions.invoke('create-payment-order',{body:{enrollment_id:current.id}});
   if(error||!data||!/^rzp_(live|test)_/.test(data.key_id||'')||!/^order_[A-Za-z0-9]+$/.test(data.order_id||'')||!Number.isSafeInteger(data.amount)||data.amount<=0||data.currency!=='INR')throw new Error('Order unavailable');
   if(run!==generation)return;
   await checkoutScript();if(run!==generation)return;
   const checkout=new window.Razorpay({key:data.key_id,order_id:data.order_id,amount:data.amount,currency:data.currency,name:'KBC Computer Education',description:'Course enrollment',
    handler:async response=>{
     if(run!==generation)return;
     say('Payment received by checkout. Waiting for secure server verification. Do not pay again.');
     try {
      const {error}=await client.functions.invoke('verify-payment',{body:{razorpay_order_id:response.razorpay_order_id,razorpay_payment_id:response.razorpay_payment_id,razorpay_signature:response.razorpay_signature}});
      if(error)throw error;
      await load(); // Only RLS-protected database state determines enrollment confirmation.
     }catch{say('Verification is pending. Check My Enrollments later or contact KBC; do not pay again.');}
    },modal:{ondismiss:()=>{if(run===generation)say('Checkout closed. Check your enrollment status before retrying a payment.');}}});
   checkout.on('payment.failed',()=>{if(run===generation)say('Payment attempt failed. Check your enrollment status before retrying.');});
   checkout.open();say('Complete the payment in Razorpay Checkout. Enrollment awaits server verification.');
  }catch{say('Online payment is unavailable or needs institute configuration. Contact KBC; your enrollment has not been confirmed.');}
  finally{busy=false;button.disabled=false;}
 });
 client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){clearPrivate();say('Please sign in to view your records.');}else if(event!=='INITIAL_SESSION')setTimeout(()=>{clearPrivate();load();},0);});
 window.addEventListener('pagehide',clearPrivate);
 window.addEventListener('pageshow',event=>{if(event.persisted)load();});
 root.querySelector('[data-enrollment-retry]')?.addEventListener('click',load);
 feeDisplay(); load();
})();
