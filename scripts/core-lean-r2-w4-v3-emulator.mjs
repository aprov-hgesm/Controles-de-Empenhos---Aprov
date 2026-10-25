#!/usr/bin/env node
/** Independent W4 black-box v3 adversarial suite. Emulators ONLY. No fake green. */
import assert from 'node:assert/strict';
import {initializeApp, deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,GoogleAuthProvider,signInWithCredential} from 'firebase/auth';
import {getFirestore,connectFirestoreEmulator,doc,getDoc,setDoc,serverTimestamp} from 'firebase/firestore';
import {verifyWarehouseRequest} from '../lib/server/warehouseAccess';
import {registerWarehouseManualEntryServer} from '../lib/server/warehouseManualEntry';
import {warehouseDestinationCreateServer} from '../lib/server/warehouseDestinationWrite';
import {saveWarehouseMaterialServer} from '../lib/server/warehouseMaterialWrite';
import {warehouseBarcodeServer} from '../lib/server/warehouseRemainingWrites';
import {finalizeWarehouseWithdrawalV3Server} from '../lib/server/warehouseWithdrawalV3Write';
import {warehouseWithdrawalV3IntentHash as hash,warehouseWithdrawalV3DerivedLineId as lineId} from '../lib/server/warehouseWithdrawalV3Identity.mjs';
import {atomicWarehouseWithdrawalHash} from '../lib/server/warehouseWithdrawalAtomicWrite';

const project='demo-emprovex-security',ws='hgesm-aprov',ug='160416';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'
  ||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099'
  ||process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID!==project)
  throw Error('W4_V3_REQUIRES_EXACT_ISOLATED_EMULATORS');
