#!/usr/bin/env node
/**
 * W5: REAL transactional Warehouse v2/v3 benchmark.
 * Execute with tsx exclusively inside Firebase Auth + named Firestore emulators.
 * Read/write a demo workspace only. Does NOT mock engines, transactions or auth.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {existsSync,writeFileSync} from 'node:fs';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,GoogleAuthProvider,signInWithCredential} from 'firebase/auth';
import {getFirestore,connectFirestoreEmulator,doc,getDoc,setDoc} from 'firebase/firestore';
import {summary,parseStream} from './core-lean-r2-w5-profile.mjs';

const PROJECT='demo-emprovex-security', DB='emprovex-warehouse', WS='hgesm-aprov', UG='160416';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'
  ||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099'
  ||process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID!==PROJECT
  ||process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR!=='1'
  ||process.env.EMPROVEX_E2E_SERVER_AUTH!=='1')
  throw Error('W5_TRANSACTION_BENCHMARK_EMULATOR_ONLY');
if(!existsSync(new URL('../lib/server/warehouseWithdrawalV3Write.ts',import.meta.url))
  ||!existsSync(new URL('../lib/server/warehouseWithdrawalEvidence.ts',import.meta.url)))
  throw Error('W5_W1_TRANSACTION_ENGINE_NOT_COMPOSED');
const SAMPLES=Number(process.env.W5_TRANSACTION_SAMPLES||'4');
if(!Number.isInteger(SAMPLES)||SAMPLES<3||SAMPLES>12)throw Error('W5_SAMPLES_INVALID');

const {verifyWarehouseRequest}=await import('../lib/server/warehouseAccess.ts');
const {finalizeWarehouseWithdrawalServer}=await import('../lib/server/warehouseWithdrawalWrite.ts');
const {finalizeWarehouseWithdrawalV3Server}=await import('../lib/server/warehouseWithdrawalV3Write.ts');
const {registerWarehouseManualEntryServer}=await import('../lib/server/warehouseManualEntry.ts');
const {saveWarehouseMaterialServer}=await import('../lib/server/warehouseMaterialWrite.ts');
const {warehouseDestinationCreateServer}=await import('../lib/server/warehouseDestinationWrite.ts');
const {warehouseBarcodeServer}=await import('../lib/server/warehouseRemainingWrites.ts');
const {createWarehouseMovementId}=await import('../lib/warehouse/movement.ts');

const sha=x=>createHash('sha256').update(x).digest('hex');
const hex=n=>Number(n).toString(16).padStart(32,'0');
const ids={withdrawal:0,line:0,operation:0,lot:0,seed:0};
const next=(key,prefix)=>prefix+hex(++ids[key]);
const app=initializeApp({projectId:PROJECT,apiKey:'fake-api-key',
  authDomain:PROJECT+'.firebaseapp.com'},'w5-transaction-benchmarks');
const auth=getAuth(app);
connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
const login=await signInWithCredential(auth,GoogleAuthProvider.credential(
  JSON.stringify({sub:'w5-benchmark-founder',email:'aprov1hgesm@gmail.com',email_verified:true})));
const access=await verifyWarehouseRequest('Bearer '+await login.user.getIdToken());
assert.equal(access.workspaceId,WS);assert.equal(access.ug,UG);
const db=getFirestore(app,DB);
connectFirestoreEmulator(db,'127.0.0.1',8080);
const ref=(domain,id)=>doc(db,'warehouse',WS,domain,id);
const read=async(domain,id)=>(await getDoc(ref(domain,id))).data()??null;
const depot='dep_'+'a'.repeat(32),locA='loc_'+'b'.repeat(32),locB='loc_'+'c'.repeat(32);
const posA={kind:'LOCATION',depotId:depot,locationId:locA,subpositionId:null};
const posB={kind:'LOCATION',depotId:depot,locationId:locB,subpositionId:null};
const preseed=async()=>{
  await setDoc(ref('depots',depot),{schemaVersion:'warehouse_depot_v1',
    id:depot,workspaceId:WS,ug:UG,code:'W5DEP',name:'Deposito Demo W5',
    description:null,visualType:'CONTAINER',sizeProfile:'MEDIUM',status:'active',
    createdBy:access.uid,updatedBy:access.uid});
  for(const [id,code] of [[locA,'W5LOC1'],[locB,'W5LOC2']])
    await setDoc(ref('locations',id),{schemaVersion:'warehouse_location_v1',
      id,workspaceId:WS,ug:UG,depotId:depot,kind:'LOCAL',parentLocationId:null,
      code,name:code,description:null,status:'active',createdBy:access.uid,updatedBy:access.uid});
};
await preseed();
const destination=await warehouseDestinationCreateServer(access,{name:'Destino de benchmarks W5'});

function probe(fn) {
  const original=globalThis.fetch, events=[];
  // Instrument ONLY the server Firestore adapter. Exclude Auth and seed from measures.
  globalThis.fetch=async(input,init)=>{
    const url=typeof input==='string'?input:String(input.url||input);
    if(!url.startsWith('http://127.0.0.1:8080/v1/projects/'+PROJECT+'/databases/'+DB+'/documents'))
      throw Error('W5_RPC_OUTSIDE_DEMO_EMULATOR');
    const operation=url.includes(':beginTransaction')?'begin'
      :url.includes(':batchGet')?'batchGet':url.includes(':runQuery')?'runQuery'
      :url.includes(':commit')?'commit':url.includes(':rollback')?'rollback':'other';
    let body={};
    if(typeof init?.body==='string') {
      try{body=JSON.parse(init.body)}catch{throw Error('W5_RPC_BODY_INVALID')}
    }
    const start=performance.now();
    const res=await original(input,init);
    const ms=performance.now()-start;
    let found=0;
    if(operation==='batchGet'||operation==='runQuery') {
      const raw=await res.clone().text();
      // Count only returned documents, do NOT imply Firestore billed reads.
      found=parseStream(raw).filter(x=>Boolean(x.found||x.document)).length;
    }
    events.push({operation,ms,paths:Array.isArray(body.documents)?body.documents.length:0,
      returned:found,writes:Array.isArray(body.writes)?body.writes.length:0,status:res.status});
    return res;
  };
  const start=performance.now();
  return Promise.resolve().then(fn).then(
    value=>({value,metric:metrics(events,performance.now()-start)}),
    error=>{error.w5Observed=metrics(events,performance.now()-start);throw error},
  ).finally(()=>{globalThis.fetch=original;});
}
function metrics(events,latency){
  const begin=events.findIndex(x=>x.operation==='begin');
  const started=begin>=0?events.slice(0,begin):events;
  const trans=begin>=0?events.slice(begin):[];
  const agg=e=>e.reduce((sum,x)=>sum+x.ms,0);
  return {totalMs:Number(latency.toFixed(3)),rpc:events.length,
    batchGet:events.filter(e=>e.operation==='batchGet').length,
    runQuery:events.filter(e=>e.operation==='runQuery').length,
    pathsRequested:events.reduce((sum,x)=>sum+x.paths,0),
    docsReturned:events.reduce((sum,x)=>sum+x.returned,0),
    documentsWritten:events.reduce((sum,x)=>sum+x.writes,0),
    transactionAttempts:events.filter(e=>e.operation==='begin').length,
    beforeTransactionMs:Number(agg(started).toFixed(3)),
    transactionRpcMs:Number(agg(trans).toFixed(3)),
    rpcMs:Number(agg(events).toFixed(3)),
    aborts:events.filter(e=>e.operation==='rollback'||e.status===409).length,
    sequence:events.map(e=>e.operation)};
}
function scenario(kind){
  if(kind==='simple')return {lots:1,first:80,second:0,take:2};
  if(kind==='multiline')return {lots:0,first:80,second:40,take:9,
    lines:[{quantity:2,position:posA},{quantity:3,position:posA},{quantity:4,position:posB}]};
  if(kind==='validity-mix')return {lots:3,first:80,second:0,take:5};
  if(kind==='conversion')return {lots:0,first:80,second:0,take:6,boxes:1};
  if(kind==='scale-1')return {lots:1,first:100,second:0,take:1};
  if(kind==='scale-12')return {lots:12,first:100,second:0,take:2};
  if(kind==='scale-60')return {lots:60,first:100,second:0,take:2};
  throw Error('W5_UNKNOWN_SCENARIO');
}
/** Use the actual manual-entry motor to seed canonical stock, then make
 *  synthetic, independently validated LEGACY expiry assignments (not new stock).
 *  Seeding is strictly outside the timer and isolated from production. */
