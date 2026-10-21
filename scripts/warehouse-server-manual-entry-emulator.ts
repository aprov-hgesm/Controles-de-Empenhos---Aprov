#!/usr/bin/env node
/**
 * E2E servidor + Firestore Emulator para entrada avulsa.
 * Iniciado exclusivamente pelo CI com emuladores isolados demo.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
import { saveWarehouseLogisticsSettingsServer } from '../lib/server/warehouseLogisticsSettingsWrite';
import { excludeWarehouseQueueServer } from '../lib/server/warehouseQueueExclusionWrite';
import { writeWarehouseLotServer } from '../lib/server/warehouseLotWrite';
import { applyWarehouseExpressOutboundServer } from '../lib/server/warehouseOutboundWrite';
import { returnWarehouseStockOutboundServer } from '../lib/server/warehouseReturnWrite';
import { finalizeWarehouseWithdrawalServer } from '../lib/server/warehouseWithdrawalWrite';
import { setWarehouseConsumptionSiscofisStatusServer } from '../lib/server/warehouseConsumptionStatusWrite';
import { startWarehouseInventoryServer } from '../lib/server/warehouseInventoryStart';
import { warehouseInventoryLifecycleServer } from '../lib/server/warehouseInventoryLifecycle';
import { adjustWarehouseInventoryServer } from '../lib/server/warehouseInventoryAdjustment';
import { warehouseBarcodeServer,warehouseLayoutSaveServer,warehouseIntakeStateServer } from '../lib/server/warehouseRemainingWrites';
import { warehouseQueueIndexServer } from '../lib/server/warehouseQueueIndexWrite';
import { warehouseLogisticsAlertsServer } from '../lib/server/warehouseLogisticsAlertWrite';
import { warehouseLedgerMovementServer,warehouseStructureArchiveServer } from '../lib/server/warehouseLedgerAndArchive';
import { createWarehouseItemIntakeId } from '../lib/warehouse/intake';
import { createWarehouseInventoryItemId } from '../lib/warehouse/inventory';


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
    position,expiresOn:'2027-04-18',lotCode:'LOTE-CONTAGEM-001',barcode:'7896305701574',
  };
  const first=await registerWarehouseManualEntryServer(access,firstInput);
  assert.equal(first.entry.applied,true);
  assert.equal(first.entry.balance.quantity,80);
  assert.equal(first.locationBalance.quantity,80);
  assert.ok(first.validity);
  assert.equal(first.validity.code,'LOTE-CONTAGEM-001');
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
  const secondReplay=await registerWarehouseManualEntryServer(access,{
    operationId:'manual-server-entry-002',
    existingMaterialId:first.material.id,
    description:'Arroz integral',unitLabel:'KG',quantity:20,
    provenance:'Contagem',reference:null,
    position:subposition,expiresOn:null,barcode:'7896305701574',
  });
  assert.equal(secondReplay.entry.applied,false);
  assert.equal(secondReplay.entry.balance.quantity,100);
  console.log('PASS: entrada legada sem código de lote permanece idempotente');

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
  const changedLot=await writeWarehouseLotServer(access,'UPDATE',{
    lotId:first.validity!.id,input:{expiresOn:'2027-05-01'},
  });
  assert.equal(changedLot.expiresOn,'2027-05-01');
  assert.equal((await getDoc(ref('lots',first.validity!.id))).data()?.quantity,75);
  await assert.rejects(()=>writeWarehouseLotServer(access,'CREATE',{
    materialId:first.material.id,code:'QA-LOT-EXCESS',quantity:1,
    position,expiresOn:'2027-06-01',
  }),/WAREHOUSE_LOT_ATTRIBUTION_EXCEEDS_STOCK/);
  await assert.rejects(()=>writeWarehouseLotServer(access,'CREATE',{
    materialId:first.material.id,code:'QA-LOT-UNASSIGNED',quantity:1,
    position:{kind:'UNASSIGNED'},
  }),/WAREHOUSE_LOT_PHYSICAL_POSITION_REQUIRED/);
  console.log('PASS: lotes no servidor protegidos contra superatribuição e posição inválida');

  const outboundInput={
    materialId:first.material.id,requestedQuantity:3,presentation:first.material.unit,
    position,barcodeAssociation:null,lotId:first.validity!.id,
    idempotencyKey:'warehouse-r2-express-outbound-01',note:'Emulator saída expressa',
  };
  const outbound=await applyWarehouseExpressOutboundServer(access,outboundInput);
  assert.equal(outbound.applied,true);
  assert.equal(outbound.balance.quantity,97);
  assert.equal(outbound.locationBalance.quantity,72);
  assert.equal(outbound.lot?.quantity,72);
  const outboundReplay=await applyWarehouseExpressOutboundServer(access,outboundInput);
  assert.equal(outboundReplay.applied,false);
  assert.equal(outboundReplay.balance.quantity,97);
  await assert.rejects(()=>applyWarehouseExpressOutboundServer(access,{
    ...outboundInput,requestedQuantity:4,
  }),/WAREHOUSE_IDEMPOTENCY_CONFLICT/);
  await assert.rejects(()=>applyWarehouseExpressOutboundServer(access,{
    ...outboundInput,idempotencyKey:'warehouse-r2-express-outbound-02',
    requestedQuantity:500,
  }),/WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK/);
  assert.equal((await getDoc(ref('balances',first.material.id))).data()?.quantity,97);
  console.log('PASS: saída expressa server-only, saldo/lote atômicos, replay e falta de estoque');

  const returnConsumptionId='cons_'+'c'.repeat(64);
  const returnSeedUrl='http://127.0.0.1:8080/v1/projects/demo-emprovex-security'
    +'/databases/emprovex-warehouse/documents/warehouse/'+workspaceId
    +'/consumptions/'+returnConsumptionId;
  const returnSeed=await fetch(returnSeedUrl,{
    method:'PATCH',headers:{authorization:'Bearer owner','content-type':'application/json'},
    body:JSON.stringify({fields:{
      schemaVersion:{stringValue:'warehouse_consumption_record_v1'},
      id:{stringValue:returnConsumptionId},workspaceId:{stringValue:workspaceId},
      ug:{stringValue:ug},origin:{stringValue:'STOCK_OUTBOUND'},
      materialId:{stringValue:first.material.id},movementId:{stringValue:outbound.movement.id},
      quantity:{doubleValue:3},returnedQuantity:{doubleValue:0},
      materialDescription:{stringValue:'Arroz integral'},unitLabel:{stringValue:'KG'},
      destinationId:{stringValue:'dest_'+'d'.repeat(32)},
      destinationName:{stringValue:'QA'},withdrawnBy:{stringValue:'Operador Teste'},
      operatorUid:{stringValue:uid},siscofisStatus:{stringValue:'PENDING'},
    }}),
  });
  assert.equal(returnSeed.ok,true,'Fixture consumo original do Emulator');
  const returnInput={
    consumptionId:returnConsumptionId,quantity:1,reason:'Devolução de QA',
    operationId:'warehouse-r2-stock-return-01',
  };
  const returned=await returnWarehouseStockOutboundServer(access,returnInput);
  assert.equal(returned.balance.quantity,98);
  assert.equal(returned.locationBalance.quantity,73);
  assert.equal(returned.lot?.quantity,73);
  assert.equal(returned.consumption.returnedQuantity,1);
  const returnReplay=await returnWarehouseStockOutboundServer(access,returnInput);
  assert.equal(returnReplay.movement.id,returned.movement.id);
  assert.equal(returnReplay.balance.quantity,98);
  await assert.rejects(()=>returnWarehouseStockOutboundServer(access,{
    ...returnInput,operationId:'warehouse-r2-stock-return-02',quantity:3,
  }),/WAREHOUSE_OUTBOUND_RETURN_EXCEEDS_REMAINING/);
  assert.equal((await getDoc(ref('balances',first.material.id))).data()?.quantity,98);
  console.log('PASS: devolução atômica: saldo/lote/consumo/resumo/movimento + replay');




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
  await assert.rejects(()=>warehouseStructureServer(access,{
    kind:'DEPOT_UPDATE',depotId:inactiveDepot.id,input:{status:'inactive'},
  }),/WAREHOUSE_ARCHIVE_SERVER_FLOW_REQUIRED/);
  // Preparação isolada do estado legado para testar reuso/reativação, sem
  // transformar DEPOT_UPDATE num atalho inseguro de inativação.
  const fixtureUrl='http://127.0.0.1:8080/v1/projects/demo-emprovex-security'
    +'/databases/emprovex-warehouse/documents/warehouse/'+workspaceId
    +'/depots/'+inactiveDepot.id
    +'?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedBy';
  const seedResponse=await fetch(fixtureUrl,{
    method:'PATCH',
    headers:{authorization:'Bearer owner','content-type':'application/json'},
    body:JSON.stringify({fields:{
      status:{stringValue:'inactive'},updatedBy:{stringValue:uid},
    }}),
  });
  assert.equal(seedResponse.ok,true,'Fixture administrativa local falhou');
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
  const withdrawalRequest={
    withdrawalId:'wd_'+'e'.repeat(32),destinationId:newDestination.id,
    withdrawnBy:'Operador QA',lines:[{
      lineId:'wline_'+'f'.repeat(32),materialId:first.material.id,
      materialDescription:first.material.description,
      requestedQuantity:2,baseQuantity:2,presentation:first.material.unit,
      presentationLabel:'KG',unitLabel:'KG',position,
      positionLabel:'DEP-MANUAL / LOC-MANUAL',
      barcodeAssociation:null,barcode:null,lotId:first.validity!.id,
      lotCode:first.validity!.code,
    }],
  };
  const withdrawal=await finalizeWarehouseWithdrawalServer(access,withdrawalRequest);
  assert.equal(withdrawal.withdrawal.status,'FINALIZED');
  assert.equal(withdrawal.movementIds.length,1);
  const finalizedReplay=await finalizeWarehouseWithdrawalServer(access,withdrawalRequest);
  assert.equal(finalizedReplay.withdrawal.status,'FINALIZED');
  assert.equal(finalizedReplay.movementIds.length,0);
  assert.equal((await getDoc(ref('balances',first.material.id))).data()?.quantity,96);
  assert.equal((await getDoc(ref('lots',first.validity!.id))).data()?.quantity,71);
  console.log('PASS: retirada servidor com consumo auditável e retomada idempotente');

  const consumptionId='cons_'+createHash('sha256').update(
    workspaceId+'\n'+'stock:'+withdrawalRequest.withdrawalId+':'+withdrawalRequest.lines[0].lineId
  ).digest('hex');
  const statusResult=await setWarehouseConsumptionSiscofisStatusServer(access,{
    consumptionId,status:'PREPARED',
  });
  assert.equal(statusResult.status,'PREPARED');
  assert.equal(statusResult.changed,true);
  assert.equal((await getDoc(ref('consumptions',consumptionId))).data()?.siscofisStatus,'PREPARED');
  const statusReplay=await setWarehouseConsumptionSiscofisStatusServer(access,{
    consumptionId,status:'PREPARED',
  });
  assert.equal(statusReplay.changed,false);
  await assert.rejects(
    ()=>setWarehouseConsumptionSiscofisStatusServer({...access,ug:'999999'},{
      consumptionId,status:'POSTED',
    }),/WAREHOUSE_CONSUMPTION_STATUS_SCOPE/);
  assert.equal((await getDoc(ref('consumptions',consumptionId))).data()?.siscofisStatus,'PREPARED');
  console.log('PASS: status SISCOFIS consumo server-only, replay e isolamento UG');

  const sessionRecord=await startWarehouseInventoryServer(access,{
    scope:{kind:'DEPOT',depotId:dep},
  });
  assert.equal(sessionRecord.session.status,'COUNTING');
  assert.equal(sessionRecord.session.itemCount,2);
  const inventoryId=sessionRecord.session.id;
  const itemLocationId=await createWarehouseInventoryItemId(inventoryId,first.material.id,position);
  const itemSubId=await createWarehouseInventoryItemId(inventoryId,first.material.id,subposition);
  await warehouseInventoryLifecycleServer(access,'COUNT',{
    inventoryId,itemId:itemLocationId,countedQuantity:70,
  });
  await warehouseInventoryLifecycleServer(access,'COUNT',{
    inventoryId,itemId:itemSubId,countedQuantity:25,
  });
  const reviewed=await warehouseInventoryLifecycleServer(access,'REVIEW',{inventoryId});
  assert.equal((reviewed as {divergentItems:number}).divergentItems,1);
  await warehouseInventoryLifecycleServer(access,'BEGIN_CONFIRM',{inventoryId});
  const adjusted=await adjustWarehouseInventoryServer(access,{
    inventoryId,itemId:itemLocationId,
  });
  assert.equal(adjusted.applied,true);
  assert.equal(adjusted.balance.quantity,95);
  assert.equal(adjusted.locationBalance.quantity,70);
  assert.equal((await getDoc(ref('lots',first.validity!.id))).data()?.quantity,70);
  const adjustedReplay=await adjustWarehouseInventoryServer(access,{
    inventoryId,itemId:itemLocationId,
  });
  assert.equal(adjustedReplay.applied,false);
  await warehouseInventoryLifecycleServer(access,'FINISH_CONFIRM',{inventoryId});
  const postConfirmReplay=await adjustWarehouseInventoryServer(access,{
    inventoryId,itemId:itemLocationId,
  });
  assert.equal(postConfirmReplay.applied,false);
  const savedSession=(await getDoc(ref('inventories',inventoryId))).data();
  assert.equal(savedSession?.status,'CONFIRMED');
  assert.equal((await getDoc(ref('balances',first.material.id))).data()?.quantity,95);
  console.log('PASS: inventário R2 início, contagem, revisão, ajuste FEFO e confirmação');


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
  const settings=await saveWarehouseLogisticsSettingsServer(access,15);
  assert.equal(settings.lowStockThreshold,15);
  const repeatSettings=await saveWarehouseLogisticsSettingsServer(access,15);
  assert.equal(settings.updatedAt,repeatSettings.updatedAt);
  await assert.rejects(()=>saveWarehouseLogisticsSettingsServer(access,-1),
    /WAREHOUSE_LOGISTICS_INVALID_THRESHOLD/);
  console.log('PASS: alertas logísticos server-only, no-op e limite validado');
  const exclusionInput=[{
    invoiceRecordKey:'QA-WAREHOUSE-R2-INVOICE',invoiceId:'QA-NF-1',
    empenhoId:'QA-NE-1',pregao:null,
  }];
  const excluded=await excludeWarehouseQueueServer(access,exclusionInput);
  assert.equal(excluded,1);
  assert.equal(await excludeWarehouseQueueServer(access,exclusionInput),0);
  await assert.rejects(()=>excludeWarehouseQueueServer(access,[{
    ...exclusionInput[0],invoiceRecordKey:'',
  }]),/WAREHOUSE_QUEUE_EXCLUSION_INVALID/);
  console.log('PASS: fila NF exclusion server-only e replay sem reescrever');




  // Regressões dos últimos motores convertidos para gravação server-only.
  const barcodeInput={
    barcode:'7896305701987',materialId:first.material.id,
    presentation:first.material.unit,
  };
  const registered=await warehouseBarcodeServer(access,'SAVE',barcodeInput);
  assert.equal(registered.barcode,barcodeInput.barcode);
  const registeredReplay=await warehouseBarcodeServer(access,'SAVE',barcodeInput);
  assert.equal(registeredReplay.id,registered.id);
  await warehouseBarcodeServer(access,'STATUS',{barcodeId:registered.id,status:'inactive'});
  assert.equal((await getDoc(ref('barcodes',registered.id))).data()?.status,'inactive');
  await warehouseBarcodeServer(access,'STATUS',{barcodeId:registered.id,status:'active'});
  const replaced=await warehouseBarcodeServer(access,'REPLACE',{
    barcodeId:registered.id,nextBarcodeInput:'7896305701994',
  });
  assert.equal(replaced.barcode,'7896305701994');
  assert.equal((await getDoc(ref('barcodes',registered.id))).data()?.status,'inactive');
  console.log('PASS: barcode server SAVE/STATUS/REPLACE e replay');

  const layoutInput={
    name:'Croqui de homologação',depotId:newDepot.id,
    logicalWidth:640,logicalHeight:480,objects:[],
    baseLayoutId:null,expectedVersion:null,
  };
  const layoutV1=await warehouseLayoutSaveServer(access,layoutInput);
  assert.equal(layoutV1.version,1);
  const layoutV2=await warehouseLayoutSaveServer(access,{
    ...layoutInput,baseLayoutId:layoutV1.id,expectedVersion:1,
  });
  assert.equal(layoutV2.version,2);
  assert.equal((await getDoc(ref('layouts',layoutV1.id))).data()?.status,'archived');
  await assert.rejects(()=>warehouseLayoutSaveServer(access,{
    ...layoutInput,baseLayoutId:layoutV1.id,expectedVersion:1,
  }),/WAREHOUSE_LAYOUT_BASE_NOT_ACTIVE|WAREHOUSE_LAYOUT_VERSION_CONFLICT/);
  console.log('PASS: layout server versionamento, arquivamento e concorrência');

  const intakeInput={
    invoiceRecordKey:'QA-WH-R2-RECEIPT',invoiceId:'QA-NF-R2',
    empenhoId:'QA-NE-R2',itemId:'QA-ITEM-R2',materialId:first.material.id,
    description:'Arroz integral QA',unitLabel:'KG',supplier:'Fornecedor QA',
    receivedQuantity:10,allocatedQuantity:0,immediateConsumptionQuantity:0,
  };
  const intakeState=await warehouseIntakeStateServer(access,intakeInput);
  assert.equal(intakeState.pendingQuantity,10);
  const stateReplay=await warehouseIntakeStateServer(access,intakeInput);
  assert.equal(stateReplay.id,intakeState.id);
  const pendingStateId=await createWarehouseItemIntakeId(
    workspaceId,intakeInput.invoiceRecordKey,intakeInput.itemId
  );
  const indexCandidate={
    id:pendingStateId,invoiceRecordKey:intakeInput.invoiceRecordKey,
    invoiceId:intakeInput.invoiceId,empenhoId:intakeInput.empenhoId,
    itemId:intakeInput.itemId,registeredAt:'2026-10-20T12:00:00.000Z',
  };
  assert.equal(await warehouseQueueIndexServer(access,'UPSERT',[indexCandidate]),1);
  assert.equal(await warehouseQueueIndexServer(access,'UPSERT',[indexCandidate]),0);
  await warehouseQueueIndexServer(access,'STATE',{cutoffAt:null,watermarkRegisteredAt:null});
  await warehouseQueueIndexServer(access,'DEACTIVATE',[pendingStateId]);
  assert.equal((await getDoc(ref('intakeQueueIndex',pendingStateId))).data()?.active,false);
  console.log('PASS: intake state e índice derivado NF, replay, desativação');

  const alertCandidate={
    kind:'LOW_STOCK' as const,entityId:first.material.id,
    severity:'WARNING' as const,title:'Estoque baixo QA',
    subtitle:'Monitoramento de homologação',description:'Alerta de teste isolado',
    empenhoId:null,
  };
  assert.equal(await warehouseLogisticsAlertsServer(access,'UPSERT',[alertCandidate]),1);
  assert.equal(await warehouseLogisticsAlertsServer(access,'UPSERT',[alertCandidate]),0);
  const resolved=await warehouseLogisticsAlertsServer(access,'RESOLVE',{
    candidateIds:[],allowResolution:true,
  });
  assert.equal(typeof resolved,'object');
  assert.equal((resolved as {resolved:number}).resolved,1);
  console.log('PASS: alertas logísticos idempotentes e resolução server-only');

  const isolatedMaterial=await saveWarehouseMaterialServer(access,{
    ...first.material,id:'mat_'+'e'.repeat(32),description:'Material contabil QA',
    aliases:[],conversions:[],
  });
  const ledgerInput={
    materialId:isolatedMaterial.id,type:'INITIAL_BALANCE' as const,
    quantityDelta:4,idempotencyKey:'siscofis:marco-zero:'+'f'.repeat(64)+':'+isolatedMaterial.id,
    note:'Teste de integração legado',source:null,
  };
  const ledgerFirst=await warehouseLedgerMovementServer(access,ledgerInput);
  assert.equal(ledgerFirst.applied,true);
  assert.equal(ledgerFirst.balance.quantity,4);
  const ledgerReplay=await warehouseLedgerMovementServer(access,ledgerInput);
  assert.equal(ledgerReplay.applied,false);
  assert.equal(ledgerReplay.balance.quantity,4);
  await assert.rejects(
    ()=>warehouseLedgerMovementServer(access,{...ledgerInput,type:'INVOICE_ENTRY'}),
    (error:unknown)=>error instanceof Error && error.message==='WAREHOUSE_SISCOFIS_LEDGER_ONLY',
  );
  await assert.rejects(
    ()=>warehouseLedgerMovementServer(access,{...ledgerInput,idempotencyKey:'forged-ledger'}),
    (error:unknown)=>error instanceof Error && error.message==='WAREHOUSE_SISCOFIS_LEDGER_ONLY',
  );
  console.log('PASS: lançamento legado server-only com saldo e idempotência');

  await warehouseStructureArchiveServer(access,{kind:'DEPOT',id:newDepot.id});
  assert.equal((await getDoc(ref('depots',newDepot.id))).data()?.status,'inactive');
  console.log('PASS: arquivamento server-only de depósito desocupado');

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
