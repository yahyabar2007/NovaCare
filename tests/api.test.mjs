import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
test('clinic workflows and authorization', async (t) => {
 const dir=await mkdtemp(join(tmpdir(),'novacare-test-'));
 const app=await createApp({dataDir:dir,port:0,initialPassword:'Test-only-password-24'});
 await app.listen();
 const base='http://127.0.0.1:'+app.server.address().port;
 let cookie='',csrf='';
 async function api(path,method='GET',body,auth=true){
  const r=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json',Origin:base,...(auth?{Cookie:cookie,'X-CSRF-Token':csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await r.json();return {status:r.status,data,headers:r.headers};
 }
 try{
  await t.test('private records require login',async()=>assert.equal((await api('/patients')).status,401));
  await t.test('wrong password rejected',async()=>assert.equal((await api('/login','POST',{username:'admin',password:'wrong'})).status,401));
  const login=await api('/login','POST',{username:'admin',password:'Test-only-password-24'});assert.equal(login.status,200);
  cookie=login.headers.get('set-cookie').split(';')[0];csrf=login.data.csrf;
  await t.test('CSRF write rejected',async()=>{const old=csrf;csrf='bad';assert.equal((await api('/patients','POST',{name:'A',phone:'01012345678'})).status,403);csrf=old;});
  let patient,doctor,appointment,invoice;
  await t.test('blank and invalid patient rejected',async()=>assert.equal((await api('/patients','POST',{name:' ',phone:'abc'})).status,400));
  await t.test('patient created and editable',async()=>{
   const r=await api('/patients','POST',{name:'Test Patient',phone:'01012345678',email:'test@example.com'});assert.equal(r.status,201);patient=r.data;
   assert.equal((await api('/patients/'+patient.id,'PATCH',{name:'Updated Patient',phone:'01012345678',email:'test@example.com'})).status,200);
  });
  await t.test('doctors available',async()=>{doctor=(await api('/doctors')).data[0];assert.ok(doctor.id);});
  const date='2030-11-04';
  await t.test('appointment persists with actual doctor and patient',async()=>{
   const r=await api('/appointments','POST',{patientId:patient.id,doctorId:doctor.id,date,time:'10:00',service:'General medicine'});assert.equal(r.status,201);appointment=r.data;
  });
  await t.test('double booking rejected',async()=>assert.equal((await api('/appointments','POST',{patientId:patient.id,doctorId:doctor.id,date,time:'10:00',service:'General medicine'})).status,409));
  await t.test('past appointment rejected',async()=>assert.equal((await api('/appointments','POST',{patientId:patient.id,doctorId:doctor.id,date:'2020-01-01',time:'10:00',service:'General medicine'})).status,400));
  await t.test('cancel releases slot',async()=>{assert.equal((await api('/appointments/'+appointment.id,'PATCH',{status:'cancelled'})).status,200);assert.equal((await api('/appointments','POST',{patientId:patient.id,doctorId:doctor.id,date,time:'10:00',service:'General medicine'})).status,201);});
  await t.test('invoice calculates integer cents',async()=>{
   const r=await api('/invoices','POST',{patientId:patient.id,description:'Consultation',amount:'250.50'});assert.equal(r.status,201);invoice=r.data;assert.equal(invoice.total,25050);
  });
  await t.test('overpayment rejected',async()=>assert.equal((await api('/invoices/'+invoice.id+'/payments','POST',{amount:'251',method:'Cash'})).status,400));
  await t.test('partial and full payment recorded',async()=>{assert.equal((await api('/invoices/'+invoice.id+'/payments','POST',{amount:'100',method:'Cash'})).status,201);assert.equal((await api('/invoices/'+invoice.id+'/payments','POST',{amount:'150.50',method:'Card'})).status,201);const inv=(await api('/invoices')).data.find(x=>x.id===invoice.id);assert.equal(inv.paid,25050);});
  await t.test('public requests cannot read patient records',async()=>assert.equal((await api('/patients','GET',undefined,false)).status,401));
  await t.test('public booking saves request without exposing patient identity',async()=>{const r=await api('/book','POST',{name:'Public Visitor',phone:'01099999999',doctorId:doctor.id,date,time:'11:00',service:'General medicine',consent:true},false);assert.equal(r.status,201);assert.ok(r.data.reference);assert.equal(r.data.patientId,undefined);});
  await t.test('public conflicts do not create orphan patients',async()=>{const before=(await api('/patients')).data.length;assert.equal((await api('/book','POST',{name:'Another Visitor',phone:'01088888888',doctorId:doctor.id,date,time:'11:00',service:'General medicine',consent:true},false)).status,409);assert.equal((await api('/patients')).data.length,before);});
  await t.test('staff role enforced',async()=>{
   assert.equal((await api('/users','POST',{name:'Reception',username:'reception',password:'Another-password-24',role:'reception'})).status,201);
   const l=await api('/login','POST',{username:'reception',password:'Another-password-24'});const oldCookie=cookie,oldCsrf=csrf;cookie=l.headers.get('set-cookie').split(';')[0];csrf=l.data.csrf;
   assert.equal((await api('/users')).status,403);assert.equal((await api('/patients')).status,200);cookie=oldCookie;csrf=oldCsrf;
  });
  await t.test('data files are never served',async()=>{const r=await fetch(base+'/data/clinic.sqlite');assert.equal(r.status,404);});
  await t.test('audit trail records changes',async()=>assert.ok((await api('/audit')).data.length>=6));
 } finally {await app.close();await rm(dir,{recursive:true,force:true});}
});
