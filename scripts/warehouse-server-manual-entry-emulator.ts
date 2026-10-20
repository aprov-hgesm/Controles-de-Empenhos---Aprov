#!/usr/bin/env node
/**
 * E2E servidor + Firestore Emulator para entrada avulsa.
 * Iniciado exclusivamente pelo CI com emuladores isolados demo.
 */
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { verifyWarehouseRequest } from '../lib/server/warehouseAccess';
import { registerWarehouseManualEntryServer } from '../lib/server/warehouseManualEntry';
import { transferWarehouseStockServer } from '../lib/server/warehouseTransfer';

process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR = '1';
process.env.EMPROVEX_E2E_SERVER_AUTH = '1';
process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID = 'demo-emprovex-security';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const workspaceId='hgesm-aprov',ug='160416';
const dep='dep_'+'6'.repeat(32),loc='loc_'+'7'.repeat(32),sub='sub_'+'8'.repeat(32);
const position={kind:'LOCATION' as const,depotId:dep,locationId:loc,subpositionId:null};
const subposition={kind:'SUBPOSITION' as const,depotId:dep,locationId:loc,subpositionId:sub};
const app=initializeApp({
  projectId:'demo-emprovex-security',apiKey:'fake-api-key',
  authDomain:'demo-emprovex-security.firebaseapp.com',
},'warehouse-server-manual-entry-e2e');
async function main(): Promise<void> {
try {
  const auth=getAuth(app);
  connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
  const credential=await signInWithCredential(auth,GoogleAuthProvider.credential(JSON.stringify({
    sub:'manual-server-emulator-founder',email:'aprov1hgesm@gmail.com',email_verified:true,
  })));
  const db=getFirestore(app,'emprovex-warehouse');
  connectFirestoreEmulator(db,'127.0.0.1',8080);
  const ref=(kind:string,id:string)=>doc(db,'warehouse',workspaceId,kind,id);
  const uid=credential.user.uid;
  await setDoc(ref('depots',dep),{
    schemaVersion:'warehouse_depot_v1',id:dep,workspaceId,ug,
    code:'DEP-MANUAL',name:'Depósito teste manual',description:null,
    visualType:'CONTAINER',sizeProfile:'MEDIUM',status:'active',
    createdBy:uid,updatedBy:uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
  });
  for(const [id,kind,parent,code] of [
    [loc,'LOCAL',null,'LOC-MANUAL'],[sub,'SUBPOSITION',loc,'SUB-MANUAL'],
  ] as const){
    await setDoc(ref('locations',id),{
      schemaVersion:'warehouse_location_v1',id,workspaceId,ug,depotId:dep,
      kind,parentLocationId:parent,code,name:code,description:null,status:'active',
      createdBy:uid,updatedBy:uid,
      createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
    });
  }
  const access=await verifyWarehouseRequest('Bearer '+await credential.user.getIdToken());
  assert.equal(access.workspaceId,workspaceId);
  assert.equal(access.uid,uid);
  const firstInput={
    operationId:'manual-server-entry-001',existingMaterialId:null,
    description:'Arroz integral',unitLabel:'KG',quantity:80,
    provenance:'Contagem',reference:'Inventário de teste',
    position,expiresOn:'2027-04-18',barcode:'7896305701574',
  };
  const first=await registerWarehouseManualEntryServer(access,firstInput);
  assert.equal(first.entry.applied,true);
  assert.equal(first.entry.balance.quantity,80);
  assert.equal(first.locationBalance.quantity,80);
  assert.ok(first.validity);
  assert.equal(first.barcodeLinked,true);
  assert.ok((await getDoc(ref('lots',first.validity!.id))).exists());
  const replay=await registerWarehouseManualEntryServer(access,firstInput);
  assert.equal(replay.entry.applied,false);
  assert.equal(replay.entry.balance.quantity,80);
  console.log('PASS: criação atômica, lote, barcode e replay idempotente');

  await assert.rejects(
    ()=>registerWarehouseManualEntryServer(access,{...firstInput,quantity:81}),
    /WAREHOUSE_IDEMPOTENCY_CONFLICT/
  );
  assert.equal((await getDoc(ref('balances',first.material.id))).data()?.quantity,80);
  console.log('PASS: replay divergente negado sem mexer no estoque');

  const second=await registerWarehouseManualEntryServer(access,{
    operationId:'manual-server-entry-002',
    existingMaterialId:first.material.id,
    description:'Arroz integral',unitLabel:'KG',quantity:20,
    provenance:'Contagem',reference:null,
    position:subposition,expiresOn:null,barcode:'7896305701574',
  });
  assert.equal(second.entry.balance.quantity,100);
  assert.equal(second.locationBalance.quantity,20);
  console.log('PASS: material existente em outra subposição sem duplicar barcode');

  await assert.rejects(()=>registerWarehouseManualEntryServer(access,{
    ...firstInput,operationId:'manual-server-entry-003',
    position:{...position,locationId:'loc_'+'f'.repeat(32)},
  }),/WAREHOUSE_MANUAL_ENTRY_POSITION_REQUIRED/);
  assert.equal((await getDoc(ref('balances',first.material.id))).data()?.quantity,100);
  console.log('PASS: localização inexistente não altera saldo');

  const moved=await transferWarehouseStockServer(access,{
    materialId:first.material.id,quantity:5,from:position,to:subposition,
    idempotencyKey:'warehouse-r2-transfer-0001',note:'QA R2 FEFO',
  });
  assert.equal(moved.applied,true);
  assert.equal(moved.fromBalance.quantity,75);
  assert.equal(moved.toBalance.quantity,25);
  assert.equal(moved.balance.quantity,100);
  const sourceLot=(await getDoc(ref('lots',first.validity!.id))).data();
  assert.equal(sourceLot?.quantity,75);
  console.log('PASS: transferência server com divisão de lote FEFO 80→75 e destino +5');
  const moveReplay=await transferWarehouseStockServer(access,{
    materialId:first.material.id,quantity:5,from:position,to:subposition,
    idempotencyKey:'warehouse-r2-transfer-0001',note:'QA R2 FEFO',
  });
  assert.equal(moveReplay.applied,false);
  assert.equal(moveReplay.toBalance.quantity,25);
  await assert.rejects(()=>transferWarehouseStockServer(access,{
    materialId:first.material.id,quantity:6,from:position,to:subposition,
    idempotencyKey:'warehouse-r2-transfer-0001',note:'QA R2 FEFO',
  }),/WAREHOUSE_IDEMPOTENCY_CONFLICT/);
  await assert.rejects(()=>transferWarehouseStockServer(access,{
    materialId:first.material.id,quantity:1000,from:position,to:subposition,
    idempotencyKey:'warehouse-r2-transfer-0002',note:'Estoque insuficiente',
  }),/WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK/);
  assert.equal((await getDoc(ref('balances',first.material.id))).data()?.quantity,100);
  console.log('PASS: transferência replay e estoque insuficiente sem dupla movimentação');

  await assert.rejects(()=>verifyWarehouseRequest(null));
  console.log('PASS: API gate sem token rejeita a solicitação');
  console.log('SERVER MANUAL ENTRY EMULATOR PASS');
} finally {
  await deleteApp(app);
}
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
