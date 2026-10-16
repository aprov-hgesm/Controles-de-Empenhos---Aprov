#!/usr/bin/env node
/**
 * W6 — REAL exported POST fast-path handler + Firestore Emulator persistence.
 * ONLY demo project and loopback requests are allowed. Neither Firebase Auth nor
 * Google Cloud APIs can be reached. No real credentials are read.
 *
 * The production TypeScript route and its domain dependencies execute unchanged.
 * Only external NextResponse, auth gate, OAuth and transport are replaced.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PROJECT = 'demo-emprovex-fastpath';
const CORE = 'qa-core';
const WAREHOUSE = 'qa-warehouse';
const PORT = 8097;
const LOOPBACK = 'http://127.0.0.1:' + PORT;
const PROD_FIRESTORE = 'https://firestore.googleapis.com/v1/';
const WORKSPACE = 'ws_fastpath_qa';
const UG = '160416';
const ACTOR = 'synthetic-fastpath-user';
const root = resolve(import.meta.dirname, '..');
const nativeFetch = globalThis.fetch;
const require = createRequire(import.meta.url);

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:' + PORT) {
  throw new Error('FAST_PATH_EMULATOR_NOT_STARTED');
}
if (process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON ||
    process.env.EMPROVEX_RUNTIME_TARGET ||
    process.env.K_SERVICE) {
  throw new Error('FAST_PATH_REAL_CREDENTIAL_OR_RUNTIME_FORBIDDEN');
}

function emulatorFetch(url, init) {
  const str = String(url);
  const normalized = str.startsWith(PROD_FIRESTORE)
    ? LOOPBACK + str.slice('https://firestore.googleapis.com'.length)
    : str;
  const parsed = new URL(normalized);
  if (parsed.origin !== LOOPBACK ||
      !parsed.pathname.startsWith('/v1/projects/' + PROJECT + '/databases/')) {
    throw new Error('FAST_PATH_NETWORK_BLOCKED:' + parsed.origin);
  }
  const segments = parsed.pathname.split('/');
  if (segments[5] !== CORE && segments[5] !== WAREHOUSE) {
    throw new Error('FAST_PATH_WRONG_DATABASE');
  }
  return nativeFetch(normalized, init);
}
globalThis.fetch = emulatorFetch;

const ts = require('typescript');
const Module = require('node:module');
const originalLoad = Module._load;
const originalTs = require.extensions['.ts'];
let firestoreCalls = 0;
globalThis.fetch = (url, opts) => {
  firestoreCalls += 1;
  return emulatorFetch(url, opts);
};
function AuthDenied(message, status = 403) {
  this.name = 'WarehouseAccessError';
  this.message = message;
  this.status = status;
}
AuthDenied.prototype = Object.create(Error.prototype);

Module._load = function safeLoad(request, parent, isMain) {
  if (request === 'next/server') {
    return { NextResponse: { json: (body, opts = {}) => ({
      status: opts.status || 200,
      json: async () => body,
    }) } };
  }
  if (request.endsWith('/lib/firebaseRuntimeConfig')) {
    return { __esModule: true, default: Object.freeze({
      projectId: PROJECT,
      firestoreDatabaseId: CORE,
      warehouseDatabaseId: WAREHOUSE,
    }) };
  }
  if (request.endsWith('/lib/server/firebaseFounderAuth')) {
    return { FounderAuthError: AuthDenied };
  }
  if (request.endsWith('/lib/server/warehouseAccess')) {
    return {
      WarehouseAccessError: AuthDenied,
      verifyWarehouseRequest: async authHeader => {
        if (authHeader !== 'Bearer synthetic-owner') {
          throw new AuthDenied('synthetic permission denied', 403);
        }
        return { workspaceId: WORKSPACE, ug: UG, uid: ACTOR,
          email: 'synthetic@example.test', claimsUpdated: false };
      },
    };
  }
  if (request.endsWith('/lib/server/sectorProvisioningAdmin')) {
    return { getGoogleAccessToken: async () => 'owner' };
  }
  return originalLoad.call(this, request, parent, isMain);
};
require.extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(root + '/')) throw new Error('FAST_PATH_OUTSIDE_SOURCE_ROOT');
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(output, filename);
};
let POST;
let createWarehouseItemIntakeId;
try {
  POST = require(resolve(root, 'app/api/central-depositos/intake-action/route.ts')).POST;
  createWarehouseItemIntakeId =
    require(resolve(root, 'lib/warehouse/intake.ts')).createWarehouseItemIntakeId;
} finally {
  // Dependencies have already been loaded; don't affect the rest of test runner.
  Module._load = originalLoad;
  if (originalTs) require.extensions['.ts'] = originalTs;
  else delete require.extensions['.ts'];
}

function v(value) {
  if (value === null) return { nullValue: 'NULL_VALUE' };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { integerValue: String(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(v) } };
  if (typeof value === 'object') return { mapValue: { fields: fields(value) } };
  throw new Error('Unsupported synthetic fixture field');
}
const fields = x => Object.fromEntries(Object.entries(x).map(([k,vv]) => [k,v(vv)]));
const from = v => v?.stringValue ?? (v?.integerValue !== undefined ? Number(v.integerValue) :
  v?.booleanValue ?? (v?.nullValue ? null : v?.mapValue ?
    Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,val])=>[k,from(val)])) :
    v?.arrayValue ? (v.arrayValue.values||[]).map(from) : null));
async function firestoreDocument(database,path) {
  const response = await fetch(PROD_FIRESTORE + 'projects/' + PROJECT + '/databases/' +
    database + '/documents/' + path,{headers:{authorization:'Bearer owner'}});
  if(response.status===404)return null;
  if (response.status !== 200) throw new Error('FAST_PATH_GET_FAILED:' + response.status + ':' + await response.text());
  const data=await response.json();
  return {name:data.name,fields:Object.fromEntries(
    Object.entries(data.fields||{}).map(([k,v])=>[k,from(v)])),
  };
}
async function seed(database,path,record) {
  const resp=await fetch(PROD_FIRESTORE+'projects/'+PROJECT+'/databases/'+database+
    '/documents/'+path,{
      method:'PATCH', headers:{authorization:'Bearer owner','content-type':'application/json'},
      body:JSON.stringify({fields:fields(record)}),
  });
  if (resp.status !== 200) throw new Error('FAST_PATH_SEED_FAILED:' + resp.status + ':' + await resp.text());
}
function req(action, input, workspaceId=WORKSPACE, auth='Bearer synthetic-owner') {
  return {
    headers:new Headers({authorization:auth}),
    json:async()=>({action,workspaceId,input}),
  };
}
let allocation;
let immediate;
let materialId;
const depId='dep_'+'a'.repeat(32);
const locId='loc_'+'b'.repeat(32);
const loc={kind:'LOCATION',depotId:depId,locationId:locId,subpositionId:null};
const invoiceKey='nf_fastpath_qa_001';
const inv='invoice_fastpath_01';
const empenho='empenho_fastpath_01';
const item='item_fastpath_01';
let intakeId;
const warehousePath=path=>'warehouse/'+WORKSPACE+'/'+path;

test('emulator is reachable and initializes dual named synthetic databases', async()=>{
  intakeId=await createWarehouseItemIntakeId(WORKSPACE,invoiceKey,item);
  await seed(CORE, 'workspaces/'+WORKSPACE+'/invoices/'+invoiceKey,{
    id:inv,empenhoId:empenho,supplier:'Synthetic Supplier',
    items:[{itemId:item,quantity:10}],
  });
  await seed(CORE, 'workspaces/'+WORKSPACE+'/empenhos/'+empenho,{
    id:empenho,supplier:'Synthetic Supplier',
    items:[{id:item,name:'Synthetic material',unit:'UN'}],
  });
  await seed(WAREHOUSE,warehousePath('depots/'+depId),{
    id:depId,workspaceId:WORKSPACE,ug:UG,status:'active',
  });
  await seed(WAREHOUSE,warehousePath('locations/'+locId),{
    id:locId,workspaceId:WORKSPACE,ug:UG,status:'active',
    depotId:depId,kind:'LOCAL',
  });
  await seed(WAREHOUSE,warehousePath('destinations/dest_synthetic'),{
    schemaVersion:'warehouse_destination_v1',
    id:'dest_synthetic',workspaceId:WORKSPACE,ug:UG,
    name:'Synthetic recipient',status:'active',
  });
  const check = await firestoreDocument(CORE,'workspaces/'+WORKSPACE+'/invoices/'+invoiceKey);
  assert.equal(check.fields.id,inv);
});

test('unauthenticated or cross-workspace POST is rejected without Firestore reads',async()=>{
  let count=firestoreCalls;
  let r=await POST(req('ALLOCATE',{},WORKSPACE,'Bearer fake'));
  assert.equal(r.status,403);
  assert.equal(firestoreCalls,count);
  r=await POST(req('ALLOCATE',{},'ws_other'));
  assert.equal(r.status,403);
  assert.equal(firestoreCalls,count);
});

test('F05 — actual POST allocation persists intake, ledger/balance, location and lot atomically',async()=>{
  allocation={
    intakeId,invoiceRecordKey:invoiceKey,invoiceId:inv,empenhoId:empenho,itemId:item,
    expectedAllocatedQuantity:0,expectedImmediateConsumptionQuantity:0,
    effectiveStatus:'PENDING',quantity:4,operationId:'synthetic-allocate-001',
    position:loc,lotCode:'LOT-QA-001',expiresOn:null,barcode:null,
  };
  const response=await POST(req('ALLOCATE',allocation));
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  assert.equal(body.result.applied,true);
  materialId=body.result.intake.materialId;
  assert.ok(materialId?.startsWith('mat_'));
  const root=warehousePath('');
  const [intake,balance,movement,lot] =await Promise.all([
    firestoreDocument(WAREHOUSE,root+'intakes/'+intakeId),
    firestoreDocument(WAREHOUSE,root+'balances/'+materialId),
    firestoreDocument(WAREHOUSE,root+'movements/'+body.result.entryMovementId),
    firestoreDocument(WAREHOUSE,root+'lots/'+body.result.lot.id),
  ]);
  assert.equal(intake.fields.allocatedQuantity,4);
  assert.equal(intake.fields.pendingQuantity,6);
  assert.equal(balance.fields.quantity,4);
  assert.equal(movement.fields.type,'INVOICE_ENTRY');
  assert.equal(lot.fields.quantity,4);
  assert.equal(await firestoreDocument(CORE,'workspaces/'+WORKSPACE+'/balances/'+materialId),null);
});

test('F05 — identical replay is harmless; divergent same key and stale state are 409',async()=>{
  const replay=await POST(req('ALLOCATE',allocation));
  assert.equal(replay.status,200);
  assert.equal((await replay.json()).result.applied,false);
  const divergence=await POST(req('ALLOCATE',{...allocation,quantity:2}));
  assert.equal(divergence.status,409);
  const stale=await POST(req('ALLOCATE',{
    ...allocation,operationId:'synthetic-allocate-002',expectedAllocatedQuantity:0,
  }));
  assert.equal(stale.status,409);
  const balance=await firestoreDocument(WAREHOUSE,warehousePath('balances/'+materialId));
  assert.equal(balance.fields.quantity,4);
});

test('F09 — actual POST immediate consumption persists without changing stock ledger',async()=>{
  immediate={intakeId,invoiceRecordKey:invoiceKey,invoiceId:inv,empenhoId:empenho,itemId:item,
    expectedAllocatedQuantity:4,expectedImmediateConsumptionQuantity:0,
    effectiveStatus:'PARTIAL',quantity:3,operationId:'synthetic-consume-001',
    destinationId:'dest_synthetic',withdrawnBy:'Synthetic receiver',
  };
  const response=await POST(req('IMMEDIATE_CONSUMPTION',immediate));
  const body=await response.json();
  assert.equal(response.status,200,JSON.stringify(body));
  assert.equal(body.result.applied,true);
  const [intake,consumption,balance]=await Promise.all([
    firestoreDocument(WAREHOUSE,warehousePath('intakes/'+intakeId)),
    firestoreDocument(WAREHOUSE,warehousePath('consumptions/'+body.result.consumptionId)),
    firestoreDocument(WAREHOUSE,warehousePath('balances/'+materialId)),
  ]);
  assert.equal(intake.fields.immediateConsumptionQuantity,3);
  assert.equal(intake.fields.pendingQuantity,3);
  assert.equal(consumption.fields.quantity,3);
  assert.equal(balance.fields.quantity,4);
});
test('F09 — consumption idempotency and stale optimistic state',async()=>{
  const replay=await POST(req('IMMEDIATE_CONSUMPTION',immediate));
  assert.equal(replay.status,200);
  assert.equal((await replay.json()).result.applied,false);
  const divergence=await POST(req('IMMEDIATE_CONSUMPTION',{...immediate,quantity:1}));
  assert.equal(divergence.status,409);
  const stale=await POST(req('IMMEDIATE_CONSUMPTION',{
    ...immediate,operationId:'synthetic-consume-002',
  }));
  assert.equal(stale.status,409);
  const balance=await firestoreDocument(WAREHOUSE,warehousePath('balances/'+materialId));
  assert.equal(balance.fields.quantity,4);
});
test('network safety blocks any real URL including production Firestore',async()=>{
  assert.throws(()=>fetch('https://firestore.googleapis.com/v1/projects/prod/databases/(default)/documents/x'),
    /FAST_PATH_NETWORK_BLOCKED/);
});