async function seed(kind,version){
  const spec=scenario(kind);
  const operationId='w5init_'+(++ids.operation)+'_'+version;
  const seeded=await registerWarehouseManualEntryServer(access,{
    operationId,existingMaterialId:null,
    description:'Material artificial '+kind,unitLabel:'UN',quantity:spec.first,
    provenance:'Contagem',reference:'W5 demo-only benchmark',
    position:posA,expiresOn:null,barcode:null,
  });
  let material=seeded.material;
  if(spec.second)await registerWarehouseManualEntryServer(access,{
    operationId:'w5second_'+(++ids.operation),existingMaterialId:material.id,
    description:material.description,unitLabel:'UN',quantity:spec.second,
    provenance:'Contagem',reference:'W5 second location',
    position:posB,expiresOn:null,barcode:null,
  });
  const lots=[];
  for(let i=0;i<spec.lots;i++){
    const id=next('lot','lot_'),code='W5-VAL-'+String(i).padStart(3,'0');
    const lot={schemaVersion:'warehouse_lot_v1',id,workspaceId:WS,ug:UG,
      materialId:material.id,code,expiresOn:'2027-12-01',
      quantity:1,position:posA,status:'active',createdBy:access.uid,updatedBy:access.uid,
      origin:{kind:'LEGACY',movementId:null,invoiceRecordKey:null,invoiceId:null,
        supplier:null,supplierCnpj:null}};
    lots.push(lot);
  }
  // Batch seed synthetic legacy references without changing physical stock.
  if(lots.length) {
    for(let i=0;i<lots.length;i+=20)
      await Promise.all(lots.slice(i,i+20).map(lot=>setDoc(ref('lots',lot.id),lot)));
    await setDoc(ref('lotAttributionLocks',material.id),{
      workspaceId:WS,ug:UG,materialId:material.id,revision:1,
    });
  }
  let barcode=null;
  if(spec.boxes){
    const presentation={code:'box',label:'Caixa de 6 unidades'};
    material=await saveWarehouseMaterialServer(access,{
      ...material,conversions:[{presentation,factorToBaseUnit:6}],
    });
    barcode=await warehouseBarcodeServer(access,'SAVE',{
      materialId:material.id,barcode:'789'+String(1000000000+(++ids.seed)).padStart(10,'0'),
      presentation,
    });
  }
  const id=next('withdrawal','wd_');
  let planned=[];
  if(spec.lines){
    planned=spec.lines.map((x,i)=>({quantity:x.quantity,position:x.position,lot:null}));
  } else if(spec.boxes){
    planned=[{quantity:1,position:posA,lot:null}];
  } else {
    // Mirror v3's stable technical allocation (NOT FEFO): reference IDs in order.
    let remaining=spec.take;
    for(const lot of lots) {
      if(!remaining)break;
      planned.push({quantity:1,position:posA,lot});
      remaining--;
    }
    if(remaining)planned.push({quantity:remaining,position:posA,lot:null});
  }
  const lines=planned.map(p=>({
    lineId:next('line','wline_'),materialId:material.id,
    materialDescription:material.description,requestedQuantity:p.quantity,
    baseQuantity:spec.boxes?6:p.quantity,
    presentation:spec.boxes?{code:'box',label:'Caixa de 6 unidades'}:material.unit,
    presentationLabel:spec.boxes?'Caixa de 6 unidades':(material.unit.label||material.unit.code),
    unitLabel:material.unit.label||material.unit.code,
    position:p.position,positionLabel:'W5LOC',
    barcodeAssociation:barcode,barcode:barcode?.barcode||null,
    lotId:p.lot?.id||null,lotCode:p.lot?.code||null,
  }));
  const cmd2={withdrawalId:id,destinationId:destination.id,withdrawnBy:access.email,lines};
  const cmd3={schemaVersion:'warehouse_withdrawal_command_v3',
    withdrawalId:id,destinationId:destination.id,lines:spec.lines
      ?spec.lines.map(l=>({materialId:material.id,position:l.position,
        requestedQuantity:l.quantity}))
      :[{materialId:material.id,position:posA,
          requestedQuantity:spec.boxes?1:spec.take,
          ...(barcode?{barcodeId:barcode.id}:{})}]};
  return {kind,version,spec,material,barcode,lots,cmd:version===2?cmd2:cmd3,
    initial:spec.first+spec.second,take:spec.take};
}
const execute=async(item)=>item.version===2
  ? finalizeWarehouseWithdrawalServer(access,item.cmd)
  : finalizeWarehouseWithdrawalV3Server(access,item.cmd);

