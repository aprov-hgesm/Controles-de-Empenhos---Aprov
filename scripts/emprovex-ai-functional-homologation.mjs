#!/usr/bin/env node
/**
 * EMPROVEX AI functional homologation:
 * real Firebase Auth Emulator user/password sessions + Firestore Emulator REST
 * reads + actual W4 interpreter, W3 contracts/authorizer/calculators/Warehouse.
 * No production IAM: only getGoogleAccessToken is replaced by an inert demo token.
 * The core REST transport is redirected exclusively to 127.0.0.1:8080.
 * Warehouse uses the existing server-only emulator adapter at 127.0.0.1:8081.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {warehouseEmulatorLaunch} from './warehouse-emulator-launch.mjs';

const PROJECT='demo-emprovex-security',HOST='127.0.0.1';
const CORE='http://127.0.0.1:8080/v1/projects/'+PROJECT+'/databases/(default)/documents';
const WAREHOUSE='http://127.0.0.1:8081/v1/projects/'+PROJECT+'/databases/emprovex-warehouse/documents';
const AUTH='http://127.0.0.1:9099';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const fakeConfig={projectId:PROJECT,firestoreDatabaseId:'(default)',apiKey:'fake-api-key'};
const scopes=[{ws:'sector-ai-a',ug:'160416',email:'ai-a@example.test',received:2,qty:48},
 {ws:'sector-ai-b',ug:'160417',email:'ai-b@example.test',received:9,qty:7}];
const ids={material:'mat_'+'a'.repeat(32),depot:'dep_'+'b'.repeat(32),location:'loc_'+'c'.repeat(32)};
const actualFetch=globalThis.fetch;
const counts={emulatorReads:0,emulatorWrites:0,blockedRemote:0,aiWrites:0,questions:0};
let testPhase=false,warehouseProcess;
function ensureDemo(){
 if(process.env.GOOGLE_CLOUD_PROJECT!==PROJECT
   ||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'
   ||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099'
   ||process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR!=='1'
   ||process.env.EMPROVEX_E2E_WAREHOUSE_FIRESTORE_PORT!=='8081'
   ||process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID!==PROJECT
   ||process.env.EMPROVEX_E2E_SERVER_AUTH!=='1'
   ||process.env.NODE_ENV==='production'
   ||process.env.VERCEL||process.env.VERCEL_ENV||process.env.K_SERVICE
   ||process.env.GOOGLE_APPLICATION_CREDENTIALS||process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON)
   throw Error('AI_HOMOLOGATION_REQUIRES_ISOLATED_LOCAL_DEMO_EMULATORS');
}
ensureDemo();
const controlledRemote='https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/(default)/documents';
globalThis.fetch=async (input,init={})=>{
 let url=String(input),options={...init},method=(options.method||'GET').toUpperCase();
 if(url.startsWith(controlledRemote)){
   url=CORE+url.slice(controlledRemote.length);
   options={...options,headers:{...(options.headers||{}),authorization:'Bearer owner'}};
 }
 const safe=url.startsWith(CORE)||url.startsWith(WAREHOUSE)
   ||url.startsWith(AUTH+'/')||url.startsWith('http://localhost:9099/');
 if(!safe){counts.blockedRemote++;throw Error('AI_HOMOLOGATION_REMOTE_IO_FORBIDDEN');}
 if((url.startsWith(CORE)||url.startsWith(WAREHOUSE))&&testPhase){
   if(!['GET','POST'].includes(method)
       ||(method==='POST'&&!(/:runQuery$|:batchGet$/.test(url)))){
     counts.aiWrites++;throw Error('AI_HOMOLOGATION_OPERATIONAL_WRITE_DENIED');
   }
   counts.emulatorReads++;
 }else if((url.startsWith(CORE)||url.startsWith(WAREHOUSE))&&['PATCH','DELETE','PUT'].includes(method))
   counts.emulatorWrites++;
 return actualFetch(url,options);
};
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function wait(url){
 for(let i=0;i<150;i++){
   try{await actualFetch(url);return;}catch{}
   await sleep(500);
 }
 throw Error('EMULATOR_NOT_READY_'+url);
}
function field(value){
 if(value===null)return {nullValue:'NULL_VALUE'};
 if(typeof value==='string')return {stringValue:value};
 if(typeof value==='number')return Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value};
 if(typeof value==='boolean')return {booleanValue:value};
 if(Array.isArray(value))return {arrayValue:{values:value.map(field)}};
 if(value&&typeof value==='object')return {mapValue:{fields:fields(value)}};
 throw Error('UNSUPPORTED_FIXTURE');
}
function fields(o){return Object.fromEntries(Object.entries(o).map(([key,val])=>[key,field(val)]));}
async function seed(base,path,obj){
 const uri=base+'/'+path.split('/').map(encodeURIComponent).join('/');
 const response=await fetch(uri,{method:'PATCH',headers:{authorization:'Bearer owner','content-type':'application/json'},
 body:JSON.stringify({fields:fields(obj)})});
 if(!response.ok)throw Error('SEED_FAILED '+path+' '+response.status+' '+await response.text());
}
async function authPost(path,body){
 const res=await fetch(AUTH+'/identitytoolkit.googleapis.com/v1/'+path+'?key=fake-api-key',
  {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const json=await res.json();
 if(!res.ok)throw Error('AUTH_EMULATOR_FAILED '+path+' '+JSON.stringify(json));
 return json;
}
async function createVerifiedAccount(email){
 const created=await authPost('accounts:signUp',{email,password:'Local-Test-Only-2026!',returnSecureToken:true});
 await authPost('accounts:sendOobCode',{requestType:'VERIFY_EMAIL',idToken:created.idToken});
 const codes=await (await fetch(AUTH+'/emulator/v1/projects/'+PROJECT+'/oobCodes')).json();
 const verification=[...(codes.oobCodes||[])].reverse().find(x=>x.email===email&&x.requestType==='VERIFY_EMAIL');
 if(!verification?.oobLink)throw Error('OOB_MISSING');
 const verifyLink=new URL(verification.oobLink);
 if(!['localhost','127.0.0.1'].includes(verifyLink.hostname)||Number(verifyLink.port)!==9099)
   throw Error('OOB_NONLOCAL_DENIED');
 const confirmed=await fetch(verification.oobLink);
 if(!confirmed.ok)throw Error('EMAIL_VERIFICATION_FAILED');
 const signed=await authPost('accounts:signInWithPassword',{email,password:'Local-Test-Only-2026!',returnSecureToken:true});
 const lookup=await authPost('accounts:lookup',{idToken:signed.idToken});
 assert.equal(lookup.users?.[0]?.emailVerified,true);
 assert.equal(lookup.users?.[0]?.localId,created.localId);
 return {uid:created.localId,token:signed.idToken};
}
async function setup(){
 const start=warehouseEmulatorLaunch();
 warehouseProcess=spawn(start.command,start.args,{cwd:repo,env:{...process.env,FIRESTORE_EMULATOR_HOST:''},stdio:['ignore','pipe','pipe']});
 warehouseProcess.on('error',e=>console.error('Warehouse emulator launch failed',String(e)));
 warehouseProcess.stdout.on('data',s=>process.stdout.write('[warehouse] '+s));
 warehouseProcess.stderr.on('data',s=>process.stderr.write('[warehouse] '+s));
 await wait('http://'+HOST+':8081');
 for(const entry of scopes){
   entry.identity=await createVerifiedAccount(entry.email);
   const {ws,ug,email,received,qty,identity}=entry;
   await seed(CORE,'platformAccounts/'+email,{email,firebaseUid:identity.uid,workspaceId:ws,ug,
    authProvider:'password',accountType:'sector',status:'active'});
   await seed(CORE,'workspaces/'+ws,{id:ws,ug,authorizedEmail:email,status:'active'});
   await seed(CORE,'billingAccounts/'+ws,{workspaceId:ws,ug,authorizedEmail:email,status:'exempt'});
   await seed(CORE,'workspaces/'+ws+'/empenhos/2026NE66',{workspaceId:ws,ug,id:'2026NE66',
    date:'2026-09-12',status:'active',supplier:'Fornecedor Alfa',supplierCnpj:'11444777000161',
    items:[{id:'item1',quantity:10,received,unitPrice:1000,unit:'kg',name:'Arroz'}]});
   await seed(CORE,'workspaces/'+ws+'/empenhos/2025NE22',{workspaceId:ws,ug,id:'2025NE22',
    date:'2025-12-20',items:[{id:'item2',quantity:4,received:0,unitPrice:15,unit:'un',name:'Pendente'}]});
   await seed(CORE,'workspaces/'+ws+'/suppliers/fornecedor1',{workspaceId:ws,ug,
    legalName:'Fornecedor Alfa',cnpj:'11444777000161',email:ws==='sector-ai-a'?'alfa-a@example.test':'alfa-b@example.test',phone:'0000'});
   const brazilDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',
     year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const yesterday=new Date(Date.parse(brazilDate+'T00:00:00Z')-86400000).toISOString().slice(0,10);
   await seed(CORE,'workspaces/'+ws+'/invoices/invoice1',{workspaceId:ws,ug,
    id:ws==='sector-ai-a'?'NF101':'NF202',empenhoId:'2026NE66',
    registeredAt:yesterday+'T15:00:00.000Z',issueDate:'2026-01-01',supplier:'Fornecedor Alfa',
    supplierCnpj:'11444777000161',totalValue:100});
   await seed(CORE,'workspaces/'+ws+'/cronogramas/2026NE66',{workspaceId:ws,ug,empenhoId:'2026NE66',
    historicoEnviosEmail:[{messageId:'mail-'+ws,enviadoEm:'2026-10-30T18:00:00.000Z',
      destinatario:'fixture@example.test',remessas:[{quantidade:1}]}]});
   await seed(WAREHOUSE,'warehouse/'+ws+'/materials/'+ids.material,{workspaceId:ws,ug,
    description:'arroz',aliases:['arroz branco'],unit:{code:'kg'}});
   await seed(WAREHOUSE,'warehouse/'+ws+'/balances/'+ids.material,{workspaceId:ws,ug,quantity:qty});
   await seed(WAREHOUSE,'warehouse/'+ws+'/locationBalances/position1',{workspaceId:ws,ug,
    materialId:ids.material,quantity:qty,position:{kind:'LOCATION',depotId:ids.depot,locationId:ids.location}});
   await seed(WAREHOUSE,'warehouse/'+ws+'/depots/'+ids.depot,{workspaceId:ws,ug,
    name:ws==='sector-ai-a'?'Depósito Alfa':'Depósito Beta',code:'DEP-01'});
   await seed(WAREHOUSE,'warehouse/'+ws+'/locations/'+ids.location,{workspaceId:ws,ug,
    depotId:ids.depot,name:'Prateleira 1',code:'EST-01'});
 }
 await seed(CORE,'platformBillingConfig/main',{billingMode:'observe',requirePayment:false,gracePeriodDays:10});
 testPhase=true;
}
const mock={
 '../server/sectorProvisioningAdmin':{getGoogleAccessToken:async()=> 'emulator-owner-no-real-IAM'},
 '../../firebase-applet-config.json':fakeConfig,
};
const cache=new Map();
function load(file){
 const full=resolve(repo,file);
 if(cache.has(full))return cache.get(full).exports;
 if(!existsSync(full))throw Error('MISSING_REAL_MODULE '+full);
 const mod={exports:{}};cache.set(full,mod);
 const js=ts.transpileModule(readFileSync(full,'utf8'),{fileName:full,
   compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
     esModuleInterop:true}}).outputText;
 const importer=id=>{
   if(Object.prototype.hasOwnProperty.call(mock,id))return mock[id];
   if(id.startsWith('.')){
     const base=resolve(dirname(full),id);
     if(extname(base)==='.json')return id.endsWith('firebase-applet-config.json')?fakeConfig:require(base);
     if(extname(base))return load(base);
     return load(existsSync(base+'.ts')?base+'.ts':resolve(base,'index.ts'));
   }
   return require(id);
 };
 new Function('require','module','exports','process','Buffer',js)(importer,mod,mod.exports,process,Buffer);
 return mod.exports;
}
async function run(){
 const {runAiAsk}=load('lib/emprovex-ai/integration/orchestrator.ts');
 const {verifyFirebaseRequest}=load('lib/server/firebaseFounderAuth.ts');
 const check=async(prompt,entry,cookie,contextToken)=>{
   const token=entry.identity.token;
   const ret=await runAiAsk({authorization:'Bearer '+token,
     input:{message:prompt,...(contextToken?{contextToken}:{})},sessionCookie:cookie});
   counts.questions++;
   assert.equal(ret.payload.metrics.qwenCalls,0);
   return ret;
 };
 for(const entry of scopes){
   const verified=await verifyFirebaseRequest('Bearer '+entry.identity.token);
   assert.equal(verified.uid,entry.identity.uid);
   assert.equal(verified.email,entry.email);
   assert.equal(verified.signInProvider,'password');
   const examples=[
     ['Qual o e-mail do fornecedor Alfa?','supplier_contact_find'],
     ['Mostre a NE 2026NE66.','commitment_get'],
     ['Quanto resta da NE 2026NE66?','commitment_total_balance'],
     ['Quais empenhos de 2025 ainda têm saldo?','commitment_previous_open_list'],
     ['Quando enviamos o cronograma da NE 2026NE66?','schedule_sent_history_list'],
     ['Quais NFs foram cadastradas ontem?','invoice_registration_period_list'],
     ['Quanto arroz temos em estoque?','warehouse_stock_get'],
     ['Onde está o arroz?','warehouse_material_locations_list']
   ];
   for(const [question,intent] of examples){
     const {payload}=await check(question,entry);
     assert.equal(payload.route,'DETERMINISTIC',question+' / '+payload.reason);
     assert.equal(payload.intent,intent);
     assert.ok(['ok','partial'].includes(payload.status),JSON.stringify({question,status:payload.status,reason:payload.reason}));
     assert.ok(payload.result.evidence.length>0);
     if(intent==='commitment_total_balance')assert.equal(payload.result.data.operationalBalance,(10-entry.received)*1000);
     if(intent==='warehouse_stock_get')assert.equal(payload.result.data.quantity,entry.qty);
     if(intent==='warehouse_material_locations_list')assert.equal(payload.result.data.locations.length,1);
     console.log('HOMOLOGATION_PASS',entry.ws,intent,payload.status);
   }
   const first=await check('Onde está o arroz?',entry);
   assert.ok(first.payload.contextToken);
   const next=await check('E quanto temos?',entry,first.cookie,first.payload.contextToken);
   assert.equal(next.payload.result.data.quantity,entry.qty);
   const unsupported=await check('Quais NFs cadastradas ontem que já foram pagas?',entry);
   assert.equal(unsupported.payload.query,undefined);
   const depot=await check('Quanto arroz temos no almoxarifado?',entry);
   assert.equal(depot.payload.query,undefined);
   await assert.rejects(()=>runAiAsk({authorization:'Bearer invalid',input:{message:'Quanto arroz temos?'}}));
   console.log('HOMOLOGATION_PASS',entry.ws,'context+filters+invalid-auth');
 }
 const a=scopes[0],b=scopes[1];
 const pa=await check('Quanto resta da NE 2026NE66?',a);
 const pb=await check('Quanto resta da NE 2026NE66?',b);
 assert.equal(pa.payload.result.data.operationalBalance,8000);
 assert.equal(pb.payload.result.data.operationalBalance,1000);
 const c=await check('Onde está o arroz?',a);
 await assert.rejects(()=>runAiAsk({authorization:'Bearer '+b.identity.token,
   input:{message:'E quanto temos?',contextToken:c.payload.contextToken},sessionCookie:c.cookie}),
   /AI_CONTEXT_FORBIDDEN/);
 assert.equal(counts.aiWrites,0);
 assert.equal(counts.blockedRemote,0);
 assert.ok(counts.emulatorReads>10);
 console.log('AI_FUNCTIONAL_HOMOLOGATION_PASS',JSON.stringify({
   realAuthEmulatorAccounts:2,realFirestoreEmulatorDatabases:2,
   actualW3Contracts:8,questions:counts.questions,
   readOperations:counts.emulatorReads,seedWrites:counts.emulatorWrites,
   operationalWrites:counts.aiWrites,remoteCallsBlocked:counts.blockedRemote,
   oracleCalls:0,qwenCalls:0,cloudFirestoreCalls:0,
   note:'Emulators only: not a deployed Cloud Run / Firebase Cloud credential test'}));
}
try{
 await setup();
 await run();
}catch(error){console.error('AI_FUNCTIONAL_HOMOLOGATION_FAILED',error?.stack||String(error));process.exitCode=1;
}finally{
 globalThis.fetch=actualFetch;
 if(warehouseProcess){
  warehouseProcess.kill('SIGTERM');
  await sleep(1200);
  if(warehouseProcess.exitCode===null)warehouseProcess.kill('SIGKILL');
 }
}
