'use strict';
const $=s=>document.querySelector(s),menu=$('.menu-toggle'),nav=$('#primary-nav'),form=$('#appointment-form'),result=$('#form-result');
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let live=false,doctors=[],slotRequest=0,sending=false;
$('#current-year').textContent=new Date().getFullYear();
function setMenu(open){menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation menu':'Open navigation menu');nav.classList.toggle('is-open',open);document.body.classList.toggle('menu-open',open);}
menu.addEventListener('click',()=>setMenu(menu.getAttribute('aria-expanded')!=='true'));
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){setMenu(false);menu.focus();}});
document.addEventListener('click',e=>{if(menu.getAttribute('aria-expanded')==='true'&&!nav.contains(e.target)&&!menu.contains(e.target))setMenu(false);});
window.addEventListener('resize',()=>{if(innerWidth>800)setMenu(false);});
$('.hero-visual').removeAttribute('role');$('.hero-visual').removeAttribute('aria-label');
if('IntersectionObserver' in window&&!reduce){const o=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');o.unobserve(e.target);}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(e=>o.observe(e));}else document.querySelectorAll('.reveal').forEach(e=>e.classList.add('is-visible'));
document.querySelector('#back-to-top').addEventListener('click',e=>{e.preventDefault();window.scrollTo({top:0,behavior:reduce?'auto':'smooth'});});
if('IntersectionObserver' in window){const o=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)document.querySelectorAll('.nav-link').forEach(a=>{const active=a.getAttribute('href')==='#'+(e.target.id||'top');a.classList.toggle('active',active);active?a.setAttribute('aria-current','location'):a.removeAttribute('aria-current');});}),{rootMargin:'-20% 0px -65% 0px'});document.querySelectorAll('main section[id],.hero').forEach(e=>o.observe(e));}
const serviceNames=['General medicine','Health checkup','Family medicine','Lab & diagnostics'];
document.querySelectorAll('.service-card .card-link').forEach((a,i)=>a.addEventListener('click',()=>$('#service').value=serviceNames[i]));
document.querySelectorAll('.doctor-link').forEach((a,i)=>a.addEventListener('click',()=>{if(doctors[i]){$('#doctor').value=doctors[i].id;refreshSlots();}}));
const search=$('#service-search'),clear=$('#clear-services');
search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();let count=0;document.querySelectorAll('.service-card').forEach(c=>{c.hidden=!c.textContent.toLowerCase().includes(q);if(!c.hidden)count++;});clear.hidden=!search.value;$('#service-count').textContent=count+' services';$('#no-services').hidden=count>0;});
clear.addEventListener('click',()=>{search.value='';search.dispatchEvent(new Event('input'));search.focus();});
async function request(path,body){const r=await fetch('/api'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not complete the request. Please try again.');return d;}
function show(message,error=false){result.textContent=message;result.classList.toggle('error',error);result.hidden=false;result.scrollIntoView({block:'nearest',behavior:reduce?'auto':'smooth'});}
function setContact(c){
 document.querySelectorAll('a[href^="tel:"]').forEach(a=>{if(c.phone){a.href='tel:'+c.phone.replace(/[^\d+]/g,'');a.textContent=a.classList.contains('button')?'Call the clinic ↗':c.phone;}else{a.removeAttribute('href');a.textContent='Phone number not yet set';a.classList.remove('button','button-light');}});
 document.querySelectorAll('a[href^="mailto:"]').forEach(a=>{if(c.email){a.href='mailto:'+c.email;a.textContent=c.email;}else{a.removeAttribute('href');a.textContent='Email not yet set';}});
 $('#clinic-address').textContent=c.address||'Clinic address will be added soon.';
}
async function initialize(){
 if(location.protocol==='file:'){offline();return;}
 try{const d=await request('/public');live=true;doctors=d.doctors;$('#preferred-date').min=d.today;$('#doctor').innerHTML='<option value="">Choose a doctor</option>'+doctors.map(x=>'<option value="'+x.id+'">'+esc(x.name)+' · '+esc(x.specialty)+'</option>').join('');$('#booking-note').textContent='Your request is sent to the clinic. Reception will confirm your appointment. Times shown are in Cairo time.';setContact(d.clinic);
 document.querySelectorAll('.doctor-card').forEach((card,i)=>{if(!doctors[i]){card.hidden=true;return;}card.querySelector('h3').textContent=doctors[i].name;card.querySelector('.doctor-specialty').textContent=doctors[i].specialty;card.querySelector('.doctor-details p').textContent=doctors[i].specialty;card.querySelector('[role="img"]').setAttribute('aria-label','Illustrative doctor portrait');});
 }catch{offline('Booking is temporarily unavailable. Please try again when the clinic server is running.');}
}
function offline(message='Website preview. Start NovaCare to send an appointment request.'){live=false;$('#booking-note').textContent=message;$('#doctor').innerHTML='<option value="">Start NovaCare to load doctors</option>';$('#preferred-time').innerHTML='<option value="">Booking is not connected</option>';setContact({});}
async function refreshSlots(){
 const revision=++slotRequest,select=$('#preferred-time'),doctor=$('#doctor').value,date=$('#preferred-date').value;
 select.innerHTML='<option value="">Choose doctor and date first</option>';
 if(!live||!doctor||!date)return;
 select.disabled=true;select.innerHTML='<option value="">Checking available times…</option>';
 try{const d=await request('/slots?doctor='+encodeURIComponent(doctor)+'&date='+encodeURIComponent(date));if(revision!==slotRequest)return;select.innerHTML='<option value="">'+(d.times.length?'Select an available time':'No slots available — try another date')+'</option>'+d.times.map(t=>'<option>'+t+'</option>').join('');}
 catch(e){if(revision===slotRequest){select.innerHTML='<option value="">Choose a date to retry</option>';show(e.message,true);}}
 finally{if(revision===slotRequest)select.disabled=false;}
}
$('#doctor').onchange=refreshSlots;$('#preferred-date').onchange=refreshSlots;
form.querySelectorAll('input,select').forEach(el=>{const error=document.createElement('p');error.id=el.id+'-error';if(!el.id)el.id='consent';error.id=el.id+'-error';error.className='field-error';el.closest('.form-field,.consent-check').append(error);});
function validate(){let first;form.querySelectorAll('input,select').forEach(el=>{let m='';if(el.required&&(el.type==='checkbox'?!el.checked:!el.value.trim()))m=el.type==='checkbox'?'Please agree to be contacted.':'Please complete this field.';else if(el.value&&!el.validity.valid)m=el.type==='email'?'Enter a valid email address.':'Please check this value.';else if(el.id==='phone'&&!/^\+?[\d ()-]{7,25}$/.test(el.value.trim()))m='Enter a valid phone number.';$('#'+el.id+'-error').textContent=m;if(m){el.setAttribute('aria-invalid','true');el.setAttribute('aria-describedby',el.id+'-error');first??=el;}else{el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby');}});first?.focus();return !first;}
form.addEventListener('submit',async e=>{
 e.preventDefault();if(sending)return;result.hidden=true;
 if(!live){show('This preview cannot send bookings. Run START-NOVACARE.cmd, then open the website from the local server.',true);return;}
 if(!validate())return;const b=form.querySelector('[type=submit]');sending=true;b.disabled=true;form.setAttribute('aria-busy','true');
 try{const values=new FormData(form);const d=await request('/book',{name:values.get('fullName'),phone:values.get('phone'),email:values.get('email'),doctorId:Number(values.get('doctor')),date:values.get('date'),time:values.get('time'),service:values.get('service'),consent:values.get('consent')==='on'});show('Request received. Reference '+d.reference+'. Your preferred visit is '+d.date+' at '+d.time+' (Cairo time). Reception still needs to confirm this appointment.');form.reset();$('#preferred-time').innerHTML='<option value="">Choose doctor and date first</option>';}
 catch(e){show(e.message||'Connection lost. Keep your details here and try again.',true);}
 finally{sending=false;b.disabled=false;form.removeAttribute('aria-busy');}
});
initialize();

