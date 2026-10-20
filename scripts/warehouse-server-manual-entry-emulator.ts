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
import { warehouseStructureServer } from '../lib/server/warehouseStructureWrite';
import { warehouseDestinationCreateServer, warehouseDestinationSetStatusServer } from '../lib/server/warehouseDestinationWrite';
import { saveWarehouseMaterialServer } from '../lib/server/warehouseMaterialWrite';
import { saveWarehouseLandingVisualServer } from '../lib/server/warehouseLandingVisualWrite';

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

  const newDepot=await warehouseStructureServer(access,{
    kind:'DEPOT_CREATE',input:{
      code:'DEPR2QA',name:'Depósito servidor R2',description:'Teste isolado',
      visualType:'STANDARD',sizeProfile:'SMALL',
    },
  });
  if(!('id' in newDepot)) throw new Error('DEPOSIT_SERVER_RESULT_INVALID');
  assert.ok((await getDoc(ref('depots',newDepot.id))).exists());
  await assert.rejects(()=>warehouseStructureServer(access,{
    kind:'DEPOT_CREATE',input:{code:'DEPR2QA',name:'Outro duplicado'},
  }),/WAREHOUSE_DEPOT_DUPLICATE_CODE/);
  const newLoc=await warehouseStructureServer(access,{
    kind:'LOCATION_CREATE',input:{depotId:newDepot.id,kind:'LOCAL',
      code:'LOCR2QA',name:'Local servidor R2',description:null},
  });
  if(!('id' in newLoc)) throw new Error('LOCATION_SERVER_RESULT_INVALID');
  assert.ok((await getDoc(ref('locations',newLoc.id))).exists());
  const newSub=await warehouseStructureServer(access,{
    kind:'LOCATION_CREATE',input:{depotId:newDepot.id,kind:'SUBPOSITION',
      parentLocationId:newLoc.id,code:'SUBR2QA',name:'Subposição servidor R2'},
  });
  if(!('id' in newSub)) throw new Error('SUB_SERVER_RESULT_INVALID');
  assert.ok((await getDoc(ref('locations',newSub.id))).exists());
  const updated=await warehouseStructureServer(access,{
    kind:'LOCATION_UPDATE',locationId:newLoc.id,
    input:{name:'Local servidor R2 atualizado'},
  });
  assert.equal((updated as {ok:boolean}).ok,true);
  assert.equal((await getDoc(ref('locations',newLoc.id))).data()?.name,'Local servidor R2 atualizado');
  console.log('PASS: estrutura R2 CRUD servidor e unicidade por código');
  const inactiveDepot=await warehouseStructureServer(access,{
    kind:'DEPOT_CREATE',input:{code:'REUSER2',name:'Depósito a desativar'},
  });
  if(!('id' in inactiveDepot)) throw new Error('INACTIVE_DEPOT_MISSING');
  await warehouseStructureServer(access,{
    kind:'DEPOT_UPDATE',depotId:inactiveDepot.id,input:{status:'inactive'},
  });
  const replacementDepot=await warehouseStructureServer(access,{
    kind:'DEPOT_CREATE',input:{code:'REUSER2',name:'Depósito substituto'},
  });
  if(!('id' in replacementDepot)) throw new Error('REPLACEMENT_DEPOT_MISSING');
  assert.notEqual(replacementDepot.id,inactiveDepot.id);
  await assert.rejects(()=>warehouseStructureServer(access,{
    kind:'DEPOT_UPDATE',depotId:inactiveDepot.id,input:{status:'active'},
  }),/WAREHOUSE_DEPOT_DUPLICATE_CODE/);
  assert.equal((await getDoc(ref('depots',inactiveDepot.id))).data()?.status,'inactive');
  console.log('PASS: código de depósito inativo reutilizado, reativação antiga bloqueada');



  const newDestination=await warehouseDestinationCreateServer(access,{name:'Cozinha R2 Teste'});
  assert.ok((await getDoc(ref('destinations',newDestination.id))).exists());
  await warehouseDestinationSetStatusServer(access,{
    destinationId:newDestination.id,status:'inactive',
  });
  assert.equal((await getDoc(ref('destinations',newDestination.id))).data()?.status,'inactive');
  const updatedMaterial=await saveWarehouseMaterialServer(access,{
    ...first.material,aliases:['Arroz integral QA'],
  });
  assert.equal(updatedMaterial.aliases[0],'Arroz integral QA');
  await assert.rejects(()=>saveWarehouseMaterialServer(access,{
    ...first.material,unit:{code:'g',label:null},
  }),/WAREHOUSE_MATERIAL_UNIT_LOCKED/);
  console.log('PASS: destinos e materiais alterados por servidor com unidade protegida');
  const visualPayload={[newDepot.id]:{offsetX:12,offsetY:-9}};
  const visual1=await saveWarehouseLandingVisualServer(access,visualPayload);
  assert.equal(visual1.overrides[newDepot.id].offsetX,12);
  const visual2=await saveWarehouseLandingVisualServer(access,visualPayload);
  assert.equal(visual1.updatedAt,visual2.updatedAt);
  await assert.rejects(()=>saveWarehouseLandingVisualServer(access,{
    [newDepot.id]:{offsetX:9999,offsetY:0},
  }),/WAREHOUSE_LANDING_VISUAL_INVALID/);
  assert.ok((await getDoc(ref('settings','landing-visual-layout'))).exists());
  console.log('PASS: layout visual server-only sem regravar estado idêntico');


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
