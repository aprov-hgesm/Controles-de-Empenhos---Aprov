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
import { finalizeWarehouseWithdrawalServer, legacyWithdrawalPayloadHash } from '../lib/server/warehouseWithdrawalWrite';
import { auditWarehouseLegacyWithdrawalsServer } from '../lib/server/warehouseWithdrawalLegacyAudit';
import { WAREHOUSE_WITHDRAWAL_SCHEMA_VERSION } from '../lib/warehouse/withdrawal';
import { setWarehouseConsumptionSiscofisStatusServer } from '../lib/server/warehouseConsumptionStatusWrite';
import { startWarehouseInventoryServer } from '../lib/server/warehouseInventoryStart';
import { warehouseInventoryLifecycleServer } from '../lib/server/warehouseInventoryLifecycle';
import { adjustWarehouseInventoryServer } from '../lib/server/warehouseInventoryAdjustment';
import { warehouseBarcodeServer,warehouseLayoutSaveServer,warehouseIntakeStateServer } from '../lib/server/warehouseRemainingWrites';
import { warehouseQueueIndexServer } from '../lib/server/warehouseQueueIndexWrite';
import { warehouseLogisticsAlertsServer } from '../lib/server/warehouseLogisticsAlertWrite';
import { warehouseLedgerMovementServer,warehouseStructureArchiveServer, diagnoseWarehouseDepotArchiveServer,warehouseDepotDeleteToReceivingServer } from '../lib/server/warehouseLedgerAndArchive';
import {listWarehouseDepotReturnsServer,allocateWarehouseDepotReturnServer,bulkWarehouseDepotReturnQueueServer,updateWarehouseDepotReturnExpiryServer} from '../lib/server/warehouseDepotReturnReadAndAllocate';
import { warehouseAdminTransaction } from '../lib/server/warehouseFirestoreTransaction';
import { createWarehouseItemIntakeId } from '../lib/warehouse/intake';
import { createWarehouseInventoryItemId } from '../lib/warehouse/inventory';
import { createWarehouseLocationBalanceId } from '../lib/warehouse/location';


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

  // Segurança R2: uma linha adulterada sem lotId NÃO consome saldo
  // já totalmente vinculado a referências técnicas de validade.
  await assert.rejects(()=>applyWarehouseExpressOutboundServer(access,{
    ...outboundInput,lotId:null,
    idempotencyKey:'warehouse-r2-express-untracked-bypass-01',requestedQuantity:1,
  }),/WAREHOUSE_OUTBOUND_UNTRACKED_QUANTITY_NOT_AVAILABLE/);
  assert.equal((await getDoc(ref('balances',first.material.id))).data()?.quantity,97);
  assert.equal((await getDoc(ref('lots',first.validity!.id))).data()?.quantity,72);
  console.log('PASS: servidor rejeita bypass lotId nulo quando todo saldo está atribuído');

  await writeWarehouseLotServer(access,'UPDATE',{
    lotId:first.validity!.id,input:{expiresOn:'2026-01-01'},
  });
  await assert.rejects(()=>applyWarehouseExpressOutboundServer(access,{
    ...outboundInput,idempotencyKey:'warehouse-r2-expired-bypass-01',
    requestedQuantity:1,
  }),/WAREHOUSE_OUTBOUND_LOT_EXPIRED/);
  await writeWarehouseLotServer(access,'UPDATE',{
    lotId:first.validity!.id,input:{expiresOn:'2027-05-01'},
  });
  assert.equal((await getDoc(ref('balances',first.material.id))).data()?.quantity,97);
  console.log('PASS: servidor rejeita referencia vencida mesmo com cliente adulterado');


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
  // GOV-SIMP-01: rejeicao sem saldo livre e sem commit pode reiniciar
  // o carrinho com uma NOVA identidade, preservando saldo e historico.
  const rejectedId='wd_'+'b'.repeat(32);
  const rejectedLine={...withdrawalRequest.lines[0],
    lineId:'wline_'+'b'.repeat(32),
    requestedQuantity:1,baseQuantity:1,lotId:null,lotCode:null,
  };
  const rejectedRequest={...withdrawalRequest,
    withdrawalId:rejectedId,lines:[rejectedLine],
  };
  const beforeRejectBalance=(await getDoc(ref('balances',first.material.id))).data()?.quantity;
  const beforeRejectLot=(await getDoc(ref('lots',first.validity!.id))).data()?.quantity;
  for(let attempt=0;attempt<2;attempt++) {
    await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,rejectedRequest),
      /WAREHOUSE_OUTBOUND_UNTRACKED_QUANTITY_NOT_AVAILABLE_SAFE_TO_RESTART/);
    assert.equal((await getDoc(ref('withdrawals',rejectedId))).exists(),false);
    assert.equal((await getDoc(ref('balances',first.material.id))).data()?.quantity,beforeRejectBalance);
    assert.equal((await getDoc(ref('lots',first.validity!.id))).data()?.quantity,beforeRejectLot);
  }
  const rejectedConsumption='cons_'+createHash('sha256').update(
    workspaceId+'\n'+'stock:'+rejectedId+':'+rejectedLine.lineId
  ).digest('hex');
  assert.equal((await getDoc(ref('consumptions',rejectedConsumption))).exists(),false);
  console.log('PASS: untracked sem saldo livre -> safe restart, sem baixa/cabecalho/consumo, retry idem');

  // Saldo insuficiente também é rejeição determinística, sem baixa.
  const insufficientRequest={...withdrawalRequest,
    withdrawalId:'wd_'+'6'.repeat(32),
    lines:[{...withdrawalRequest.lines[0],requestedQuantity:999,
      baseQuantity:999}],
  };
  await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,insufficientRequest),
    /WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK_SAFE_TO_RESTART/);
  assert.equal((await getDoc(ref('withdrawals',insufficientRequest.withdrawalId))).exists(),false);
  assert.equal((await getDoc(ref('balances',first.material.id))).data()?.quantity,beforeRejectBalance);
  console.log('PASS: falta de estoque rejeitada antes de qualquer escrita e carrinho recuperável');

  const beforeForged=(await getDoc(ref('balances',first.material.id))).data()?.quantity;
  await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,{
    ...withdrawalRequest,withdrawalId:'wd_'+'d'.repeat(32),
    lines:[{...withdrawalRequest.lines[0],baseQuantity:999}],
  }),/WAREHOUSE_OUTBOUND_EXPECTED_BASE_MISMATCH/);
  assert.equal((await getDoc(ref('balances',first.material.id))).data()?.quantity,beforeForged);
  await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,{
    ...withdrawalRequest,withdrawalId:'wd_'+'c'.repeat(32),
    lines:[{...withdrawalRequest.lines[0],lotId:'lot_invalid'}],
  }),/WAREHOUSE_WITHDRAWAL_INPUT_INVALID/);
  assert.equal((await getDoc(ref('balances',first.material.id))).data()?.quantity,beforeForged);
  console.log('PASS: retirada rejeita base forjada e referencia invalida antes de debitar');
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
  assert.equal((await getDoc(ref('layouts',layoutV2.id))).data()?.status,'archived',
    'O Croqui ativo não pode permanecer ativo após a inativação do depósito.');
  await assert.rejects(()=>warehouseLayoutSaveServer(access,{
    ...layoutInput,baseLayoutId:layoutV2.id,expectedVersion:2,
  }),/WAREHOUSE_LAYOUT_BASE_NOT_ACTIVE|WAREHOUSE_LAYOUT_DEPOT_INACTIVE|WAREHOUSE_LAYOUT_DEPOT_INVALID/);
  console.log('PASS: arquivamento atômico do depósito, locais e Croqui ativo');

  // Tombstones são privados e intencionalmente não legíveis pelo SDK do navegador.
  const readDeletionTombstone = (depotId:string) => {
    const key='warehouse/'+workspaceId+'/depotDeletions/'+depotId;
    return warehouseAdminTransaction('emulator',[key],rows=>({result:rows.get(key),writes:[]}));
  };
  // Exclusão operacional definitiva exige depósito realmente vazio.
  // Não é permitido mover saldos para UNASSIGNED ou simular retorno ao recebimento.
  await assert.rejects(()=>warehouseStructureArchiveServer(access,{
    kind:'DEPOT',id:dep,mode:'DELETE',confirmCode:'DEP-MANUAL',
  }),/WAREHOUSE_ARCHIVE_OCCUPIED|WAREHOUSE_ARCHIVE_ACTIVE_LOT/);
  assert.equal((await getDoc(ref('depots',dep))).data()?.status,'active');
  assert.equal(await readDeletionTombstone(dep),null);

  const toDelete=await warehouseStructureServer(access,{
    kind:'DEPOT_CREATE',input:{code:'DELETEQA',name:'Depósito de exclusão QA'},
  });
  if(!('id' in toDelete)) throw new Error('DELETE_DEPOT_RESULT_INVALID');
  const deletionLocal=await warehouseStructureServer(access,{
    kind:'LOCATION_CREATE',input:{depotId:toDelete.id,kind:'LOCAL',
      code:'LOCDELETE',name:'Local para excluir'},
  });
  if(!('id' in deletionLocal)) throw new Error('DELETE_LOCAL_RESULT_INVALID');
  const deletionSub=await warehouseStructureServer(access,{
    kind:'LOCATION_CREATE',input:{depotId:toDelete.id,kind:'SUBPOSITION',
      parentLocationId:deletionLocal.id,code:'SUBDELETE',name:'Subposição para excluir'},
  });
  if(!('id' in deletionSub)) throw new Error('DELETE_SUBPOSITION_RESULT_INVALID');
  await assert.rejects(()=>warehouseStructureArchiveServer(access,{
    kind:'DEPOT',id:toDelete.id,mode:'DELETE',confirmCode:'WRONGCODE',
  }),/WAREHOUSE_DEPOT_DELETE_INVALID_CONFIRMATION/);
  assert.equal((await getDoc(ref('depots',toDelete.id))).data()?.status,'active');
  await warehouseStructureArchiveServer(access,{
    kind:'DEPOT',id:toDelete.id,mode:'DELETE',confirmCode:'DELETEQA',
  });
  assert.equal((await getDoc(ref('depots',toDelete.id))).data()?.status,'inactive');
  assert.equal((await getDoc(ref('locations',deletionLocal.id))).data()?.status,'inactive');
  assert.equal((await getDoc(ref('locations',deletionSub.id))).data()?.status,'inactive');
  assert.equal((await readDeletionTombstone(toDelete.id))?.data.deletedBy,access.uid);
  await assert.rejects(()=>warehouseStructureServer(access,{
    kind:'DEPOT_UPDATE',depotId:toDelete.id,input:{status:'active'},
  }),/WAREHOUSE_DEPOT_PERMANENTLY_DELETED/);
  await assert.rejects(()=>warehouseStructureServer(access,{
    kind:'LOCATION_UPDATE',locationId:deletionLocal.id,input:{status:'active'},
  }),/WAREHOUSE_DEPOT_PERMANENTLY_DELETED/);
  const replacement=await warehouseStructureServer(access,{
    kind:'DEPOT_CREATE',input:{code:'DELETEQA',name:'Depósito de exclusão QA'},
  });
  if(!('id' in replacement)) throw new Error('DELETE_REPLACEMENT_RESULT_INVALID');
  assert.notEqual(replacement.id,toDelete.id);
  console.log('PASS: exclusão definitiva só de depósito vazio, tombstone atômico, locais inativos e reutilização do código');


  const atomicDestination=await warehouseDestinationCreateServer(access,{
    name:'Destino isolado para atomicidade R2',
  });
  // Isolado: 2 linhas para o MESMO saldo e a MESMA referência,
  // com rollback total antes do commit e replay após confirmação.
  const atomicSeed=await registerWarehouseManualEntryServer(access,{
    operationId:'withdrawal-atomic-r2-seed',existingMaterialId:null,
    description:'Estoque Atomicidade R2',unitLabel:'KG',quantity:12,
    provenance:'Teste automático',reference:'Isolado no Emulator',
    position,expiresOn:'2027-07-20',lotCode:'ATOMIC-R2-REF',barcode:null,
  });
  assert.ok(atomicSeed.validity);
  const atomicMaterialId=atomicSeed.material.id;
  const atomicLotId=atomicSeed.validity!.id;
  const atomicId='wd_'+'9'.repeat(32);
  const atomicInput={
    withdrawalId:atomicId,destinationId:atomicDestination.id,
    withdrawnBy:'Operador QA',lines:[3,4].map((quantity,i)=>({
      lineId:'wline_'+String(i+1).repeat(32),
      materialId:atomicMaterialId,materialDescription:atomicSeed.material.description,
      requestedQuantity:quantity,baseQuantity:quantity,
      presentation:atomicSeed.material.unit,presentationLabel:'KG',unitLabel:'KG',
      position,positionLabel:'DEP-MANUAL / LOC-MANUAL',barcodeAssociation:null,
      barcode:null,lotId:atomicLotId,lotCode:atomicSeed.validity!.code,
    })),
  };
  const atomicBalance=()=>getDoc(ref('balances',atomicMaterialId)).then(s=>s.data()?.quantity);
  const atomicLot=()=>getDoc(ref('lots',atomicLotId)).then(s=>s.data()?.quantity);
  const atomicHeader=()=>warehouseAdminTransaction('emulator',[
    'warehouse/'+workspaceId+'/withdrawals/'+atomicId
  ],rows=>({result:rows.get('warehouse/'+workspaceId+'/withdrawals/'+atomicId),writes:[]}));
  const atomicConsumption=(i:number)=>'cons_'+createHash('sha256').update(
    workspaceId+'\n'+'stock:'+atomicId+':'+atomicInput.lines[i].lineId
  ).digest('hex');
  process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_LINE='2';
  try {
    await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,atomicInput),
      /WAREHOUSE_ATOMIC_TEST_INJECTED_FAILURE/);
  } finally {delete process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_LINE;}
  assert.equal(await atomicBalance(),12);
  assert.equal(await atomicLot(),12);
  assert.equal(await atomicHeader(),null);
  assert.equal((await getDoc(ref('consumptions',atomicConsumption(0)))).exists(),false);
  console.log('PASS: falha injetada na linha 2 = rollback integral, sem header/consumo');

  await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,{
    ...atomicInput,lines:[atomicInput.lines[0],{...atomicInput.lines[1],requestedQuantity:20,
      baseQuantity:20}],
  }),/WAREHOUSE_OUTBOUND_LOT_INSUFFICIENT_ATTRIBUTION|WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK/);
  assert.equal(await atomicBalance(),12);
  assert.equal(await atomicLot(),12);
  assert.equal(await atomicHeader(),null);
  console.log('PASS: falta de estoque na linha 2 não confirma a linha 1');

  const atomic=await finalizeWarehouseWithdrawalServer(access,atomicInput);
  assert.equal(atomic.withdrawal.status,'FINALIZED');
  assert.equal(atomic.withdrawal.appliedLineCount,2);
  assert.equal(atomic.movementIds.length,2);
  assert.equal(await atomicBalance(),5);
  assert.equal(await atomicLot(),5);
  assert.equal((await getDoc(ref('consumptions',atomicConsumption(0)))).exists(),true);
  assert.equal((await getDoc(ref('consumptions',atomicConsumption(1)))).exists(),true);
  assert.equal((await atomicHeader())?.data.atomicVersion,2);
  const atomicReplay=await finalizeWarehouseWithdrawalServer(access,atomicInput);
  assert.equal(atomicReplay.withdrawal.status,'FINALIZED');
  assert.equal(atomicReplay.movementIds.length,0);
  assert.equal(await atomicBalance(),5);
  await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,{
    ...atomicInput,lines:atomicInput.lines.map((l,i)=>i===1?{...l,requestedQuantity:3,baseQuantity:3}:l),
  }),/WAREHOUSE_WITHDRAWAL_IDEMPOTENCY_CONFLICT/);
  assert.equal(await atomicBalance(),5);
  console.log('PASS: 2 linhas confirmadas com saldo/lote/consumo/cabeçalho em um commit; replay sem duplicação');

  // Duas sessões repetindo a mesma identidade simultaneamente:
  // somente uma pode confirmar a retirada e ambas podem recuperar via replay.
  const concurrent={
    ...atomicInput,withdrawalId:'wd_'+'8'.repeat(32),
    lines:[{...atomicInput.lines[0],lineId:'wline_'+'3'.repeat(32),
      requestedQuantity:1,baseQuantity:1}],
  };
  const simultaneous=await Promise.allSettled([
    finalizeWarehouseWithdrawalServer(access,concurrent),
    finalizeWarehouseWithdrawalServer(access,concurrent),
  ]);
  // O Emulator pode devolver conflito às duas requisições concorrentes.
  // O contrato é convergência após replay com a MESMA identidade, não
  // sucesso obrigatório de alguma das duas primeiras respostas.
  const afterRace=await atomicBalance();
  assert.ok(afterRace===4||afterRace===5);
  const repeat=await finalizeWarehouseWithdrawalServer(access,concurrent);
  assert.equal(repeat.withdrawal.status,'FINALIZED');
  assert.equal(await atomicBalance(),4);
  const finalReplay=await finalizeWarehouseWithdrawalServer(access,concurrent);
  assert.equal(finalReplay.movementIds.length,0);
  assert.equal(await atomicBalance(),4);
  console.log('PASS: concorrência possivelmente abortada, retry com mesma identidade converge sem dupla baixa');

  // Falha após o commit: cliente vê 503, mas os registros foram salvos.
  // Repetição com a mesma identidade devolve FINALIZED sem nova saída.
  const lostReply={
    ...atomicInput,withdrawalId:'wd_'+'7'.repeat(32),
    lines:[{...atomicInput.lines[0],lineId:'wline_'+'4'.repeat(32),
      requestedQuantity:1,baseQuantity:1}],
  };
  process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_AFTER_COMMIT=lostReply.withdrawalId;
  try {
    await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,lostReply),
      /WAREHOUSE_ATOMIC_TEST_RESPONSE_LOST/);
  }finally {delete process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_AFTER_COMMIT;}
  assert.equal(await atomicBalance(),3,'Commit confirmado apesar da resposta perdida');
  const rescued=await finalizeWarehouseWithdrawalServer(access,lostReply);
  assert.equal(rescued.withdrawal.status,'FINALIZED');
  assert.equal(rescued.movementIds.length,0);
  assert.equal(await atomicBalance(),3);
  console.log('PASS: resposta perdida após commit recuperada por replay exato, sem débito duplicado');



  // Recuperação histórica v1: seis interrupções após etapas já persistidas
  // e replay da MESMA retirada. Nunca emitir movimento duplicado.
  const legacySeed=await registerWarehouseManualEntryServer(access,{
    operationId:'withdrawal-legacy-r2-seed',existingMaterialId:null,
    description:'Estoque legado de recuperação',unitLabel:'KG',quantity:30,
    provenance:'Teste legado isolado',reference:'Simulação v1',
    position,expiresOn:'2027-07-20',lotCode:'LEGACY-R2-REF',barcode:null,
  });
  assert.ok(legacySeed.validity);
  const legacyBalance=()=>getDoc(ref('balances',legacySeed.material.id))
    .then(snapshot=>snapshot.data()?.quantity as number);
  const seedLegacyHeader=async(id:string,data:Record<string,unknown>)=>{
    const docPath='warehouse/'+workspaceId+'/withdrawals/'+id;
    await warehouseAdminTransaction('emulator',[docPath],rows=>{
      assert.equal(rows.get(docPath),null);
      return {result:null,writes:[{path:docPath,data}]};
    });
  };
  const legacyStages=['1:movement','1:consumption','1:progress',
    '2:movement','2:consumption','2:progress'];
  for(let stageIndex=0;stageIndex<legacyStages.length;stageIndex++) {
    const stage=legacyStages[stageIndex];
    const headId='wd_'+String(stageIndex+1).repeat(32);
    const testInput={
      withdrawalId:headId,destinationId:atomicDestination.id,
      withdrawnBy:'Operador QA',
      lines:[0,1].map(line=>({
        lineId:'wline_'+String(stageIndex+1).repeat(31)+String(line+1),
        materialId:legacySeed.material.id,
        materialDescription:legacySeed.material.description,
        requestedQuantity:1,baseQuantity:1,
        presentation:legacySeed.material.unit,presentationLabel:'KG',unitLabel:'KG',
        position,positionLabel:'DEP-MANUAL / LOC-MANUAL',
        barcodeAssociation:null,barcode:null,
        lotId:legacySeed.validity!.id,lotCode:legacySeed.validity!.code,
      })),
    };
    const startBalance=await legacyBalance();
    await seedLegacyHeader(headId,{
      schemaVersion:WAREHOUSE_WITHDRAWAL_SCHEMA_VERSION,
      id:headId,workspaceId,ug,destinationId:atomicDestination.id,
      destinationName:atomicDestination.name,withdrawnBy:testInput.withdrawnBy,
      payloadHash:legacyWithdrawalPayloadHash(testInput.lines),
      expectedLineCount:2,appliedLineCount:0,status:'FINALIZING',
      createdBy:access.uid,createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),finalizedAt:null,
    });
    process.env.EMPROVEX_WAREHOUSE_LEGACY_FAULT_STAGE=stage;
    try {
      await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,testInput),
        /WAREHOUSE_LEGACY_TEST_INJECTED_FAILURE/);
    }finally{delete process.env.EMPROVEX_WAREHOUSE_LEGACY_FAULT_STAGE;}
    const recovered=await finalizeWarehouseWithdrawalServer(access,testInput);
    assert.equal(recovered.withdrawal.status,'FINALIZED');
    assert.equal(recovered.withdrawal.appliedLineCount,2);
    assert.equal(await legacyBalance(),startBalance-2);
    for(const line of testInput.lines) {
      const consumptionId='cons_'+createHash('sha256').update(
        workspaceId+'\n'+'stock:'+headId+':'+line.lineId).digest('hex');
      assert.equal((await getDoc(ref('consumptions',consumptionId))).exists(),true);
    }
    const replay=await finalizeWarehouseWithdrawalServer(access,testInput);
    assert.equal(replay.movementIds.length,0);
    assert.equal(await legacyBalance(),startBalance-2);
    console.log('PASS: recuperação v1 em '+stage+' sem segunda baixa');
  }
  // O cabeçalho FINALIZED isolado não constitui prova do saldo/consumo.
  const phantomId='wd_'+'0'.repeat(32);
  const phantomLine={
    lineId:'wline_'+'f'.repeat(32),
    materialId:legacySeed.material.id,materialDescription:legacySeed.material.description,
    requestedQuantity:1,baseQuantity:1,presentation:legacySeed.material.unit,
    presentationLabel:'KG',unitLabel:'KG',position,positionLabel:'DEP-MANUAL / LOC-MANUAL',
    barcodeAssociation:null,barcode:null,
    lotId:legacySeed.validity!.id,lotCode:legacySeed.validity!.code,
  };
  const phantomInput={withdrawalId:phantomId,destinationId:atomicDestination.id,
    withdrawnBy:'Operador QA',lines:[phantomLine]};
  await seedLegacyHeader(phantomId,{
    schemaVersion:WAREHOUSE_WITHDRAWAL_SCHEMA_VERSION,
    id:phantomId,workspaceId,ug,destinationId:atomicDestination.id,
    destinationName:atomicDestination.name,withdrawnBy:'Operador QA',
    payloadHash:legacyWithdrawalPayloadHash(phantomInput.lines),
    expectedLineCount:1,appliedLineCount:1,status:'FINALIZED',
    createdBy:access.uid,createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),finalizedAt:new Date().toISOString(),
  });
  const beforePhantom=await legacyBalance();
  await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,phantomInput),
    /WAREHOUSE_WITHDRAWAL_RECONCILIATION_REQUIRED/);
  assert.equal(await legacyBalance(),beforePhantom);
  console.log('PASS: cabeçalho legado FINALIZED sem movimento/consumo bloqueado');

  const legacyAudit=await auditWarehouseLegacyWithdrawalsServer(access);
  assert.ok(legacyAudit.legacyFinalizedChecked>=6);
  assert.ok(legacyAudit.findings.some(item=>item.id===phantomId
    &&item.reason==='CONSUMPTION_COUNT_MISMATCH'));
  console.log('PASS: auditor v1 somente leitura detecta falso FINALIZED e valida replays reais');
  // Excel / Entrada Avulsa: o nome já existir no cadastro NÃO autoriza
  // vincular ao ID antigo. O servidor gera ID estável por arquivo+produto.
  const balanceBeforeBulk=(await getDoc(ref('balances',first.material.id))).data()?.quantity;
  const bulkOperation=(digest:string,line:number)=>'bulk_'+dep+'_'+digest.repeat(28)+'_'+line;
  const bulkInput={
    operationId:bulkOperation('a',68),existingMaterialId:null,
    description:'Arroz integral',unitLabel:'KG',quantity:10,
    provenance:'Carga Excel',reference:'Excel teste · linha 68',
    position:subposition,expiresOn:null,lotCode:null,barcode:null,
  };
  const bulkFirst=await registerWarehouseManualEntryServer(access,bulkInput);
  assert.equal(bulkFirst.entry.applied,true);
  assert.notEqual(bulkFirst.material.id,first.material.id,
    'a carga não pode reaproveitar material da Entrada Avulsa anterior');
  const bulkSecond=await registerWarehouseManualEntryServer(access,{
    ...bulkInput,operationId:bulkOperation('a',69),quantity:5,
    reference:'Excel teste · linha 69',position,
  });
  assert.equal(bulkSecond.material.id,bulkFirst.material.id,
    'duas posições do mesmo produto e do mesmo arquivo devem compartilhar apenas o ID novo');
  assert.equal(bulkSecond.entry.balance.quantity,15);
  const bulkReplay=await registerWarehouseManualEntryServer(access,bulkInput);
  assert.equal(bulkReplay.entry.applied,false);
  assert.equal(bulkReplay.material.id,bulkFirst.material.id);
  assert.equal(bulkReplay.entry.balance.quantity,15);
  const bulkDifferentFile=await registerWarehouseManualEntryServer(access,{
    ...bulkInput,operationId:bulkOperation('b',68),
  });
  assert.notEqual(bulkDifferentFile.material.id,bulkFirst.material.id,
    'outro arquivo deve criar novo cadastro mesmo com descrição idêntica');
  const blackBeans=await registerWarehouseManualEntryServer(access,{
    ...bulkInput,operationId:bulkOperation('a',70),
    description:'Feijão preto',quantity:172,unitLabel:'kg',
  });
  const redBeans=await registerWarehouseManualEntryServer(access,{
    ...bulkInput,operationId:bulkOperation('a',71),
    description:'Feijão vermelho',quantity:330,unitLabel:'kg',
  });
  assert.notEqual(blackBeans.material.id,redBeans.material.id,
    'feijão preto e vermelho devem ter IDs independentes na mesma prateleira');
  await assert.rejects(()=>registerWarehouseManualEntryServer(access,{
    ...bulkInput,operationId:bulkOperation('a',72),
    existingMaterialId:first.material.id,
  }),/WAREHOUSE_BULK_EXISTING_MATERIAL_FORBIDDEN/);
  assert.equal((await getDoc(ref('balances',first.material.id))).data()?.quantity,balanceBeforeBulk,
    'entrada antiga não deve receber saldo da importação');
  console.log('PASS: Excel gera material novo por arquivo, compartilha dentro dele e rejeita ID antigo');

  // Diagnóstico de exclusão: local legado órfão com saldo positivo não pode
  // sumir silenciosamente por não aparecer no Croqui.
  const orphanPosition={kind:'LOCATION' as const,depotId:dep,
    locationId:'loc_'+'d'.repeat(32),subpositionId:null};
  const orphanId=await createWarehouseLocationBalanceId(
    workspaceId,first.material.id,orphanPosition);
  const orphanPath='warehouse/'+workspaceId+'/locationBalances/'+orphanId;
  await warehouseAdminTransaction('emulator',[orphanPath],rows=>{
    assert.equal(rows.get(orphanPath),null);
    return {result:true,writes:[{path:orphanPath,data:{
      schemaVersion:'warehouse_location_balance_v1',id:orphanId,
      workspaceId,ug,materialId:first.material.id,
      position:orphanPosition,quantity:1,revision:1,
      lastMovementId:first.entry.movement.id,
    }}]};
  });
  const diagnosis=await diagnoseWarehouseDepotArchiveServer(access,{depotId:dep});
  assert.ok(diagnosis.positiveBalanceCount>0);
  assert.ok(diagnosis.activeLotCount>0);
  assert.ok(diagnosis.blockers.some(row=>row.kind==='BALANCE'
    &&row.recordId===orphanId&&row.positionStatus==='MISSING'&&row.quantity===1));
  assert.ok(diagnosis.blockers.some(row=>row.kind==='BALANCE'
    &&row.materialId===first.material.id&&row.positionStatus==='ACTIVE'));
  await assert.rejects(()=>warehouseStructureArchiveServer(access,{
    kind:'DEPOT',id:dep,mode:'DELETE',confirmCode:'DEP-MANUAL',
  }),/WAREHOUSE_ARCHIVE_OCCUPIED/);
  assert.equal((await getDoc(ref('locationBalances',orphanId))).data()?.quantity,1);
  console.log('PASS: exclusão segura mantém saldo órfão e identifica bloqueadores legados sem escrita');


  // Exclusão com estoque: o recebimento recebe saldo e validade sem criar
  // NF fictícia. A realocação posterior preserva agregado e é idempotente.
  const returnDepot=await warehouseStructureServer(access,{
    kind:'DEPOT_CREATE',input:{code:'RETQA',name:'Depósito para retorno QA'},
  });
  if(!('id' in returnDepot))throw Error('RETURN_DEPOT_RESULT_INVALID');
  const returnLocal=await warehouseStructureServer(access,{
    kind:'LOCATION_CREATE',input:{depotId:returnDepot.id,
      kind:'LOCAL',code:'LOCRETQA',name:'Local de retorno QA'},
  });
  if(!('id' in returnLocal))throw Error('RETURN_LOCAL_RESULT_INVALID');
  const returnPosition={kind:'LOCATION' as const,depotId:returnDepot.id,
    locationId:returnLocal.id,subpositionId:null};
  const returnEntry=await registerWarehouseManualEntryServer(access,{
    operationId:'return-to-receiving-test-001',existingMaterialId:null,
    description:'Feijão preto para retorno',unitLabel:'KG',quantity:27,
    provenance:'Teste estoque',reference:'Exclusão com retorno',
    position:returnPosition,expiresOn:'2027-10-20',
    lotCode:'RETQA-LOTE-1',barcode:null,
  });
  const returnEntryTwo=await registerWarehouseManualEntryServer(access,{
    operationId:'return-to-receiving-test-002',existingMaterialId:null,
    description:'Açúcar para retorno em grupo',unitLabel:'KG',quantity:5,
    provenance:'Teste estoque',reference:'Exclusão com retorno em grupo',
    position:returnPosition,expiresOn:null,barcode:null,
  });
  assert.equal(returnEntryTwo.locationBalance.quantity,5);
  const returnBefore=(await getDoc(ref('balances',returnEntry.material.id))).data()?.quantity;
  assert.equal(returnBefore,27);
  const depotReturned=await warehouseDepotDeleteToReceivingServer(access,{
    kind:'DEPOT',id:returnDepot.id,mode:'DELETE',confirmCode:'RETQA',
  });
  assert.equal(depotReturned.ok,true);
  assert.equal(depotReturned.returnedItems,2);
  assert.equal(depotReturned.returnedQuantity,32);
  assert.equal((await getDoc(ref('depots',returnDepot.id))).data()?.status,'inactive');
  assert.ok(await readDeletionTombstone(returnDepot.id));
  assert.equal((await getDoc(ref('balances',returnEntry.material.id))).data()?.quantity,returnBefore);
  assert.equal((await getDoc(ref('lots',returnEntry.validity!.id))).data()?.status,'inactive');
  const pendingReturns=await listWarehouseDepotReturnsServer(access);
  const pending=pendingReturns.find(x=>x.depotId===returnDepot.id
    &&x.materialId===returnEntry.material.id);
  assert.ok(pending);
  assert.equal(pending.pendingQuantity,27);
  assert.equal(pending.lotReferences.length,1);
  assert.equal(pending.lotReferences[0].expiresOn,'2027-10-20');
  await assert.rejects(()=>updateWarehouseDepotReturnExpiryServer(access,{
    returnId:pending.id,lotId:pending.lotReferences[0].id,
    expiresOn:'2027-02-31',reason:'Verificação documental',
  }),/WAREHOUSE_DEPOT_RETURN_EXPIRY_INPUT_INVALID/);
  await assert.rejects(()=>updateWarehouseDepotReturnExpiryServer(access,{
    returnId:pending.id,lotId:pending.lotReferences[0].id,
    expiresOn:'2027-11-01',reason:'X',
  }),/WAREHOUSE_DEPOT_RETURN_EXPIRY_INPUT_INVALID/);
  const validityCorrection=await updateWarehouseDepotReturnExpiryServer(access,{
    returnId:pending.id,lotId:pending.lotReferences[0].id,
    expiresOn:'2027-11-01',reason:'Correção documental QA',
  });
  assert.equal(validityCorrection.ok,true);
  assert.equal(validityCorrection.expiresOn,'2027-11-01');
  const correctionRows=await listWarehouseDepotReturnsServer(access);
  const corrected=correctionRows.find(x=>x.id===pending.id);
  assert.equal(corrected?.lotReferences[0].expiresOn,'2027-11-01');
  assert.equal((await getDoc(ref('balances',returnEntry.material.id))).data()?.quantity,27);
  assert.equal((await getDoc(ref('lots',returnEntry.validity!.id))).data()?.expiresOn,'2027-10-20');
  console.log('PASS: correção da validade devolvida preserva saldo e lote histórico');

  const group= (await listWarehouseDepotReturnsServer(access))
    .filter(item=>item.depotId===returnDepot.id);
  assert.equal(group.length,2);
  const groupIds=group.map(item=>item.id);
  await assert.rejects(()=>bulkWarehouseDepotReturnQueueServer(access,{
    action:'ARCHIVE',returnIds:[groupIds[0],groupIds[0]],
  }),/WAREHOUSE_DEPOT_RETURNS_BULK_INVALID/);
  const archivedGroup=await bulkWarehouseDepotReturnQueueServer(access,{
    action:'ARCHIVE',returnIds:groupIds,
  });
  assert.equal(archivedGroup.changed,2);
  const replayArchive=await bulkWarehouseDepotReturnQueueServer(access,{
    action:'ARCHIVE',returnIds:groupIds,
  });
  assert.equal(replayArchive.changed,0);
  assert.equal(replayArchive.unchanged,2);
  assert.equal((await listWarehouseDepotReturnsServer(access))
    .filter(item=>groupIds.includes(item.id)).length,0);
  assert.equal((await listWarehouseDepotReturnsServer(access,{includeArchived:true}))
    .filter(item=>groupIds.includes(item.id)&&item.status==='ARCHIVED').length,2);
  await assert.rejects(()=>allocateWarehouseDepotReturnServer(access,{
    returnId:pending.id,position,
  }),/WAREHOUSE_DEPOT_RETURN_CHANGED/);
  await assert.rejects(()=>bulkWarehouseDepotReturnQueueServer(
    {...access,ug:'999999'},{
      action:'RESTORE',returnIds:groupIds,
    }),/WAREHOUSE_DEPOT_RETURN_SCOPE_MISMATCH/);
  assert.equal((await getDoc(ref('balances',returnEntry.material.id))).data()?.quantity,27);
  assert.equal((await getDoc(ref('balances',returnEntryTwo.material.id))).data()?.quantity,5);
  const restoredGroup=await bulkWarehouseDepotReturnQueueServer(access,{
    action:'RESTORE',returnIds:groupIds,
  });
  assert.equal(restoredGroup.changed,2);
  assert.equal((await listWarehouseDepotReturnsServer(access))
    .filter(item=>groupIds.includes(item.id)).length,2);
  console.log('PASS: remoção em grupo reversível, replay e isolamento UG sem alterar estoque');
  const allocation=await allocateWarehouseDepotReturnServer(access,{
    returnId:pending.id,position,
  });
  assert.equal(allocation.applied,true);
  assert.equal(allocation.quantity,27);
  const allocationReplay=await allocateWarehouseDepotReturnServer(access,{
    returnId:pending.id,position,
  });
  assert.equal(allocationReplay.applied,false);
  assert.equal((await listWarehouseDepotReturnsServer(access))
    .some(x=>x.id===pending.id),false);
  assert.equal((await getDoc(ref('balances',returnEntry.material.id))).data()?.quantity,returnBefore);
  assert.equal((await getDoc(ref('locationBalances',
    await createWarehouseLocationBalanceId(workspaceId,returnEntry.material.id,returnPosition)))).data()?.quantity,0);
  assert.equal((await getDoc(ref('locationBalances',
    await createWarehouseLocationBalanceId(workspaceId,returnEntry.material.id,position)))).data()?.quantity,27);
  console.log('PASS: exclusão com material devolve saldo e lote ao recebimento; alocação idempotente preserva agregado');

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
