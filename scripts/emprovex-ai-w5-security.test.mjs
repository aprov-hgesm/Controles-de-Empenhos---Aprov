#!/usr/bin/env node
/** HTTP, authenticated-context and deployment-gate synthetic tests. No cloud I/O. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url),cache=new Map();
const oldEnv={...process.env};
process.env.EMPROVEX_AI_W45_CONTEXT_SECRET='w5-only-synthetic-hmac-encryption-012345678901';
function load(path,mocks={}){
 const full=resolve(root,path);
 if(cache.has(full))return cache.get(full).exports;
 if(!existsSync(full))throw Error('Unexpected source '+full);
 const mod={exports:{}};cache.set(full,mod);
 const js=ts.transpileModule(readFileSync(full,'utf8'),{fileName:full,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const importer=id=>{
  if(Object.prototype.hasOwnProperty.call(mocks,id))return mocks[id];
  if(id.startsWith('.')){
   const base=resolve(dirname(full),id),candidate=extname(base)?base:base+'.ts';
   return load(existsSync(candidate)?candidate:resolve(base,'index.ts'),mocks);
  }
  return require(id);
 };
 new Function('require','module','exports','process','Buffer',js)(importer,mod,mod.exports,process,Buffer);
 return mod.exports;
}
const env=load('lib/emprovex-ai/integration/environment.ts');
const session=load('lib/emprovex-ai/integration/session.ts');
const at=Date.parse('2026-10-31T12:00:00Z');
function preview(){
 process.env.VERCEL='1';process.env.VERCEL_ENV='preview';
 process.env.EMPROVEX_AI_W45_ENABLED='1';
 delete process.env.K_SERVICE;delete process.env.K_REVISION;delete process.env.K_CONFIGURATION;
}
test('W5 deployment gate: default/production/Cloud Run/contradictory settings fail closed',()=>{
 const enabled={EMPROVEX_AI_W45_ENABLED:'1',VERCEL:'1',VERCEL_ENV:'preview'};
 assert.equal(env.aiExperimentalEnabled(enabled),true);
 for(const value of [
  {},{...enabled,EMPROVEX_AI_W45_ENABLED:'0'},
  {...enabled,VERCEL_ENV:'production'},
  {...enabled,VERCEL_ENV:'development'},
  {...enabled,VERCEL:'0'},
  {EMPROVEX_AI_W45_ENABLED:'1'},
  {EMPROVEX_AI_W45_ENABLED:'1',K_SERVICE:'emprovex-prod',K_REVISION:'revision'},
  {...enabled,K_SERVICE:'emprovex-staging'},
  {EMPROVEX_AI_W45_ENABLED:'1',VERCEL_ENV:'preview'}
 ])assert.equal(env.aiExperimentalEnabled(value),false,JSON.stringify(value));
});
test('W5 HMAC and AES-GCM: encrypted contextual references, user/workspace/session isolation',()=>{
 const a=session.sessionForRequest(undefined,'uid-a','ws-a',at);
 const refs={materialQuery:'arroz',commitmentId:'2026NE66'};
 const token=session.sealContext({sessionId:a.session.sid,workspaceId:'ws-a',updatedAt:at,refs},a.session,at);
 const raw=Buffer.from(token.split('.')[0],'base64url').toString('utf8');
 for(const secret of ['arroz','uid-a','2026NE66','ws-a'])assert.ok(!raw.includes(secret),'context not plaintext');
 assert.deepEqual(session.restoreContext(token,a.session,at).refs,refs);
 assert.equal(session.restoreContext(token,a.session,at+600001),undefined);
 const b=session.sessionForRequest(undefined,'uid-b','ws-b',at);
 assert.throws(()=>session.restoreContext(token,b.session,at),/AI_CONTEXT_FORBIDDEN/);
 const altered=token.slice(0,-2)+'AA';
 assert.throws(()=>session.restoreContext(altered,a.session,at),/AI_CONTEXT_FORBIDDEN/);
 const rotated=session.sessionForRequest(undefined,'uid-a','ws-a',at);
 assert.throws(()=>session.restoreContext(token,rotated.session,at),/AI_CONTEXT_FORBIDDEN/);
 assert.ok(session.sessionForRequest(a.cookie,'uid-a','ws-a',at).newCookie===false);
 assert.ok(session.sessionForRequest(a.cookie,'uid-a','ws-b',at).newCookie===true);
});
class FakeFounderAuthError extends Error {status=401;}
const calls=[];
const fakeNext={NextResponse:{json:(body,options)=>({
 body,status:options?.status||200,headers:options?.headers||{},
 cookie:null,cookies:{set(name,value,attributes){this.written={name,value,attributes};}}
})}};
const mocks={
 'next/server':fakeNext,
 '../authorize':{prepareAiAccess:async token=>{
   if(token!=='Bearer TEST')throw new FakeFounderAuthError('AUTH_INVALID');
   return {uid:'synthetic-uid',email:'fixture@example.test',workspaceId:'workspace-synthetic',
    ug:'160416',googleToken:'synthetic-only'};
 }},
 '../query':{executeAuthorizedAiQuery:async(access,query)=>{
  calls.push({workspace:access.workspaceId,query});
  return {version:'emprovex.ai.response.v1',status:'ok',intent:query.intent,
   contract:'warehouse.stock.get.v1',data:{description:'arroz',quantity:5,unit:{code:'kg'}},
   coverage:'complete',limitations:[],filters:query.params,asOf:new Date(at).toISOString(),
   evidence:[{source:'synthetic',documentId:'fixture'}],pagination:null,
   metrics:{durationMs:0,examinedDocuments:1}};
 }},
 '../../../../lib/server/firebaseFounderAuth':{FounderAuthError:FakeFounderAuthError}
};
const askRoute=load('app/api/emprovex-ai/ask/route.ts',mocks);
function request(body,token='Bearer TEST',cookie){
 return {headers:{get:name=>name==='authorization'?token:
   name==='content-length'?String(body.length):null},
  text:async()=>body,cookies:{get:name=>cookie?{value:cookie}:undefined}};
}
test('W5 HTTP ask: disabled 404; malformed/oversized/foreign fields rejected without W3 calls',async()=>{
 delete process.env.EMPROVEX_AI_W45_ENABLED;
 let result=await askRoute.POST(request('{"message":"Quanto arroz temos?"}'));
 assert.equal(result.status,404);assert.equal(calls.length,0);
 preview();
 result=await askRoute.POST(request('???'));
 assert.equal(result.status,400);
 result=await askRoute.POST(request(JSON.stringify({message:'Quanto arroz temos?',workspaceId:'other'})));
 assert.equal(result.status,400);
 result=await askRoute.POST(request(JSON.stringify({message:'a'.repeat(9000)})));
 assert.equal(result.status,413);
 assert.equal(calls.length,0);
});
test('W5 HTTP ask: real interpreter/parser, scoped synthetic query, follow-up and auth errors',async()=>{
 preview();
 const first=await askRoute.POST(request(JSON.stringify({message:'Quanto arroz temos?'})));
 assert.equal(first.status,200,JSON.stringify(first.body));
 assert.equal(first.body.query.intent,'warehouse_stock_get');
 assert.equal(first.body.query.params.materialQuery,'arroz');
 assert.equal(calls.length,1);
 assert.equal(calls[0].workspace,'workspace-synthetic');
 assert.ok(first.body.contextToken);
 assert.ok(first.cookies.written.value);
 const second=await askRoute.POST(request(JSON.stringify({message:'E quanto temos?',contextToken:first.body.contextToken}),
  'Bearer TEST',first.cookies.written.value));
 assert.equal(second.status,200);
 assert.equal(second.body.query.params.materialQuery,'arroz');
 const crossSession=await askRoute.POST(request(JSON.stringify({message:'E quanto temos?',contextToken:first.body.contextToken})));
 assert.equal(crossSession.status,403);
 const unauthorized=await askRoute.POST(request(JSON.stringify({message:'Quanto arroz temos?'}),'Bearer BAD'));
 assert.equal(unauthorized.status,401);
});
test('W5 HTTP ask: correction can update context without querying W3',async()=>{
 preview();
 const start=await askRoute.POST(request(JSON.stringify({message:'Onde está o arroz?'})));
 const count=calls.length;
 const correction=await askRoute.POST(request(JSON.stringify({message:'Na verdade, eu quis dizer feijão.',contextToken:start.body.contextToken}),
  'Bearer TEST',start.cookies.written.value));
 assert.equal(correction.body.status,'clarify');
 assert.equal(calls.length,count,'correction is not a query');
 assert.ok(correction.body.contextToken);
 const followup=await askRoute.POST(request(JSON.stringify({message:'E quanto temos?',contextToken:correction.body.contextToken}),
  'Bearer TEST',start.cookies.written.value));
 assert.equal(followup.body.query.params.materialQuery,'feijao');
});
process.on('exit',()=>{for(const name of ['EMPROVEX_AI_W45_CONTEXT_SECRET','EMPROVEX_AI_W45_ENABLED','VERCEL','VERCEL_ENV','K_SERVICE','K_REVISION','K_CONFIGURATION']){
 if(oldEnv[name]===undefined)delete process.env[name];else process.env[name]=oldEnv[name];
}});
