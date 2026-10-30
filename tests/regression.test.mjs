import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
test('exact slot validation and persistence',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nova-reg-'));let app=await createApp({dataDir:dir,port:0,initialPassword:'Regression-password-24'});await app.listen();
 const base='http://127.0.0.1:'+app.server.address().port;let cookie,csrf;
 async function call(path,method='GET',body){const r=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie||'','X-CSRF-Token':csrf||''},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),headers:r.headers};}
 try{
 const l=await call('/login','POST',{username:'admin',password:'Regression-password-24'});cookie=l.headers.get('set-cookie').split(';')[0];csrf=l.data.csrf;
 const p=(await call('/patients','POST',{name:'Regression Patient',phone:'01012345678'})).data;
 const valid={patientId:p.id,doctorId:1,date:'2030-11-04',time:'10:00',service:'General medicine'};
 for(const bad of [{time:'10:00extra'},{date:'2030-11-04 '},{time:'10:00 '},{date:''}])assert.equal((await call('/appointments','POST',{...valid,...bad})).status,400,JSON.stringify(bad));
 const a=(await call('/appointments','POST',valid)).data;
 for(const bad of [{doctorId:null},{date:''},{time:null}])assert.equal((await call('/appointments/'+a.id,'PATCH',bad)).status,400,JSON.stringify(bad));
 assert.equal((await call('/appointments')).data.length,1);
 assert.equal((await call('/backup','POST',{})).status,201);
 await app.close();app=await createApp({dataDir:dir,port:0});await app.listen();
 const r=await fetch('http://127.0.0.1:'+app.server.address().port+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'Regression-password-24'})});assert.equal(r.status,200);
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});

