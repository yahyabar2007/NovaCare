import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server.mjs';
test('first-run setup recovers after short password',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nova-setup-'));
 try{
  await assert.rejects(createApp({dataDir:dir,port:0,initialPassword:'short'}));
  const env={...process.env,NOVACARE_DATA_DIR:dir,PORT:'43829'};delete env.NOVACARE_ADMIN_PASSWORD;
  const child=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url))],{env,stdio:['pipe','pipe','pipe']});
  let output='',prompted=false;
  try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Setup timed out: '+output)),10000);child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('New password:')&&!prompted){prompted=true;child.stdin.write('Recovered-password-24\n');}if(output.includes('NovaCare is ready:')){clearTimeout(timer);resolve();}});child.stderr.on('data',x=>output+=x);child.once('exit',code=>{clearTimeout(timer);reject(new Error('Exited before ready: '+code+' '+output));});});assert.ok(prompted);}
  finally{child.kill();await new Promise(r=>child.once('exit',r));}
  const app=await createApp({dataDir:dir,port:0});await app.listen();await app.close();
 }finally{await rm(dir,{recursive:true,force:true});}
});

