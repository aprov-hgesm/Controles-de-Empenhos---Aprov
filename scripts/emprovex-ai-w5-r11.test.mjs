#!/usr/bin/env node
/** W5 R1.1: independent, offline P1/P2 reproduction regressions. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import ts from 'typescript';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const nativeRequire=createRequire(import.meta.url);
function load(path,mocks={},cache=new Map()){
 const full=resolve(root,path);
 if(cache.has(full))return cache.get(full).exports;
 if(!existsSync(full))throw Error('Unexpected local dependency '+full);
 const mod={exports:{}};cache.set(full,mod);
 const source=readFileSync(full,'utf8');
 const js=ts.transpileModule(source,{fileName:full,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true
 }}).outputText;
 const importer=id=>{
  if(Object.prototype.hasOwnProperty.call(mocks,id))return mocks[id];
  if(id.startsWith('.')){
   const p=resolve(dirname(full),id),candidate=extname(p)?p:p+'.ts';
   if(extname(p)==='.json')return nativeRequire(p);
   return load(existsSync(candidate)?candidate:resolve(p,'index.ts'),mocks,cache);
  }
  return nativeRequire(id);
 };
 new Function('require','module','exports','process','Buffer',js)(importer,mod,mod.exports,process,Buffer);
 return mod.exports;
}
const now=new Date('2026-10-31T14:00:00Z');
const scope={sessionId:'r11-fixture',workspaceId:'synthetic-tenant'};
const {interpret}=nativeRequire('../.w4-dist/index.cjs');
const query=(message)=>interpret({message,now,scope});
test('P1-A statuses of invoices, documents, schedules and warehouse must not lose filters',()=>{
 const unsupported=[
  'Quais NFs cadastradas ontem que já foram pagas?',
  'Quais NFs cadastradas ontem que não foram pagas?',
  'Quais NFs cadastradas ontem liquidadas?',
  'Quais NFs cadastradas ontem não liquidadas?',
  'Quais NFs cadastradas ontem pendentes?',
  'Quais NFs cadastradas ontem atrasadas?',
  'Quais NFs cadastradas ontem entregues?',
  'Quais NFs cadastradas ontem não entregues?',
  'Quais NFs cadastradas ontem recebidas?',
  'Quais NFs cadastradas ontem não recebidas?',
  'Quais NFs cadastradas ontem concluídas?',
  'Quais NFs cadastradas ontem canceladas?',
  'Quais NFs cadastradas ontem parcialmente atendidas?',
  'Quais NFs cadastradas ontem em aberto?',
  'Quais NFs cadastradas ontem vencidas?',
  'Quando enviamos cronogramas pendentes da NE 2026NE66?',
  'Mostre a NE 2026NE66 se estiver cancelada.',
  'Quanto arroz temos no almoxarifado apenas de materiais vencidos?'
 ];
 for(const message of unsupported){
  const result=query(message);
  assert.notEqual(result.route,'DETERMINISTIC',message);
  assert.equal(result.query,undefined,message);
 }
 for(const [message,intent] of [
  ['Quais NFs foram cadastradas ontem?','invoice_registration_period_list'],
  ['Quanto arroz temos?','warehouse_stock_get'],
  ['Onde está o arroz?','warehouse_material_locations_list'],
  ['Quanto resta da NE 2026NE66?','commitment_total_balance']
 ]){
  assert.equal(query(message).query?.intent,intent,message);
 }
});
test('P1-B physical constraints never downgrade to aggregate stock or global locations',()=>{
 const protectedMessages=[
  'Quanto arroz temos no almoxarifado?',
  'Quanto arroz temos na estante 12?',
  'Quanto arroz temos no depósito de secos?',
  'Quanto arroz temos no depósito de gêneros?',
  'Quanto arroz temos no estoque central?',
  'Quanto arroz temos na área de recebimento?',
  'Quanto arroz temos na área de armazenamento?',
  'Quanto arroz temos na geladeira?',
  'Quanto arroz temos no freezer?',
  'Quanto arroz temos na prateleira 2?',
  'Quanto arroz temos na posição P03?',
  'Quanto arroz temos na sala de dietética?',
  'Quanto arroz temos no setor físico 1?',
  'Quanto arroz temos no local de armazenagem?',
  'Onde está o arroz na câmara fria?',
  'Onde está o arroz no almoxarifado?'
 ];
 for(const message of protectedMessages){
  const result=query(message);
  assert.equal(result.query,undefined,message);
  assert.ok(['UNSUPPORTED','CLARIFY'].includes(result.route),message+': '+result.route);
 }
});
const {presentAiResponse}=load('lib/emprovex-ai/integration/response.ts');
function response(intent,data,extra={}){
 return {version:'emprovex.ai.response.v1',status:'ok',intent,
  contract:'synthetic-v1',data,filters:{},evidence:[],
  coverage:'complete',asOf:'2026-10-31T14:00:00.000Z',
  limitations:[],pagination:{nextCursor:null,truncated:false},
  metrics:{durationMs:0,examinedDocuments:0},...extra};
}
test('P1-C no presentational silent truncation of invoice lists at 1,5,6,10,20',()=>{
 for(const count of [1,5,6,10,20]){
  const data=Array.from({length:count},(_,i)=>({
   recordKey:'k'+(i+1),number:'NF'+String(i+1),registeredAt:'2026-10-30T15:00:00.000Z'}));
  const rendered=presentAiResponse(response('invoice_registration_period_list',data));
  const shown=[...rendered.matchAll(/\bNF\d+\b/g)].map(m=>m[0]);
  assert.equal(shown.length,count,JSON.stringify({count,rendered}));
  assert.ok(shown.includes('NF'+count));
 }
});
test('P1-C schedule, previous-year commitments, supplier contacts, warehouse locations all shown',()=>{
 const six=Array.from({length:6},(_,i)=>i+1);
 for(const [intent,data,expected] of [
  ['schedule_sent_history_list',six.map(i=>({commitmentId:'2026NE'+i,sentAt:'2026-10-30'})),'NE 2026NE6'],
  ['commitment_previous_open_list',six.map(i=>({commitmentId:'2025NE'+i,operationalBalance:i})),'2025NE6'],
  ['supplier_contact_find',six.map(i=>({legalName:'Fornecedor'+i,email:'mail'+i+'@test.invalid'})),'Fornecedor6'],
  ['warehouse_material_locations_list',{locations:six.map(i=>({
   depot:{name:'Deposito'+i},shelf:{name:'Estante'+i},quantity:i,unit:'kg'}))},'Deposito6']
 ]){
  const rendered=presentAiResponse(response(intent,data));
  assert.ok(rendered.includes(expected),intent+': '+rendered);
 }
});
test('P1-C W3 pagination, incomplete/unknown coverage, empty data remain explicit',()=>{
 const notes=[{number:'NF01',registeredAt:'2026-10-30'}];
 const page=presentAiResponse(response('invoice_registration_period_list',notes,{
  status:'partial',coverage:'incomplete',pagination:{nextCursor:'synthetic-cursor',truncated:true}
 }));
 assert.match(page,/mais registros/i);assert.match(page,/cobertura parcial/i);
 const unknown=presentAiResponse(response('invoice_registration_period_list',notes,{coverage:'unknown'}));
 assert.match(unknown,/nao comprovada|não comprovada/i);
 const empty=presentAiResponse(response('invoice_registration_period_list',[],{status:'empty'}));
 assert.match(empty,/Nenhum registro localizado/i);
});
const financeResponse=load('lib/emprovex-ai/response.ts');
let fixtureItems=[];
const finMocks={
 './reader':{
  coreOperationalDocument:async()=>({id:'2026NE66',data:{items:fixtureItems}}),
  coreOperationalQuery:async()=>({rows:[],truncated:false,examined:0}),
  coreDocument:async()=>null
 },
 './response':financeResponse,
 '../../features/empenhos/domain/empenhoExercise':{getEmpenhoExerciseYear:()=>2026},
 './cursor':{parseAiCursor:()=>null,makeAiCursor:()=>null},
 './period':{operationalMidnightUtc:()=>''}
};
const {executeFinancial}=load('lib/emprovex-ai/financial.ts',finMocks);
const access={uid:'synthetic-uid',workspaceId:'synthetic-tenant',ug:'160416',googleToken:'not-a-token',email:'fixture@example.test'};
const financialQuery={version:'emprovex.ai.query.v1',intent:'commitment_total_balance',params:{commitmentId:'2026NE66'}};
const item=(quantity,received,unitPrice)=>({id:'i1',name:'Arroz',unit:'kg',quantity,received,unitPrice});
test('P2 financial balance: valid quantity, exact receipt, partial receipt, overreceipt, invalid and legacy',async()=>{
 for(const [quantity,received,unitPrice,expected] of [
  [100,60,10,400],[100,100,10,0],[100,0,10,1000],[100,50,12.5,625]
 ]){
  fixtureItems=[item(quantity,received,unitPrice)];
  const r=await executeFinancial(access,financialQuery);
  assert.equal(r.data.operationalBalance,expected);
 }
 for(const [quantity,received,unitPrice] of [
  [100,120,10],[-1,0,10],[100,-1,10],[100,0,-10],[100,0,NaN],
  [100,undefined,10]
 ]){
  fixtureItems=[item(quantity,received,unitPrice)];
  await assert.rejects(()=>executeFinancial(access,financialQuery),
   e=>e.code==='AI_COMMITMENT_ITEM_INTEGRITY'||e.code==='AI_INVALID_FINANCIAL_NUMBER');
 }
 fixtureItems=[item(100,20,10),{id:'i2',name:'Feijão',unit:'kg',quantity:50,received:10,unitPrice:5}];
 const combined=await executeFinancial(access,financialQuery);
 assert.equal(combined.data.operationalBalance,1000);
 assert.equal(combined.data.itemsWithBalance,2);
});
const project='demo-emprovex-security';
const claims={iss:'https://securetoken.google.com/'+project,aud:project,
 sub:'synthetic-uid',exp:Math.floor(Date.now()/1000)+120,
 email:'fixture@example.test',email_verified:true,firebase:{sign_in_provider:'password'}};
let verifiedSignatures=0,decodedUnsigned=0;
const authMocks={
 'jose':{
  createRemoteJWKSet:()=>({synthetic:true}),
  decodeJwt:token=>{decodedUnsigned++;if(token==='unsigned')return claims;throw Error('bad jwt')},
  jwtVerify:async token=>{verifiedSignatures++;if(token!=='signed-valid')throw Error('invalid signature');
   return {payload:{...claims,iss:'https://securetoken.google.com/real-project',aud:'real-project'}};}
 },
 '../../firebase-applet-config.json':{projectId:'real-project'},
 '../hgesmWorkspace':{HGESM_SECTOR_EMAIL:'founder@example.test'},
 '../platformIdentity':{normalizePlatformEmail:s=>s.toLowerCase(),isFounderSignInProvider:()=>false}
};
const {verifyFirebaseRequest}=load('lib/server/firebaseFounderAuth.ts',authMocks);
const envKeep={...process.env},argvKeep=[...process.argv];
function local(){
 process.env.NODE_ENV='development';
 process.env.EMPROVEX_E2E_SERVER_AUTH='1';
 process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
 process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID=project;
 process.env.NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS='1';
 for(const k of ['VERCEL','VERCEL_ENV','K_SERVICE','K_REVISION','K_CONFIGURATION','GAE_SERVICE',
  'KUBERNETES_SERVICE_HOST','FUNCTION_TARGET','AWS_EXECUTION_ENV','WEBSITE_SITE_NAME','RENDER','FLY_APP_NAME'])delete process.env[k];
 process.argv=[argvKeep[0],'node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3100'];
}
test('P1-D local emulator only, signed valid/invalid and hosted flags reject unsigned JWT',async()=>{
 try{
  local();
  let v=await verifyFirebaseRequest('Bearer unsigned');
  assert.equal(v.uid,'synthetic-uid');
  assert.equal(decodedUnsigned,1);
  for(const changes of [
   {VERCEL:'1',VERCEL_ENV:'preview'},
   {VERCEL:'1',VERCEL_ENV:'production'},
   {K_SERVICE:'cloudrun-staging'},
   {K_SERVICE:'cloudrun-production'},
   {GAE_SERVICE:'app'},
   {KUBERNETES_SERVICE_HOST:'10.0.0.1'},
   {VERCEL_ENV:'preview',K_SERVICE:'cloudrun'},
   {EMPROVEX_E2E_SERVER_AUTH:'0'},
   {NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS:'0'},
   {NODE_ENV:'production'},
  ]){
   local();Object.assign(process.env,changes);
   await assert.rejects(()=>verifyFirebaseRequest('Bearer unsigned'),e=>e.status===401);
  }
  local();process.argv=[argvKeep[0],'node_modules/next/dist/bin/next','start'];
  await assert.rejects(()=>verifyFirebaseRequest('Bearer unsigned'),e=>e.status===401);
  local();process.argv=[argvKeep[0],'node_modules/next/dist/bin/next','dev','--hostname','0.0.0.0'];
  await assert.rejects(()=>verifyFirebaseRequest('Bearer unsigned'),e=>e.status===401);
  local();process.argv=[...argvKeep];
  await assert.rejects(()=>verifyFirebaseRequest('Bearer unsigned'),e=>e.status===401);
  local();
  process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';
  process.argv=[argvKeep[0],'scripts/core-lean-r2-w5-transactions.mjs'];
  assert.equal((await verifyFirebaseRequest('Bearer unsigned')).uid,'synthetic-uid');
  process.argv=[argvKeep[0],'/tmp/isolated/scripts/core-lean-r2-w5-transactions.mjs'];
  assert.equal((await verifyFirebaseRequest('Bearer unsigned')).uid,'synthetic-uid');
  process.argv=[argvKeep[0],'scripts/core-lean-r2-w4-authz-mobile.integration.mjs'];
  assert.equal((await verifyFirebaseRequest('Bearer unsigned')).uid,'synthetic-uid');
  process.argv=[argvKeep[0],'scripts/unknown-server.mjs'];
  await assert.rejects(()=>verifyFirebaseRequest('Bearer unsigned'),e=>e.status===401);
  process.argv=[argvKeep[0],'scripts/core-lean-r2-w5-transactions.mjs'];
  process.env.K_SERVICE='cloudrun-staging';
  await assert.rejects(()=>verifyFirebaseRequest('Bearer unsigned'),e=>e.status===401);
  process.env.K_SERVICE='';
  process.env.NODE_ENV='production';
  await assert.rejects(()=>verifyFirebaseRequest('Bearer unsigned'),e=>e.status===401);
  local();process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9098';
  await assert.rejects(()=>verifyFirebaseRequest('Bearer unsigned'),e=>e.status===401);
  local();process.env.EMPROVEX_E2E_SERVER_AUTH='0';
  const signed=await verifyFirebaseRequest('Bearer signed-valid');
  assert.equal(signed.uid,'synthetic-uid');
  await assert.rejects(()=>verifyFirebaseRequest('Bearer invalid'),e=>e.status===401);
  assert.ok(verifiedSignatures>=10,'hosted paths must verify signature');
 }finally {
  for(const k of Object.keys(process.env))if(!(k in envKeep))delete process.env[k];
  Object.assign(process.env,envKeep);process.argv=argvKeep;
 }
});