async function verify(item,replay=false){
  const header=await read('withdrawals',item.cmd.withdrawalId);
  assert.equal(header?.status,'FINALIZED');
  assert.equal(header?.atomicVersion,item.version);
  const balance=await read('balances',item.material.id);
  assert.equal(balance?.quantity,item.initial-item.take);
  let movementIds=[];
  if(item.version===3){
    const lines=header.effectManifest?.lines;
    assert.ok(Array.isArray(lines)&&lines.length>0,'v3 manifest lines persist');
    movementIds=lines.map(x=>x.movementId);
    assert.equal(lines.reduce((s,x)=>s+x.baseQuantity,0),item.take);
  } else {
    movementIds=await Promise.all(item.cmd.lines.map(line=>
      createWarehouseMovementId(WS,'material-withdrawal:'+item.cmd.withdrawalId+':'+line.lineId)));
  }
  const moves=await Promise.all(movementIds.map(id=>read('movements',id)));
  assert.equal(moves.reduce((s,m)=>s-(m?.quantityDelta||0),0),item.take);
  assert.ok(moves.every(m=>m?.type==='OUTBOUND'&&m?.source?.actorUid===access.uid));
  const consumptions=await Promise.all(moves.map(async move=>
    read('consumptions',move.id&&'cons_'+sha(WS+'\n'+'stock:'+
      item.cmd.withdrawalId+':'+(item.version===3
      ?header.effectManifest.lines.find(x=>x.movementId===move.id).lineId
      :item.cmd.lines.find(line=>move.id===movementIds[item.cmd.lines.indexOf(line)]).lineId)))));
  assert.equal(consumptions.length,moves.length);
  assert.ok(consumptions.every(c=>c?.origin==='STOCK_OUTBOUND'
    &&c?.operatorUid===access.uid&&c?.destinationId===destination.id));
  assert.equal(consumptions.reduce((s,c)=>s+c.quantity,0),item.take);
  if(replay)assert.equal(await read('balances',item.material.id).then(b=>b.quantity),
    item.initial-item.take);
  return {finalBalance:balance.quantity,lines:movementIds.length,
    lotCodes:consumptions.map(c=>c.lotCode).filter(Boolean).sort(),
    presentation:consumptions.map(c=>c.presentationLabel),
    barcode:consumptions.map(c=>c.barcode).filter(Boolean).length};
}

