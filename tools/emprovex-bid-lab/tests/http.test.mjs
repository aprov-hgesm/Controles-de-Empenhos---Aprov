import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
test('local server exposes only lab assets and rejects writes',async()=>{
 const child=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url))],{stdio:['ignore','pipe','pipe']});
 try{
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('SERVER_EXIT');}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('START_TIMEOUT')),5000);t.unref();})]);
  for(const path of ['/','/portal.mjs','/engine.mjs']){const r=await fetch('http://127.0.0.1:8790'+path);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.ok((await r.text()).length>100);}
  assert.equal((await fetch('http://127.0.0.1:8790/package.json')).status,404);
  assert.equal((await fetch('http://127.0.0.1:8790/',{method:'POST'})).status,403);
 }finally{child.kill();await once(child,'exit');}
});
