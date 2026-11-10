/**
 * W11 isolated Firestore Emulator integration tests. No production credentials,
 * no company auth bypass in app: service-level tests exercise the guarded-store
 * boundary with known QA contexts. W10 separately covers the live Auth guard.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as geo from '../geo/core.mjs';

const req=createRequire(import.meta.url);
const project=process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID||'';
assert.match(project,/^demo-[a-z0-9-]+$/);
assert.equal(process.env.EMPROVEX_E2E_SERVER_AUTH,'1');
assert.ok(['localhost:8080','127.0.0.1:8080'].includes(process.env.FIRESTORE_EMULATOR_HOST));
assert.ok(['localhost:9099','127.0.0.1:9099'].includes(process.env.FIREBASE_AUTH_EMULATOR_HOST));
assert.ok(!process.env.K_SERVICE&&!process.env.VERCEL&&!process.env.GAE_SERVICE);
const fs='http://'+process.env.FIRESTORE_EMULATOR_HOST+'/v1/projects/'+project+'/databases/(default)/documents';
const base=fs.split('/v1/')[1];
const root=company=>'supplierCompanyWorkspaces/'+company;
const contracts={
 COMPANY_CONTRACT_VERSION:'company-r1-v1',
 companyDocumentPath:(company,kind,id)=>{
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(id)||!/^company-w11-[ab]$/.test(company))
   throw new Error('INVALID_SCOPE');
  return root(company)+'/'+kind+'/'+id;
 }
};
function load(path,modules={}){
 const source=readFileSync(new URL('../../../'+path,import.meta.url),'utf8');
 const transpiled=ts.transpileModule(source,{fileName:path,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,
  resolveJsonModule:true},reportDiagnostics:true});
 assert.equal(transpiled.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length||0,0,path);
 const exports={};
 runInNewContext(transpiled.outputText,{exports,require(id){
  if(Object.hasOwn(modules,id))return modules[id];
  if(id.startsWith('node:'))return req(id);
  throw Error('UNEXPECTED_IMPORT '+id);
 },fetch:(...args)=>fetch(...args),process,console,Buffer,AbortSignal,
  URL,URLSearchParams,Request,Response,TextEncoder,Date,Map,Set,Promise},
  {filename:path});
 return exports;
}
const store=load('lib/company/routing/store.ts',{
 'server-only':{},
 '../../../config/empresas-firebase-web.json':{projectId:project,firestoreDatabaseId:'(default)'},
 '../../server/companyFirebaseRuntime':{getCompanyAccessToken:()=>{throw Error('PRODUCTION_TOKEN_FORBIDDEN');}},
 '../contracts':contracts,
 '../geo/core.mjs':geo,
 './providers':{optimizedProposal:async()=>{throw Error('THIRD_PARTY_PROVIDER_FORBIDDEN');}},
});
const a='company-w11-a',b='company-w11-b';
const context=(company,uid='owner-a')=>({
 companyId:company,workspaceId:company,rootPath:root(company),uid,role:'owner',action:'deliveryRoutes:write'
});
const delivery=(company,n)=>({
 companyId:company,workspaceId:company,deliveryId:'delivery_'+n,
 customerOrderId:'order_'+n,customerOrderLineId:'line_'+n,
 destination:{address:'Rua QA numero '+n+', RS',confirmed:true,latitude:-29.7+n/1000,
  longitude:-53.8+n/1000,coordinateSource:'operator'},
 quantity:{value:'1',unit:'UN'},weightKg:10,unloadMinutes:10
});
const vehicle=id=>({id,origin:{latitude:-29.7,longitude:-53.8,coordinateSource:'operator'},
 capacity:{weightKg:100},shift:{start:'2026-11-06T08:00:00.000Z',end:'2026-11-06T20:00:00.000Z'},breaks:[]});
function draft(company=a){
 return{mode:'manual',candidates:[delivery(company,1),delivery(company,2)],
  vehicles:[vehicle('truck_1')],
  assignments:[1,2].map(n=>({candidateDeliveryId:'delivery_'+n,vehicleId:'truck_1'}))};
}
async function collection(company,kind){
 const res=await fetch(fs+'/'+root(company)+'/'+kind,{
  headers:{authorization:'Bearer owner'}});
 if(res.status===404)return[];
 assert.equal(res.status,200,kind);
 return(await res.json()).documents||[];
}
test('Firestore real: company A creates route, replays idempotently; B never sees it',async()=>{
 const ctx=context(a);
 const first=await store.createRoute(ctx,draft(a),'w11-route-replay-0001');
 assert.equal(first.replayed,false);
 assert.equal(first.result.companyId,a);
 assert.equal(first.result.revision,1);
 assert.equal(first.result.stops.length,2);
 assert.equal(first.result.stops[0].createdByUid,ctx.uid);
 assert.ok(first.result.stops[0].requestHash);
 const replay=await store.createRoute(ctx,draft(a),'w11-route-replay-0001');
 assert.equal(replay.replayed,true);
 assert.equal(replay.result.id,first.result.id);
 await assert.rejects(store.createRoute(ctx,{...draft(a),assignments:[]},'w11-route-replay-0001'),
  err=>err.status===409&&err.code==='IDEMPOTENCY_CONFLICT');
 await assert.rejects(store.getRoute(context(b,'owner-b'),first.result.id),err=>err.status===404);
 const bRoute=await store.createRoute(context(b,'owner-b'),draft(b),'w11-route-replay-0001');
 assert.notEqual(first.result.id,bRoute.result.id);
 assert.equal((await store.listRoutes(ctx,20,'')).items.length,1);
 assert.equal((await store.listRoutes(context(b,'owner-b'),20,'')).items.length,1);
 assert.ok((await collection(a,'auditEvents')).length>=1);
});
test('Firestore real: CAS revision on concurrent reorder vs approval; one writes',async()=>{
 const ctx=context(a),created=await store.createRoute(ctx,draft(a),'w11-route-cas-0001');
 const id=created.result.id,rev=created.result.revision;
 const [a1,a2]=await Promise.allSettled([
  store.changeRoute(ctx,id,{action:'reorder',expectedRevision:rev,
   orderedIds:['delivery_2','delivery_1']},'w11-reorder-cas-0001'),
  store.changeRoute(ctx,id,{action:'approve',expectedRevision:rev,
   confirmedUnassignedIds:[],confirmedDestinationIds:['delivery_1','delivery_2']},
   'w11-approve-cas-0001')
 ]);
 assert.equal([a1,a2].filter(v=>v.status==='fulfilled').length,1);
 const rejected=[a1,a2].filter(v=>v.status==='rejected');
 assert.equal(rejected.length,1);
 assert.equal(rejected[0].reason.status,409);
 const loaded=await store.getRoute(ctx,id);
 assert.equal(loaded.revision,2);
 assert.notEqual(loaded.status,'dispatched');
 const auditRows=await collection(a,'auditEvents');
 assert.ok(auditRows.length>=3);
});
test('Firestore real: vehicle CRUD revision and company isolation',async()=>{
 const input=vehicle('truck_a');
 const created=await store.saveVehicle(context(a),input,'w11-vehicle-create-0001');
 assert.equal(created.result.companyId,a);
 assert.equal(created.result.revision,1);
 const replay=await store.saveVehicle(context(a),input,'w11-vehicle-create-0001');
 assert.equal(replay.replayed,true);
 assert.equal((await store.listVehicles(context(b,'owner-b'),20,'')).items.length,0);
 const changed=await store.saveVehicle(context(a),{...input,expectedRevision:1,driverUid:'driver_1'},
  'w11-vehicle-update-0001',input.id);
 assert.equal(changed.result.revision,2);
 await assert.rejects(store.saveVehicle(context(a),{...input,expectedRevision:1,driverUid:'driver_2'},
  'w11-vehicle-stale-0001',input.id),err=>err.status===409);
 assert.equal((await store.listVehicles(context(a),20,'')).items.length,1);
});