async function runOnce(kind,version,ordinal){
  const item=await seed(kind,version);
  const before=await read('balances',item.material.id);
  assert.equal(before?.quantity,item.initial);
  const result=await probe(()=>execute(item));
  assert.equal(result.value.withdrawal.status,'FINALIZED');
  assert.ok(result.metric.documentsWritten>0,'committed real writes');
  const evidence=await verify(item);
  const replay=await probe(()=>execute(item));
  assert.equal(replay.value.movementIds.length,0);
  assert.equal(replay.metric.documentsWritten,0,'replay must perform no new writes');
  assert.equal(replay.metric.transactionAttempts,0,'replay must bypass a new transaction');
  await verify(item,true);
  return {scenario:kind,version,ordinal,cmdBytes:Buffer.byteLength(JSON.stringify(item.cmd)),
    committed:result.metric,replay:replay.metric,evidence,
    quantity:item.take,initial:item.initial};
}

async function negative(kind,version){
  const item=await seed('multiline',version);
  const initial=(await read('balances',item.material.id)).quantity;
  process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_LINE='2';
  let metric;
  try {
    const response=await probe(()=>execute(item));
    assert.fail('W5_INJECTED_ROLLBACK_DID_NOT_ABORT');
  }catch(e){
    assert.match(String(e.message),/WAREHOUSE_ATOMIC_TEST_INJECTED_FAILURE/);
    metric=e.w5Observed;
  }finally{delete process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_LINE;}
  assert.equal(await read('withdrawals',item.cmd.withdrawalId),null);
  assert.equal((await read('balances',item.material.id)).quantity,initial);
  assert.equal(metric.documentsWritten,0);
  return {scenario:'injected-final-line-rollback',version,metric};
}
async function race(version,same){
  const item=await seed('simple',version);
  // Both competing withdrawals need 60 units; physical stock is 80.
  const modify=(cmd,newId)=>{
    if(version===2)return {...cmd,withdrawalId:newId,
      lines:cmd.lines.map(l=>({...l,lineId:next('line','wline_'),
        requestedQuantity:60,baseQuantity:60,lotId:null,lotCode:null}))};
    return {...cmd,withdrawalId:newId,
      lines:cmd.lines.map(l=>({...l,requestedQuantity:60}))};
  };
  const a={...item,cmd:modify(item.cmd,next('withdrawal','wd_')),take:60};
  const b={...item,cmd:same?a.cmd:modify(item.cmd,next('withdrawal','wd_')),take:60};
  // Concurrent global fetch instrumentation would race; measure total wall
  // and persisted state without monkeypatch. RPC metrics are unavailable here.
  const t0=performance.now();
  const results=await Promise.allSettled([execute(a),execute(b)]);
  const elapsedMs=performance.now()-t0;
  const after=(await read('balances',item.material.id)).quantity;
  const headers=await Promise.all([read('withdrawals',a.cmd.withdrawalId),
    ...(same?[]:[read('withdrawals',b.cmd.withdrawalId)])]);
  assert.equal(after,20,'concurrent withdrawal must debit exactly once');
  assert.equal(headers.filter(h=>h?.status==='FINALIZED').length,1);
  assert.ok(results.some(x=>x.status==='fulfilled'));
  const check=await execute(a).catch(()=>null);
  if(check)assert.equal(check.movementIds.length,0);
  return {scenario:same?'concurrent-same-id':'concurrent-different-ids',
    version,elapsedMs:Number(elapsedMs.toFixed(3)),
    fulfilled:results.filter(x=>x.status==='fulfilled').length,
    rejected:results.filter(x=>x.status==='rejected').length,
    finalBalance:after};
}
async function lostResponse(version){
  const item=await seed('simple',version);
  process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_AFTER_COMMIT=item.cmd.withdrawalId;
  let lost;
  try{await probe(()=>execute(item));assert.fail('W5_RESPONSE_LOSS_NOT_INJECTED')}
  catch(e){assert.match(e.message,/WAREHOUSE_ATOMIC_TEST_RESPONSE_LOST/);lost=e.w5Observed}
  finally{delete process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_AFTER_COMMIT}
  assert.equal((await read('balances',item.material.id)).quantity,78);
  const again=await probe(()=>execute(item));
  assert.equal(again.value.movementIds.length,0);
  assert.equal(again.metric.documentsWritten,0);
  await verify(item,true);
  return {scenario:'response-lost-after-commit',version,first:lost,replay:again.metric};
}

