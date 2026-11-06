/** W6 API throttle and guard contract tests: no production network I/O. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('./http.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,
  target:ts.ScriptTarget.ES2022}}).outputText;
class PurchaseError extends Error{constructor(code,status){super(code);this.code=code;this.status=status;}}
let calls=0,allow=true;
const context={companyId:'companyA',uid:'ownerA'};
const exports={};
runInNewContext(code,{
  exports,require(id){
    if(id==='next/server')return{NextResponse:{json:(x,init)=>Response.json(x,init)}};
    if(id==='../../server/companyAuthz')return{
      requireCompanyContext:async()=>{calls++;if(!allow)throw Error('DENIED');return context;},
      companyErrorStatus:()=>403
    };
    if(id==='./domain')return{PurchaseError};
    throw Error('Unexpected import '+id);
  },Date,Map,Promise,Buffer,Request,Response,URL,console,
},{filename:'lib/company/purchases/http.ts'});
test('W6: limite 30/UID/empresa/minuto, bloqueio 429 e renovação da janela',()=>{
  const ctx={companyId:'tenant-limit-A',uid:'user-limit-A'};
  const now=Date.parse('2026-11-05T12:00:00Z');
  for(let n=0;n<30;n++)assert.doesNotThrow(()=>exports.throttle(ctx,now));
  assert.throws(()=>exports.throttle(ctx,now),e=>e.status===429&&e.code==='RATE_LIMITED');
  assert.doesNotThrow(()=>exports.throttle(ctx,now+60001));
  assert.doesNotThrow(()=>exports.throttle({...ctx,companyId:'tenant-limit-B'},now));
});
test('W6: guard obrigatório antes de permitir operação (falha fechada)',async()=>{
  allow=false;const prior=calls;
  await assert.rejects(exports.authorize(new Request('http://localhost/api/company/purchases'),'purchaseOrders:write'),
    e=>e.message==='DENIED');
  assert.equal(calls,prior+1);
  allow=true;
});
test('W6: corpo não aceita MIME incorreto ou payload acima 64 KiB',async()=>{
  const valid=await exports.body(new Request('http://localhost',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({sourceSupplierId:'sup_a'})}));
  assert.equal(valid.sourceSupplierId,'sup_a');
  await assert.rejects(exports.body(new Request('http://localhost',{method:'POST',
    headers:{'content-type':'text/plain'},body:'x'})),e=>e.status===400);
  await assert.rejects(exports.body(new Request('http://localhost',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({big:'x'.repeat(66000)})})),
    e=>e.code==='BODY_TOO_LARGE');
});