process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR='1';
process.env.EMPROVEX_E2E_SERVER_AUTH='1';
const app=initializeApp({projectId:project,apiKey:'fake',authDomain:project+'.firebaseapp.com'},'w4-independent-v3');
const id=(p,n)=>p+n.toString(16).padStart(32,'0');
const dep=id('dep_',600),loc=id('loc_',601);
const pos={kind:'LOCATION',depotId:dep,locationId:loc,subpositionId:null};
const pass=(name)=>console.log('W4 V3 PASS '+name);
async function main() {
try{
  const auth=getAuth(app);
  connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
  const session=await signInWithCredential(auth,GoogleAuthProvider.credential(
    JSON.stringify({sub:'w4-v3-founder',email:'aprov1hgesm@gmail.com',email_verified:true})));
  const access=await verifyWarehouseRequest('Bearer '+await session.user.getIdToken());
  assert.equal(access.uid,session.user.uid);
  assert.equal(access.workspaceId,ws);assert.equal(access.ug,ug);
  await assert.rejects(()=>verifyWarehouseRequest(null));
  await assert.rejects(()=>verifyWarehouseRequest('Bearer spoofed'));
  const db=getFirestore(app,'emprovex-warehouse');
  connectFirestoreEmulator(db,'127.0.0.1',8080);
  const ref=(kind,key)=>doc(db,'warehouse',ws,kind,key);
  const read=async(kind,key)=>(await getDoc(ref(kind,key))).data()??null;
  await setDoc(ref('depots',dep),{schemaVersion:'warehouse_depot_v1',id:dep,workspaceId:ws,ug,
    code:'W4V3',name:'Depósito W4 V3',description:null,visualType:'CONTAINER',
    sizeProfile:'MEDIUM',status:'active',createdBy:access.uid,updatedBy:access.uid,
    createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  await setDoc(ref('locations',loc),{schemaVersion:'warehouse_location_v1',
    id:loc,workspaceId:ws,ug,depotId:dep,kind:'LOCAL',parentLocationId:null,
    code:'W4V3LOC',name:'Local V3',description:null,status:'active',
    createdBy:access.uid,updatedBy:access.uid,createdAt:serverTimestamp(),
    updatedAt:serverTimestamp()});
  const dest=await warehouseDestinationCreateServer(access,{name:'Cozinha v3'});
  const seed=await registerWarehouseManualEntryServer(access,{
    operationId:'w4-v3-lot-a',existingMaterialId:null,description:'Produto W4 V3',
    unitLabel:'KG',quantity:24,provenance:'Contagem',reference:'W4',position:pos,
    expiresOn:'2027-12-01',lotCode:'W4A',barcode:null});
  if(!seed.validity)throw Error('W4_V3_INVALID_SEED');
  const material=seed.material,mat=material.id,lotA=seed.validity.id;
  const seedB=await registerWarehouseManualEntryServer(access,{
    operationId:'w4-v3-lot-b',existingMaterialId:mat,
    description:material.description,unitLabel:'KG',quantity:5,
    provenance:'Contagem',reference:'W4',position:pos,
    expiresOn:'2027-11-01',lotCode:'W4B',barcode:null});
  if(!seedB.validity)throw Error('W4_V3_SEED_B_INVALID');
  const lotB=seedB.validity.id;
  await registerWarehouseManualEntryServer(access,{
    operationId:'w4-v3-free',existingMaterialId:mat,
    description:material.description,unitLabel:'KG',quantity:8,
    provenance:'Contagem',reference:'W4',position:pos,
    expiresOn:null,barcode:null});
  const cmd=(n,lines)=>({
    schemaVersion:'warehouse_withdrawal_command_v3',withdrawalId:id('wd_',n),
    destinationId:dest.id,lines});
  const line=(quantity)=>({
    materialId:mat,position:pos,requestedQuantity:quantity});
  const stock=async()=>Number((await read('balances',mat))?.quantity);
  const docs=async(input)=>{
    const h=await read('withdrawals',input.withdrawalId);
    const entries=await Promise.all((h?.effectManifest?.lines??[]).map(async (entry)=>({
      entry,m:await read('movements',entry.movementId),c:await read('consumptions',entry.consumptionId),
    })));
    return {h,entries};
  };
  const verify=async(input,base)=>{
    const {h,entries}=await docs(input);
    assert.equal(h?.atomicVersion,3);assert.equal(h?.status,'FINALIZED');
    assert.equal(h?.createdBy,access.uid);assert.equal(h?.payloadHash,hash(input));
    assert.equal(h?.intentLineCount,input.lines.length);
    assert.equal(h?.effectManifest?.schemaVersion,'warehouse_withdrawal_effects_v3');
    assert.equal(entries.length,h?.expectedLineCount);
    assert.equal(h?.expectedLineCount,h?.appliedLineCount);
    let total=0;
    for(const {entry,m,c} of entries){
      assert.ok(m,'missing persisted movement');assert.ok(c,'missing persisted consumption');
      assert.equal(entry.lineId,lineId(input.withdrawalId,entry.intentIndex,entry.partIndex));
      assert.equal(m.id,entry.movementId);assert.equal(c.id,entry.consumptionId);
      assert.equal(m.workspaceId,ws);assert.equal(c.workspaceId,ws);
      assert.equal(m.ug,ug);assert.equal(c.ug,ug);
      assert.equal(m.source.actorUid,access.uid);assert.equal(c.operatorUid,access.uid);
      assert.equal(m.quantityDelta,-entry.baseQuantity);assert.equal(c.quantity,entry.baseQuantity);
      assert.equal(c.withdrawalId,input.withdrawalId);
      assert.equal(c.lineId,entry.lineId);assert.equal(c.movementId,m.id);
      assert.equal(c.destinationId,dest.id);assert.equal(c.withdrawnBy,access.email);
      assert.equal(m.source.lotId,entry.lotId);
      total+=entry.baseQuantity;
    }
    assert.equal(total,base);
    return {h,entries};
  };
  const assertAbsent=async(input)=>{
    assert.equal(await read('withdrawals',input.withdrawalId),null,
      'rejected command created a header');
  };
  const mutate=async(path,method,fields)=>{
    const uri='http://127.0.0.1:8080/v1/projects/'+project+
      '/databases/emprovex-warehouse/documents/warehouse/'+ws+'/'+path+
      (method==='PATCH'?'?updateMask.fieldPaths=effectManifestHash':'');
    const response=await fetch(uri,{method,headers:{authorization:'Bearer owner','content-type':'application/json'},
      ...(fields?{body:JSON.stringify({fields})}:{})});
    assert.equal(response.ok,true,'isolated forensic mutation '+path+':'+response.status);
  };
  assert.equal(await stock(),37);
  const minimal=cmd(610,[line(1)]);
  assert.match(hash(minimal),/^[a-f0-9]{64}$/);
  assert.equal(hash(minimal),hash(structuredClone(minimal)));
  assert.notEqual(hash(minimal),hash(cmd(610,[line(2)])));
  assert.notEqual(lineId(minimal.withdrawalId,0,0),lineId(minimal.withdrawalId,0,1));
  assert.notEqual(lineId(minimal.withdrawalId,0,0),lineId(minimal.withdrawalId,1,0));
  const old=atomicWarehouseWithdrawalHash({withdrawalId:minimal.withdrawalId,
    destinationId:dest.id,withdrawnBy:access.email,lines:[]});
  assert.notEqual(old,hash(minimal));
  pass('versioned intent, deterministic split IDs, v2/v3 hash isolation');
  for(const field of ['workspaceId','ug','withdrawnBy','createdBy','balance']){
    const payload={...minimal,[field]:'forged'};
    await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,payload),
      /WAREHOUSE_WITHDRAWAL_V3_INPUT_INVALID/);
  }
  const invalid=cmd(611,[{...line(2),lotId:'lot_forged'}]);
  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,invalid));
  await assertAbsent(invalid);
  pass('forged authorship/scope/lot and untrusted fields rejected');
  const multi=cmd(612,[line(20),line(12)]);
  const executed=await finalizeWarehouseWithdrawalV3Server(access,multi);
  assert.equal(executed.withdrawal.status,'FINALIZED');
  const good=await verify(multi,32);
  assert.deepEqual(good.entries.map(x=>x.entry.intentIndex).filter(x=>x===1).length>0,true);
  assert.equal(await stock(),5);
  const repeat=await finalizeWarehouseWithdrawalV3Server(access,multi);
  assert.equal(repeat.movementIds.length,0);await verify(multi,32);
  assert.equal(await stock(),5);
  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,cmd(612,[line(20),line(11)])),
    /IDEMPOTENCY_CONFLICT/);
  pass('multiple intents/multiple expiries/free stock, immutable ledger and divergent replay');

  const lost=cmd(613,[line(1)]);
  process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_AFTER_COMMIT=lost.withdrawalId;
  try{await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,lost),
      /WAREHOUSE_ATOMIC_TEST_RESPONSE_LOST/);}
  finally{delete process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_AFTER_COMMIT;}
  await verify(lost,1);
  assert.equal((await finalizeWarehouseWithdrawalV3Server(access,lost)).movementIds.length,0);
  assert.equal(await stock(),4);
  pass('lost response after v3 commit, replay confirms evidence without double-debit');

  const updated=await saveWarehouseMaterialServer(access,{
    ...material,description:'Novo nome v3',conversions:[{
      presentation:{code:'box',label:'Caixa 2 KG'},factorToBaseUnit:2,
    }]});
  assert.equal(updated.conversions.length,1);
  const box=cmd(614,[{...line(1),presentationCode:'box'}]);
  await finalizeWarehouseWithdrawalV3Server(access,box);
  const proof=await verify(box,2);
  const e=proof.entries[0];
  assert.equal(e.entry.originalRequestedQuantity,1);
  assert.equal(e.entry.originalPresentationCode,'box');
  assert.equal(e.entry.factorToBaseUnit,2);
  assert.equal(e.c.operatorRequestedQuantity,1);
  assert.equal(e.c.operatorPresentationCode,'box');
  assert.equal(e.c.operatorFactorToBaseUnit,2);
  assert.equal(e.c.quantity,2);
  assert.equal((await finalizeWarehouseWithdrawalV3Server(access,box)).movementIds.length,0);
  assert.equal(await stock(),2);
  pass('operator-facing box provenance, requested 1 box/2KG base, replay after label change');

  const barcode=await warehouseBarcodeServer(access,'SAVE',{
    barcode:'7896305701994',materialId:mat,presentation:material.unit,
  });
  assert.ok(barcode.id);
  const scanned=cmd(615,[{...line(1),barcodeId:barcode.id}]);
  const defects=[];
  let manifestCase=scanned;
  try {
    await finalizeWarehouseWithdrawalV3Server(access,scanned);
    const bd=await verify(scanned,1);
    for(const item of bd.entries){
      assert.equal(item.m.source.barcodeId,barcode.id);
      assert.equal(item.c.barcode,'7896305701994');
      assert.equal(item.entry.barcodeId,barcode.id);
    }
    assert.equal(await stock(),1);
    pass('item barcode association preserved in movement, consumption and v3 manifest');
  }catch(error){
    console.error('W4 V3 FAIL: item barcode, preserving error for final exit',error);
    defects.push(error);
    await assertAbsent(scanned);
    assert.equal(await stock(),2);
    const fallback=cmd(629,[line(1)]);
    await finalizeWarehouseWithdrawalV3Server(access,fallback);
    await verify(fallback,1);
    assert.equal(await stock(),1);
    manifestCase=fallback;
  }

  const insufficient=cmd(616,[line(2)]);
  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,insufficient));
  await assertAbsent(insufficient);
  assert.equal(await stock(),1);
  pass('rejected operation does not leave v3 header or balance drift');
  const same=cmd(617,[line(1)]);
  await Promise.allSettled([finalizeWarehouseWithdrawalV3Server(access,same),
    finalizeWarehouseWithdrawalV3Server(access,same)]);
  await finalizeWarehouseWithdrawalV3Server(access,same);
  await verify(same,1);assert.equal(await stock(),0);
  pass('same ID concurrent v3 command converges to one debit');
  const differentA=cmd(618,[line(1)]),differentB=cmd(619,[line(1)]);
  await Promise.allSettled([finalizeWarehouseWithdrawalV3Server(access,differentA),
    finalizeWarehouseWithdrawalV3Server(access,differentB)]);
  await assertAbsent(differentA);await assertAbsent(differentB);assert.equal(await stock(),0);
  pass('two different IDs cannot overdraw an exhausted stock');

  const foreign=cmd(620,[{...line(1),materialId:id('mat_',620)}]);
  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,foreign));
  await assertAbsent(foreign);
  const wrongUg=cmd(621,[line(1)]);
  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server({...access,ug:'999999'},wrongUg));
  await assertAbsent(wrongUg);
  pass('institutional UG and cross-material scope enforced');
  const ceiling=cmd(622,Array.from({length:41},()=>line(1)));
  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,ceiling));
  await assertAbsent(ceiling);
  pass('max logical lines fail closed');

  // Three isolated forgeries; do not repair them automatically or issue another debit.
  const corrupt=cmd(623,[line(1)]);
  const header=await read('withdrawals',multi.withdrawalId);
  const manifest=header?.effectManifest;
  assert.ok(manifest,'real v3 manifest fixture required');
  
  // Use an authentic committed v3 header, but strip a record on a separate command?
  // The isolated emulator has no stock left. Replay the already committed commands:
  const missingMovement=good.entries[0];
  await mutate('movements/'+missingMovement.entry.movementId,'DELETE');
  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,multi),
    /RECONCILIATION_REQUIRED/);
  assert.equal(await stock(),0);
  pass('v3 replay refuses FINALIZED missing movement; never re-debits');
  const missingConsumption=proof.entries[0];
  await mutate('consumptions/'+missingConsumption.entry.consumptionId,'DELETE');
  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,box),
    /RECONCILIATION_REQUIRED/);
  assert.equal(await stock(),0);
  pass('v3 replay refuses FINALIZED missing consumption');
  // Mutating a manifest requires a full JSON-to-Firestore transformation; corrupt
  // its stored hash instead, which must fail manifest integrity without writes.
  assert.ok(await read('withdrawals',manifestCase.withdrawalId));
  await mutate('withdrawals/'+manifestCase.withdrawalId,'PATCH',{
    effectManifestHash:{stringValue:'f'.repeat(64)},
  });
  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,manifestCase),
    /RECONCILIATION_REQUIRED/);
  assert.equal(await stock(),0);
  pass('v3 replay rejects tampered effect manifest hash');
  if(defects.length)throw new AggregateError(defects,'W4 v3: preserved genuine domain FAIL(s)');
  console.log('W4 V3 ASSURANCE COMPLETE');
} finally{await deleteApp(app);}
}
function firestoreValue(v){
  if(v===null||v===undefined)return {nullValue:null};
  if(typeof v==='string')return {stringValue:v};
  if(typeof v==='number')return Number.isSafeInteger(v)?{integerValue:String(v)}:{doubleValue:v};
  if(typeof v==='boolean')return {booleanValue:v};
  if(Array.isArray(v))return {arrayValue:{values:v.map(firestoreValue)}};
  if(typeof v==='object')return {mapValue:{fields:Object.fromEntries(
    Object.entries(v).map(([k,val])=>[k,firestoreValue(val)]))}};
  throw Error('Unsupported fixture type');
}
main().catch(e=>{console.error('W4 V3 FAIL',e);process.exitCode=1;});