const kinds=['simple','multiline','validity-mix','conversion','scale-1','scale-12','scale-60'];
const records=[],errors=[],checks=[];
try{
  for(const kind of kinds){
    for(let iteration=0;iteration<SAMPLES;iteration++){
      // Alternate order to reduce systematic cache/warm-order bias.
      const order=iteration%2?[3,2]:[2,3];
      for(const v of order){
        const record=await runOnce(kind,v,iteration);
        records.push(record);
        console.log('W5 TX PASS '+kind+' v'+v+' '+(iteration+1));
      }
    }
  }
  for(const version of [2,3]){
    checks.push(await negative('rollback',version));
    checks.push(await lostResponse(version));
    checks.push(await race(version,true));
    checks.push(await race(version,false));
    console.log('W5 INTEGRITY PASS v'+version);
  }
  const table=kinds.map(kind=>{
    const versions={};
    for(const version of [2,3]){
      const all=records.filter(x=>x.scenario===kind&&x.version===version);
      versions['v'+version]={
        samples:all.length,commandBytes:summary(all.map(x=>x.cmdBytes)),
        endToEndMs:summary(all.map(x=>x.committed.totalMs)),
        replayMs:summary(all.map(x=>x.replay.totalMs)),
        rpc:summary(all.map(x=>x.committed.rpc)),
        batchGet:summary(all.map(x=>x.committed.batchGet)),
        runQuery:summary(all.map(x=>x.committed.runQuery)),
        requestedPaths:summary(all.map(x=>x.committed.pathsRequested)),
        docsReturned:summary(all.map(x=>x.committed.docsReturned)),
        documentWrites:summary(all.map(x=>x.committed.documentsWritten)),
        transactionAttempts:summary(all.map(x=>x.committed.transactionAttempts)),
        beforeTransactionRpcMs:summary(all.map(x=>x.committed.beforeTransactionMs)),
        transactionRpcMs:summary(all.map(x=>x.committed.transactionRpcMs)),
        replayRpc:summary(all.map(x=>x.replay.rpc)),
        replayDocsReturned:summary(all.map(x=>x.replay.docsReturned)),
      };
    }
    return {scenario:kind,...versions,
      latencyDeltaMedianMs:Number((versions.v3.endToEndMs.medianMs-versions.v2.endToEndMs.medianMs).toFixed(3)),
      rpcDeltaMedian:versions.v3.rpc.medianMs-versions.v2.rpc.medianMs};
  });
  const output={schema:'core_lean_r2_w5_transaction_comparison_v1',
    date:new Date().toISOString(),project:PROJECT,database:DB,
    workspace:'synthetic-founder-demo-only',engineSha:process.env.W5_ENGINE_SHA||'NOT_PINNED',
    samplesPerVersion:SAMPLES,node:process.version,
    assertions:'Real Warehouse v2/v3 engines, authenticated demo Emulator, independent but functionally equivalent seeded materials; no production',
    limitations:['No real browser/network RTT','RPC/doc counts are not billed reads or index costs',
      'Different technical material IDs isolate v2/v3 and do not claim identical document IDs',
      'Synthetic LEGACY lots assign existing stock, no financial NF source',
      'Finite small-sample p95 is not a production SLA'],
    table,checks,records};
  const filename=process.env.W5_TRANSACTION_REPORT||'w5-transactions.json';
  writeFileSync(filename,JSON.stringify(output,null,2)+'\n');
  console.log('W5_TRANSACTION_BENCHMARK_COMPLETE '+filename);
  console.log('W5_TRANSACTION_TABLE '+JSON.stringify(table.map(t=>({
    scenario:t.scenario,v2_p50:t.v2.endToEndMs.medianMs,v3_p50:t.v3.endToEndMs.medianMs,
    v2_rpc:t.v2.rpc.medianMs,v3_rpc:t.v3.rpc.medianMs,
    v2_writes:t.v2.documentWrites.medianMs,v3_writes:t.v3.documentWrites.medianMs
  }))));
} catch(error){
  errors.push({code:String(error?.message||error)});
  console.error('W5_TRANSACTION_BENCHMARK_FAIL',error);
  process.exitCode=1;
} finally{
  await deleteApp(app);
}
