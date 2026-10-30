import http from 'node:http';
import {DatabaseSync,backup} from 'node:sqlite';
import {scryptSync,randomBytes,timingSafeEqual,randomUUID} from 'node:crypto';
import {mkdir,readFile,stat} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createInterface} from 'node:readline/promises';
const ROOT=dirname(fileURLToPath(import.meta.url));
const SERVICES=['General medicine','Health checkup','Family medicine','Lab & diagnostics','Other / not sure'];
const STATUSES=['pending','confirmed','checked-in','completed','cancelled'];
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
function str(v,max=120){return typeof v==='string'?v.trim().slice(0,max):'';}
function passwordHash(p,salt=randomBytes(16).toString('hex')){return salt+':'+scryptSync(p,salt,64).toString('hex');}
function checkPassword(p,stored){const [salt,hex]=stored.split(':');return timingSafeEqual(Buffer.from(hex,'hex'),scryptSync(String(p).slice(0,256),salt,64));}
function money(v){if(!/^\d{1,7}(\.\d{1,2})?$/.test(String(v)))fail(400,'Enter a positive amount with at most two decimal places.');const n=Math.round(Number(v)*100);if(n<=0)fail(400,'Amount must be greater than zero.');return n;}
function person(b){const name=str(b.name),phone=str(b.phone,30),email=str(b.email,180),dob=str(b.dob,10);if(name.length<2||! /^\+?[\d ()-]{7,25}$/.test(phone)||phone.replace(/\D/g,'').length<7)fail(400,'Enter a full name and valid phone number.');if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Enter a valid email address.');if(dob&&(!validDate(dob)||dob>clinicToday()))fail(400,'Enter a valid date of birth.');return {name,phone,email,dob};}
function clinicToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function validDate(d){return /^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;}
function slot(date,time){if(!validDate(date)||date<clinicToday()||date.slice(0,4)>String(new Date().getFullYear()+5))fail(400,'Choose a date from today through the next five years.');if(new Date(date+'T12:00:00Z').getUTCDay()===0)fail(400,'The clinic is closed on Sunday.');if(!/^(09|1[0-9]):(00|30)$/.test(time))fail(400,'Choose a half-hour slot between 09:00 and 19:30.');if(date===clinicToday()){const now=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());if(time<=now)fail(400,'Choose a time later than now (Cairo time).');}}
export async function createApp({dataDir=join(ROOT,'data'),port=3000,initialPassword}={}){
 await mkdir(dataDir,{recursive:true});
 const db=new DatabaseSync(join(dataDir,'clinic.sqlite'));
 db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
 db.exec('CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL,active INTEGER DEFAULT 1);CREATE TABLE IF NOT EXISTS patients(id INTEGER PRIMARY KEY,name TEXT,phone TEXT,email TEXT,dob TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE IF NOT EXISTS doctors(id INTEGER PRIMARY KEY,name TEXT,specialty TEXT,active INTEGER DEFAULT 1);CREATE TABLE IF NOT EXISTS appointments(id INTEGER PRIMARY KEY,patientId INTEGER REFERENCES patients(id),doctorId INTEGER REFERENCES doctors(id),date TEXT,time TEXT,service TEXT,status TEXT DEFAULT \'pending\',reference TEXT UNIQUE,created TEXT DEFAULT CURRENT_TIMESTAMP);CREATE UNIQUE INDEX IF NOT EXISTS unique_slot ON appointments(doctorId,date,time) WHERE status != \'cancelled\';CREATE TABLE IF NOT EXISTS invoices(id INTEGER PRIMARY KEY,patientId INTEGER REFERENCES patients(id),description TEXT,total INTEGER,created TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY,invoiceId INTEGER REFERENCES invoices(id),amount INTEGER,method TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT,action TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),name TEXT,phone TEXT,email TEXT,address TEXT);');
 const get=(s,...a)=>db.prepare(s).get(...a),all=(s,...a)=>db.prepare(s).all(...a),run=(s,...a)=>db.prepare(s).run(...a);
 if(!get('SELECT id FROM users LIMIT 1')){
  if(typeof initialPassword!=='string'||initialPassword.length<12||initialPassword.length>256) {db.close();fail(400,'First run requires an administrator password of at least 12 characters.');}
  run('INSERT INTO users(name,username,password,role) VALUES(?,?,?,?)','Clinic administrator','admin',passwordHash(initialPassword),'admin');
 }
 if(!get('SELECT id FROM settings WHERE id=1')){
  run('INSERT INTO settings VALUES(1,?,?,?,?)','NovaCare Medical Center','','','');
  for(const [name,specialty] of [['Dr. Alex Morgan','General medicine'],['Dr. Karim Hassan','Family medicine'],['Dr. Omar Nabil','Health checkup']])run('INSERT INTO doctors(name,specialty) VALUES(?,?)',name,specialty);
 }
 const sessions=new Map(),limits=new Map();
 const audit=(u,action)=>run('INSERT INTO audit(actor,action) VALUES(?,?)',u?.username||'public',action);
 const patientById=id=>get('SELECT * FROM patients WHERE id=?',id);
 const invoiceList=()=>all('SELECT i.*,p.name patientName,p.phone patientPhone,COALESCE((SELECT SUM(amount) FROM payments WHERE invoiceId=i.id),0) paid FROM invoices i JOIN patients p ON p.id=i.patientId ORDER BY i.id DESC');
 const appointmentList=()=>all('SELECT a.*,p.name patientName,p.phone patientPhone,d.name doctorName FROM appointments a JOIN patients p ON p.id=a.patientId JOIN doctors d ON d.id=a.doctorId ORDER BY a.date DESC,a.time');
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');if(e.message.includes('UNIQUE constraint failed: appointments'))fail(409,'This appointment time is already taken. Choose another slot.');throw e;}}
 function createPatient(b){const p=person(b);const r=run('INSERT INTO patients(name,phone,email,dob) VALUES(?,?,?,?)',p.name,p.phone,p.email,p.dob);return patientById(Number(r.lastInsertRowid));}
 function validateAppointment(b){const doctorId=Number(b.doctorId);const d=get('SELECT * FROM doctors WHERE id=? AND active=1',doctorId);if(!d)fail(400,'Choose an active doctor.');if(typeof b.date!=='string'||typeof b.time!=='string'||b.date!==str(b.date,10)||b.time!==str(b.time,5))fail(400,'Enter an exact date and time.');slot(b.date,b.time);if(!SERVICES.includes(b.service))fail(400,'Choose a listed service.');return doctorId;}
 function addAppointment(b,patientId,status='pending'){const doctorId=validateAppointment(b);if(!patientById(patientId))fail(400,'Choose an existing patient.');const reference='NC-'+randomBytes(5).toString('hex').toUpperCase();const r=run('INSERT INTO appointments(patientId,doctorId,date,time,service,status,reference) VALUES(?,?,?,?,?,?,?)',patientId,doctorId,b.date,b.time,b.service,status,reference);return get('SELECT * FROM appointments WHERE id=?',Number(r.lastInsertRowid));}
 function limited(key,max,ms){const now=Date.now();for(const [k,v] of limits)if(v.until<now)limits.delete(k);let l=limits.get(key);if(!l){l={count:0,until:now+ms};limits.set(key,l);}if(++l.count>max)fail(429,'Too many attempts. Please try again later.');}
 const server=http.createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
   res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
   const portNow=server.address()?.port;const allowed=new Set(['127.0.0.1:'+portNow,'localhost:'+portNow]);
   if(!allowed.has(req.headers.host))fail(403,'Invalid host.');
   const url=new URL(req.url,'http://127.0.0.1'),path=url.pathname,method=req.method;
   if(!path.startsWith('/api/')){
    if(method!=='GET'&&method!=='HEAD')fail(405,'Method not allowed.');
    const files={'/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/script.js':'script.js','/admin':'admin.html','/admin.html':'admin.html','/admin.css':'admin.css','/admin.js':'admin.js'};
    let f=files[path];if(/^\/images\/[a-z0-9-]+\.(png|webp|jpg)$/.test(path))f=path.slice(1);
    if(!f){res.writeHead(404);return res.end('Not found');}
    const buffer=await readFile(join(ROOT,f));const ext=f.split('.').pop();res.setHeader('Content-Type',({html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',png:'image/png',webp:'image/webp',jpg:'image/jpeg'})[ext]);res.writeHead(200);return res.end(method==='HEAD'?undefined:buffer);
   }
   const write=!['GET','HEAD'].includes(method);
   if(write && req.headers.origin && ![...allowed].map(h=>'http://'+h).includes(req.headers.origin))fail(403,'Request origin rejected.');
   let body={};
   if(write){if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Use JSON request data.');let raw='';for await (const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>32768)fail(413,'Request too large.');}try{body=JSON.parse(raw||'{}');}catch{fail(400,'Invalid JSON.');}if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Invalid request data.');}
   const sid=(req.headers.cookie||'').match(/(?:^|;\s*)nova_session=([a-f0-9]+)/)?.[1];
   for(const [k,s] of sessions)if(s.expires<Date.now())sessions.delete(k);
   let session=sessions.get(sid),user=session&&get('SELECT id,name,username,role,active FROM users WHERE id=?',session.userId);
   if(user&&!user.active){sessions.delete(sid);user=null;}
   if(path==='/api/public'&&method==='GET')return send(200,{doctors:all('SELECT id,name,specialty FROM doctors WHERE active=1'),services:SERVICES,clinic:get('SELECT * FROM settings WHERE id=1'),today:clinicToday()});
   if(path==='/api/slots'&&method==='GET'){
    const doctorId=Number(url.searchParams.get('doctor')),date=str(url.searchParams.get('date'),10);if(!validDate(date)||!get('SELECT id FROM doctors WHERE id=? AND active=1',doctorId))fail(400,'Choose a doctor and date.');
    const used=all("SELECT time FROM appointments WHERE doctorId=? AND date=? AND status!='cancelled'",doctorId,date).map(x=>x.time);let times=[];for(let h=9;h<20;h++)for(const m of ['00','30']){const time=String(h).padStart(2,'0')+':'+m;try{slot(date,time);if(!used.includes(time))times.push(time);}catch{}}
    return send(200,{times});
   }
   if(path==='/api/login'&&method==='POST'){
    limited('login:'+req.socket.remoteAddress,25,15*60e3);
    const u=get('SELECT * FROM users WHERE username=?',str(body.username,50).toLowerCase());
    if(!u||!u.active||!checkPassword(body.password||'',u.password))fail(401,'Username or password is incorrect.');
    const id=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');sessions.set(id,{userId:u.id,csrf,expires:Date.now()+8*3600e3});res.setHeader('Set-Cookie','nova_session='+id+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800');audit(u,'Signed in');return send(200,{user:{id:u.id,name:u.name,role:u.role},csrf});
   }
   if(path==='/api/book'&&method==='POST'){
    limited('book:'+req.socket.remoteAddress,15,3600e3);if(body.consent!==true)fail(400,'Please agree to be contacted about your appointment.');
    const result=transaction(()=>{validateAppointment(body);const p=createPatient(body);const a=addAppointment(body,p.id);audit(null,'Appointment request '+a.reference);return a;});
    return send(201,{reference:result.reference,status:'pending',date:result.date,time:result.time});
   }
   if(!user)fail(401,'Sign in to access the clinic workspace.');
   if(write&&req.headers['x-csrf-token']!==session.csrf)fail(403,'Session verification failed. Refresh and try again.');
   const admin=()=>{if(user.role!=='admin')fail(403,'Administrator access required.');};
   if(path==='/api/me'&&method==='GET')return send(200,{user,csrf:session.csrf});
   if(path==='/api/logout'&&method==='POST'){sessions.delete(sid);res.setHeader('Set-Cookie','nova_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(200,{ok:true});}
   if(path==='/api/dashboard'&&method==='GET'){const today=clinicToday();return send(200,{today,patients:get('SELECT COUNT(*) n FROM patients').n,appointments:get("SELECT COUNT(*) n FROM appointments WHERE date=? AND status!='cancelled'",today).n,pending:get("SELECT COUNT(*) n FROM appointments WHERE status='pending'").n,collected:get('SELECT COALESCE(SUM(amount),0) n FROM payments').n,outstanding:get('SELECT COALESCE((SELECT SUM(total) FROM invoices),0)-COALESCE((SELECT SUM(amount) FROM payments),0) n').n,todayAppointments:appointmentList().filter(a=>a.date===today),recent:all('SELECT * FROM audit ORDER BY id DESC LIMIT 8')});}
   if(path==='/api/patients'&&method==='GET')return send(200,all('SELECT * FROM patients ORDER BY id DESC'));
   if(path==='/api/patients'&&method==='POST'){const p=createPatient(body);audit(user,'Created patient #'+p.id);return send(201,p);}
   let match=path.match(/^\/api\/patients\/(\d+)$/);
   if(match&&method==='PATCH'){const id=Number(match[1]);if(!patientById(id))fail(404,'Patient not found.');const p=person(body);run('UPDATE patients SET name=?,phone=?,email=?,dob=? WHERE id=?',p.name,p.phone,p.email,p.dob,id);audit(user,'Updated patient #'+id);return send(200,patientById(id));}
   if(path==='/api/doctors'&&method==='GET')return send(200,all('SELECT * FROM doctors ORDER BY id'));
   if(path==='/api/doctors'&&method==='POST'){admin();const name=str(body.name),specialty=str(body.specialty);if(name.length<2||!specialty)fail(400,'Enter a doctor name and specialty.');const r=run('INSERT INTO doctors(name,specialty) VALUES(?,?)',name,specialty);audit(user,'Created doctor #'+r.lastInsertRowid);return send(201,get('SELECT * FROM doctors WHERE id=?',r.lastInsertRowid));}
   match=path.match(/^\/api\/doctors\/(\d+)$/);
   if(match&&method==='PATCH'){admin();const id=Number(match[1]);if(!get('SELECT id FROM doctors WHERE id=?',id))fail(404,'Doctor not found.');if(str(body.name).length<2||!str(body.specialty))fail(400,'Enter a doctor name and specialty.');run('UPDATE doctors SET name=?,specialty=?,active=? WHERE id=?',str(body.name),str(body.specialty),body.active===false?0:1,id);audit(user,'Updated doctor #'+id);return send(200,get('SELECT * FROM doctors WHERE id=?',id));}
   if(path==='/api/appointments'&&method==='GET')return send(200,appointmentList());
   if(path==='/api/appointments'&&method==='POST'){const a=transaction(()=>addAppointment(body,Number(body.patientId),'confirmed'));audit(user,'Created appointment '+a.reference);return send(201,a);}
   match=path.match(/^\/api\/appointments\/(\d+)$/);
   if(match&&method==='PATCH'){
    const id=Number(match[1]),a=get('SELECT * FROM appointments WHERE id=?',id);if(!a)fail(404,'Appointment not found.');
    const updated={...a};for(const key of ['doctorId','date','time','status'])if(Object.hasOwn(body,key))updated[key]=body[key];if(!STATUSES.includes(updated.status))fail(400,'Choose a valid status.');
    if(a.status==='completed' && updated.status!=='completed')fail(400,'Completed appointments cannot be reopened.');
    if(a.status==='cancelled' && updated.status!=='cancelled')fail(400,'Create a new appointment to rebook a cancelled visit.');
    if(['date','time','doctorId'].some(key=>Object.hasOwn(body,key))){if(['completed','cancelled'].includes(a.status))fail(400,'This visit cannot be rescheduled.');validateAppointment(updated);}
    transaction(()=>run('UPDATE appointments SET doctorId=?,date=?,time=?,status=? WHERE id=?',updated.doctorId,updated.date,updated.time,updated.status,id));audit(user,'Updated appointment '+a.reference+' to '+updated.status);return send(200,get('SELECT * FROM appointments WHERE id=?',id));
   }
   if(path==='/api/invoices'&&method==='GET')return send(200,invoiceList());
   if(path==='/api/invoices'&&method==='POST'){const total=money(body.amount),patientId=Number(body.patientId),description=str(body.description,400);if(!patientById(patientId)||!description)fail(400,'Choose a patient and describe the charge.');const r=run('INSERT INTO invoices(patientId,description,total) VALUES(?,?,?)',patientId,description,total);audit(user,'Issued invoice #'+r.lastInsertRowid);return send(201,invoiceList().find(x=>x.id===Number(r.lastInsertRowid)));}
   match=path.match(/^\/api\/invoices\/(\d+)\/payments$/);
   if(match&&method==='GET')return send(200,all('SELECT * FROM payments WHERE invoiceId=? ORDER BY id',Number(match[1])));
   if(match&&method==='POST'){const id=Number(match[1]),amount=money(body.amount);if(!['Cash','Card','Bank transfer'].includes(body.method))fail(400,'Choose a payment method.');transaction(()=>{const i=invoiceList().find(x=>x.id===id);if(!i)fail(404,'Invoice not found.');if(amount>i.total-i.paid)fail(400,'Payment exceeds the outstanding balance.');run('INSERT INTO payments(invoiceId,amount,method) VALUES(?,?,?)',id,amount,body.method);audit(user,'Recorded payment on invoice #'+id);});return send(201,{ok:true});}
   if(path==='/api/settings'&&method==='GET')return send(200,get('SELECT * FROM settings WHERE id=1'));
   if(path==='/api/settings'&&method==='PATCH'){admin();const name=str(body.name);if(name.length<2)fail(400,'Enter the clinic name.');const phone=str(body.phone,30),email=str(body.email,180);if(phone&&!/^\+?[\d ()-]{7,25}$/.test(phone))fail(400,'Enter a valid clinic phone.');if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Enter a valid email.');run('UPDATE settings SET name=?,phone=?,email=?,address=? WHERE id=1',name,phone,email,str(body.address,300));audit(user,'Updated clinic settings');return send(200,{ok:true});}
   if(path==='/api/users'&&method==='GET'){admin();return send(200,all('SELECT id,name,username,role,active FROM users ORDER BY id'));}
   if(path==='/api/users'&&method==='POST'){admin();const name=str(body.name),username=str(body.username,50).toLowerCase();if(name.length<2||!/^[a-z0-9_.-]{3,50}$/.test(username)||typeof body.password!=='string'||body.password.length<12||body.password.length>256||!['admin','reception'].includes(body.role))fail(400,'Use a name, valid username, role, and a password of 12–256 characters.');if(get('SELECT id FROM users WHERE username=?',username))fail(409,'Username already exists.');run('INSERT INTO users(name,username,password,role) VALUES(?,?,?,?)',name,username,passwordHash(body.password),body.role);audit(user,'Created staff account '+username);return send(201,{ok:true});}
   match=path.match(/^\/api\/users\/(\d+)$/);
   if(match&&method==='PATCH'){admin();const id=Number(match[1]);if(id===user.id)fail(400,'You cannot deactivate your current account.');if(!get('SELECT id FROM users WHERE id=?',id))fail(404,'Account not found.');run('UPDATE users SET active=? WHERE id=?',body.active===false?0:1,id);for(const [key,s]of sessions)if(s.userId===id)sessions.delete(key);audit(user,'Updated staff account #'+id);return send(200,{ok:true});}
   if(path==='/api/password'&&method==='POST'){const u=get('SELECT * FROM users WHERE id=?',user.id);if(!checkPassword(body.current||'',u.password))fail(400,'Current password is incorrect.');if(typeof body.password!=='string'||body.password.length<12||body.password.length>256)fail(400,'Use a password of 12–256 characters.');run('UPDATE users SET password=? WHERE id=?',passwordHash(body.password),user.id);for(const[k,s]of sessions)if(s.userId===user.id&&k!==sid)sessions.delete(k);audit(user,'Changed password');return send(200,{ok:true});}
   if(path==='/api/audit'&&method==='GET'){admin();return send(200,all('SELECT * FROM audit ORDER BY id DESC LIMIT 300'));}
   if(path==='/api/backup'&&method==='POST'){admin();const name='novacare-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite';await mkdir(join(dataDir,'backups'),{recursive:true});await backup(db,join(dataDir,'backups',name));audit(user,'Created local backup');return send(201,{name});}
   fail(404,'Endpoint not found.');
  }catch(e){if(!res.headersSent)send(e.status||500,{error:e.status?e.message:'Could not complete this request. Try again.'});else res.end();}
 });
 return {server,listen:()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);}),close:async()=>{await new Promise(resolve=>server.close(resolve));db.close();}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const dataDir=process.env.NOVACARE_DATA_DIR||join(ROOT,'data');let initialPassword=process.env.NOVACARE_ADMIN_PASSWORD;
 let initialized=false;try{const probe=new DatabaseSync(join(dataDir,'clinic.sqlite'),{readOnly:true});try{initialized=Boolean(probe.prepare('SELECT id FROM users LIMIT 1').get());}finally{probe.close();}}catch{}
 if(!initialized){
  if(!initialPassword){const rl=createInterface({input:process.stdin,output:process.stdout});console.log('\nNovaCare first-time setup. Username: admin\nSet an administrator password (at least 12 characters). Input is visible in this terminal.');initialPassword=await rl.question('New password: ');rl.close();}
 }
 try{const app=await createApp({dataDir,port:Number(process.env.PORT)||3000,initialPassword});await app.listen();console.log('\nNovaCare is ready: http://127.0.0.1:'+app.server.address().port+'\nStaff workspace: http://127.0.0.1:'+app.server.address().port+'/admin\nKeep this window open. Press Ctrl+C to stop.');process.on('SIGINT',async()=>{await app.close();process.exit(0);});}catch(e){console.error(e.message);process.exitCode=1;}
}

