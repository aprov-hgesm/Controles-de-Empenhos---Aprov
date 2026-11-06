/**
 * W10-II real W9 <-> W11 Firestore Emulator contract test.
 * Uses only local demo-* project and Firestore/Auth emulators. No production IO.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as geo from '../geo/core.mjs';
import * as domain from '../delivery/domain.mjs';
import * as approval from './approvedRoute.mjs';

const nodeRequire = createRequire(import.meta.url);
const project = process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID || '';
assert.match(project, /^demo-[a-z0-9-]+$/);
assert.equal(process.env.EMPROVEX_E2E_SERVER_AUTH, '1');
assert.ok(['127.0.0.1:8080','localhost:8080'].includes(process.env.FIRESTORE_EMULATOR_HOST));
assert.ok(['127.0.0.1:9099','localhost:9099'].includes(process.env.FIREBASE_AUTH_EMULATOR_HOST));
assert.ok(!process.env.K_SERVICE && !process.env.VERCEL && !process.env.GAE_SERVICE);
const root = 'http://' + process.env.FIRESTORE_EMULATOR_HOST +
  '/v1/projects/' + project + '/databases/(default)/documents';
const collection = 'supplierCompanyWorkspaces';
const tenantA='company-w10-stage2-a',tenantB='company-w10-stage2-b';
const contracts={
  COMPANY_CONTRACT_VERSION:'company-r1-v1',
  companyDocumentPath:(c,k,id)=>collection+'/'+c+'/'+k+'/'+id,
  companyCollectionPath:(c,k)=>collection+'/'+c+'/'+k
};
function loadTs(path, modules){
  const source=readFileSync(new URL('../../../'+path,import.meta.url),'utf8');
  const parsed=ts.transpileModule(source,{fileName:path,compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,
    resolveJsonModule:true},reportDiagnostics:true});
  assert.equal(parsed.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length||0,0,path);
  const exports={};
  runInNewContext(parsed.outputText,{
    exports,require(id){
      if(Object.hasOwn(modules,id))return modules[id];
      if(id.startsWith('node:'))return nodeRequire(id);
      throw Error('UNEXPECTED_IMPORT '+path+': '+id);
    },fetch:(...args)=>fetch(...args),process,console,Buffer,AbortSignal,
    URL,URLSearchParams,Request,Response,TextEncoder,Date,Map,Set,Promise
  },{filename:path});
  return exports;
}
const shared={
 'server-only':{},
 '../../../firebase-applet-config.json':{projectId:project,firestoreDatabaseId:'(default)'},
 '../../server/sectorProvisioningAdmin':{getGoogleAccessToken:()=>{throw Error('REAL_GCP_FORBIDDEN');}},
 '../contracts':contracts,
};
const w11=loadTs('lib/company/routing/store.ts',{
  ...shared,'../geo/core.mjs':geo,
  './providers':{optimizedProposal:async()=>{throw Error('PROVIDER_DISABLED');}}
});
const w9Store=loadTs('lib/company/delivery/store.ts',{
  ...shared,'../delivery/domain.mjs':domain,'./domain.mjs':domain
});
const w9=loadTs('lib/company/delivery/service.ts',{
  'server-only':{},'../contracts':contracts,'./store':w9Store,
  '../../server/companyMembership/firestore':{
    readIdentityDocument:async()=>{throw Error('OWNER_DID_NOT_REQUIRE_MEMBER_INDEX');}
  },
  './domain.mjs':domain,
  '../integration/approvedRoute.mjs':approval
});
const ctx=(company,uid='qa-owner')=>({
 companyId:company,workspaceId:company,rootPath:collection+'/'+company,uid,
 role:'owner',action:'deliveries:write'
});
function encode(value){
 if(value===null)return{nullValue:'NULL_VALUE'};
 if(typeof value==='string')return{stringValue:value};
 if(typeof value==='boolean')return{booleanValue:value};
 if(typeof value==='number')return Number.isSafeInteger(value)?{integerValue:String(value)}:{doubleValue:value};
 if(Array.isArray(value))return{arrayValue:{values:value.map(encode)}};
 if(value&&typeof value==='object')return{mapValue:{fields:Object.fromEntries(
  Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encode(v)]))}};
 throw Error('INVALID_FIXTURE');
}
async function seedDelivery(company,n,driver){
 const id='delivery_'+n;
 const record={schemaVersion:contracts.COMPANY_CONTRACT_VERSION,kind:'delivery',
  id,companyId:company,workspaceId:company,createdByUid:'qa-owner',
  createdAt:'2026-11-06T08:00:00Z',updatedAt:'2026-11-06T08:00:00Z',
  status:'active',revision:1,deliveryState:'planned',customerOrderId:'order_'+n,
  customerOrderLineId:'line_'+n,driverUid:driver,
  destination:{address:'Rua QA '+n+', RS',confirmed:true,latitude:-29.7+n/1000,
    longitude:-53.8+n/1000,coordinateSource:'qa-confirmed'},
  quantity:{value:'1',unit:'UN'},deliveredQuantity:{value:'0',unit:'UN'},
  manualSequence:n,source:'company_stock',history:[],atesto:false,liquidacao:false,payment:false
 };
 const response=await fetch(root+'/'+collection+'/'+company+'/deliveries/'+id,{
  method:'PATCH',headers:{authorization:'Bearer owner','content-type':'application/json'},
  body:JSON.stringify({fields:Object.fromEntries(Object.entries(record).map(([k,v])=>[k,encode(v)]))})
 });
 assert.equal(response.status,200,'Firestore Emulator fixture must be persisted');
 return record;
}
function candidate(r){
 return{companyId:r.companyId,workspaceId:r.workspaceId,deliveryId:r.id,
  customerOrderId:r.customerOrderId,customerOrderLineId:r.customerOrderLineId,
  destination:r.destination,quantity:r.quantity,weightKg:10,unloadMinutes:10};
}
function vehicle(id,driver){
 return{id,driverUid:driver,origin:{latitude:-29.7,longitude:-53.8,coordinateSource:'qa'},
  capacity:{weightKg:100},shift:{start:'2026-11-06T08:00:00Z',
   end:'2026-11-06T20:00:00Z'},breaks:[]};
}
test('W10-II real Firestore: 5 OMs, 2 drivers, approved W11 plan binds W9 only via CAS',async()=>{
 const company=ctx(tenantA);
 const deliveries=[];
 for(let n=1;n<=5;n++)deliveries.push(await seedDelivery(tenantA,n,n<=3?'driver_1':'driver_2'));
 const draft={mode:'manual',candidates:deliveries.map(candidate),
  vehicles:[vehicle('truck_1','driver_1'),vehicle('truck_2','driver_2')],
  assignments:deliveries.map((d,n)=>({candidateDeliveryId:d.id,
    vehicleId:n<3?'truck_1':'truck_2'}))};
 const created=await w11.createRoute(company,draft,'w10-stage2-route-0001');
 assert.equal(created.result.status,'draft');
 assert.equal(created.result.stops.length,5);
 await assert.rejects(
   w9.updateDelivery(company,'delivery_1',
     {kind:'attach_route',routePlanId:created.result.id,expectedRevision:1},
     'w10-stage2-premature-0001'),
   e=>e.code==='ROUTE_NOT_APPROVED'&&e.status===409);
 const approved=await w11.changeRoute(company,created.result.id,{
   action:'approve',expectedRevision:created.result.revision,
   confirmedUnassignedIds:[],confirmedDestinationIds:deliveries.map(d=>d.id)
 },'w10-stage2-approve-0001');
 assert.equal(approved.result.status,'approved');
 assert.equal(approved.result.approvedByHuman,true);
 const attached=await w9.updateDelivery(company,'delivery_1',
   {kind:'attach_route',routePlanId:created.result.id,expectedRevision:1},
   'w10-stage2-attach-0001');
 assert.equal(attached.delivery.routePlanId,created.result.id);
 assert.equal(attached.delivery.revision,2);
 assert.equal(attached.atesto,false);
 assert.equal(attached.payment,false);
 assert.equal(attached.stockLedgerChanged,false);
 const repeated=await w9.updateDelivery(company,'delivery_1',
   {kind:'attach_route',routePlanId:created.result.id,expectedRevision:1},
   'w10-stage2-attach-0001');
 assert.equal(repeated.delivery.revision,2,'same key must replay, not duplicate');
 await assert.rejects(w9.updateDelivery(company,'delivery_1',
   {kind:'attach_route',routePlanId:created.result.id,expectedRevision:1},
   'w10-stage2-attach-0002'),e=>e.status===409);
 await assert.rejects(w9.getDelivery(ctx(tenantB,'qa-owner-b'),'delivery_1'),
   e=>e.status===409||e.status===404);
 const other=await seedDelivery(tenantB,1,'driver_1');
 assert.equal((await w9.getDelivery(ctx(tenantB,'qa-owner-b'),other.id)).companyId,tenantB);
 const proof=await w9.getDelivery(company,'delivery_1');
 assert.equal(proof.routePlanId,created.result.id);
 assert.equal(proof.deliveryState,'planned','a route is not shipment/dispatch');
});
