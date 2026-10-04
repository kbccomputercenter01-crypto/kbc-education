/* Teachers receive only the explicitly assigned, payment-free SQL projection. */
(() => {
 const host=document.querySelector('[data-assigned-students]'), client=window.kbcSupabase;
 if(!host||!client) return;
 let revision=0;
 const clear=()=>{revision++;host.replaceChildren();};
 async function load() {
  const run=++revision;
  const {data:user,error}=await client.auth.getUser();
  if(error||!user.user||run!==revision) return;
  const {data:profile,error:profileError}=await client.from('profiles').select('role').eq('id',user.user.id).single();
  if(profileError||profile.role!=='teacher'||run!==revision) return;
  const {data,error:assignmentError}=await client.rpc('kbc_assigned_students');
  if(run!==revision) return;
  host.replaceChildren();
  const p=document.createElement('p');
  if(assignmentError) {p.textContent='Assigned students are unavailable until enrollment setup is complete.';host.append(p);return;}
  if(!data.length) {p.textContent='No enrolled students have been assigned to you.';host.append(p);return;}
  for(const row of data) {const item=document.createElement('p');item.textContent=`${row.student_name} — ${row.course_name} — ${row.application_number}`;host.append(item);}
 }
 client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')clear();else if(event!=='INITIAL_SESSION')setTimeout(()=>{clear();load();},0);});
 window.addEventListener('pagehide',clear);
 window.addEventListener('pageshow',event=>{if(event.persisted)load();});
 load();
})();
