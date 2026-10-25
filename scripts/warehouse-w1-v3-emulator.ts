#!/usr/bin/env node
/**
 * W1 — Firebase Auth + Firestore (named DB) isolated transactional assurance.
 * No live data, no mock store, no production access.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { verifyWarehouseRequest } from '../lib/server/warehouseAccess';
import { finalizeWarehouseWithdrawalServer } from '../lib/server/warehouseWithdrawalWrite';
import { finalizeWarehouseWithdrawalV3Server } from '../lib/server/warehouseWithdrawalV3Write';
import { registerWarehouseManualEntryServer } from '../lib/server/warehouseManualEntry';
import { saveWarehouseMaterialServer } from '../lib/server/warehouseMaterialWrite';
import { warehouseDestinationCreateServer } from '../lib/server/warehouseDestinationWrite';
import { warehouseBarcodeServer } from '../lib/server/warehouseRemainingWrites';
import { warehouseWithdrawalV3IntentHash } from '../lib/server/warehouseWithdrawalV3Identity.mjs';
import {
  buildWarehouseWithdrawalEffectManifest,warehouseWithdrawalManifestHash,
} from '../lib/server/warehouseWithdrawalEvidence';
import { atomicWarehouseWithdrawalHash } from '../lib/server/warehouseWithdrawalAtomicWrite';
import { createWarehouseMovementId } from '../lib/warehouse/movement';
import type { WarehouseWithdrawalLineInput } from '../lib/warehouse/withdrawal';
import type { WarehouseWithdrawalV3Command } from '../lib/warehouse/withdrawalV3';

const project='demo-emprovex-security';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'
  ||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099'
  ||process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID!==project)
  throw new Error('W1_EMULATOR_ISOLATION_REQUIRED');
process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR='1';
process.env.EMPROVEX_E2E_SERVER_AUTH='1';

const ws='hgesm-aprov',ug='160416',depot='dep_'+'4'.repeat(32),
  location='loc_'+'5'.repeat(32),location2='loc_'+'6'.repeat(32);
const pos={kind:'LOCATION' as const,depotId:depot,locationId:location,subpositionId:null};
const pos2={...pos,locationId:location2};
const app=initializeApp({projectId:project,apiKey:'fake-api-key',
  authDomain:project+'.firebaseapp.com'},'w1-warehouse-v3');
const ident=(prefix:string,n:number)=>prefix+n.toString(16).padStart(32,'0');
const pass=(label:string)=>console.log('W1 EMULATOR PASS: '+label);
const documentUrl=(domain:string,id:string)=>'http://127.0.0.1:8080/v1/projects/'
  +project+'/databases/emprovex-warehouse/documents/warehouse/'+ws+'/'+domain+'/'+id;
async function mutate(domain:string,id:string,fields:Record<string,unknown>,mask?:string) {
  const url=documentUrl(domain,id)+(mask?'?updateMask.fieldPaths='+encodeURIComponent(mask):'');
  const response=await fetch(url,{method:'PATCH',headers:{
    authorization:'Bearer owner','content-type':'application/json',
  },body:JSON.stringify({fields})});
  assert.ok(response.ok,'Firestore Emulator admin PATCH '+domain+'/'+id+' '+await response.text());
}
async function deleteForensic(domain:string,id:string) {
  const response=await fetch(documentUrl(domain,id),{method:'DELETE',
    headers:{authorization:'Bearer owner'}});
  assert.ok(response.ok,'Firestore Emulator admin DELETE '+domain+'/'+id);
}
async function run(){
  const auth=getAuth(app);
  connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
  const login=await signInWithCredential(auth,GoogleAuthProvider.credential(
    JSON.stringify({sub:'w1-v3-founder',email:'aprov1hgesm@gmail.com',email_verified:true})
  ));
  const access=await verifyWarehouseRequest('Bearer '+await login.user.getIdToken());
  assert.equal(access.workspaceId,ws);assert.equal(access.ug,ug);
  const db=getFirestore(app,'emprovex-warehouse');
  connectFirestoreEmulator(db,'127.0.0.1',8080);
  const ref=(domain:string,id:string)=>doc(db,'warehouse',ws,domain,id);
  const read=async(domain:string,id:string)=>(await getDoc(ref(domain,id))).data()??null;
  await setDoc(ref('depots',depot),{
    schemaVersion:'warehouse_depot_v1',id:depot,workspaceId:ws,ug,
    code:'W1DEP',name:'Depósito W1',description:null,
    visualType:'CONTAINER',sizeProfile:'MEDIUM',status:'active',
    createdBy:access.uid,updatedBy:access.uid,
    createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
  });
  for(const [id,code] of [[location,'W1LOCAL'],[location2,'W1LOCAL2']]){
    await setDoc(ref('locations',id),{
      schemaVersion:'warehouse_location_v1',id,workspaceId:ws,ug,
      depotId:depot,kind:'LOCAL',parentLocationId:null,code,
      name:code,description:null,status:'active',createdBy:access.uid,
      updatedBy:access.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
    });
  }
  const destination=await warehouseDestinationCreateServer(access,{name:'Consumo W1'});
  const seeded=await registerWarehouseManualEntryServer(access,{
    operationId:'w1-lot-start',existingMaterialId:null,
    description:'Material W1 de alta confiabilidade',unitLabel:'UN',quantity:40,
    provenance:'Contagem',reference:'W1 fixture',position:pos,
    expiresOn:'2027-12-01',lotCode:'W1-VAL-01',barcode:null,
  });
  const material=seeded.material;
  const validity=seeded.validity!;
  await registerWarehouseManualEntryServer(access,{
    operationId:'w1-free-start',existingMaterialId:material.id,
    description:material.description,unitLabel:'UN',quantity:10,
    provenance:'Contagem',reference:'W1 fixture livre',position:pos,
    expiresOn:null,barcode:null,
  });
  await registerWarehouseManualEntryServer(access,{
    operationId:'w1-second-location',existingMaterialId:material.id,
    description:material.description,unitLabel:'UN',quantity:10,
    provenance:'Contagem',reference:'W1 fixture local 2',position:pos2,
    expiresOn:null,barcode:null,
  });
  const balance=async()=>((await read('balances',material.id))?.quantity as number);
  const v3=(n:number,lines:WarehouseWithdrawalV3Command['lines']):WarehouseWithdrawalV3Command=>({
    schemaVersion:'warehouse_withdrawal_command_v3',
    withdrawalId:ident('wd_',n),destinationId:destination.id,lines,
  });
  const logical=(q:number,position=pos,extra:Record<string,unknown>={})=>({
    materialId:material.id,position,requestedQuantity:q,...extra,
  });
  const inspect=async(input:WarehouseWithdrawalV3Command)=>{
    const header=await read('withdrawals',input.withdrawalId);
    const effect=header?.effectManifest?.lines||[];
    return {header,effect,movements:await Promise.all(effect.map((x:any)=>read('movements',x.movementId))),
      consumptions:await Promise.all(effect.map((x:any)=>read('consumptions',x.consumptionId)))};
  };
  assert.equal(await balance(),60);
  const before=await balance();
  const failing=v3(11,[logical(1),logical(1000)]);
  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,failing));
  assert.equal(await read('withdrawals',failing.withdrawalId),null);
  assert.equal(await balance(),before);
  pass('v3 linha final insuficiente: rollback sem cabeçalho nem baixa');
  const simple=v3(12,[logical(3)]);
  const committed=await finalizeWarehouseWithdrawalV3Server(access,simple);
  assert.equal(committed.movementIds.length,1);
  const a=await inspect(simple);
  assert.equal(a.header?.status,'FINALIZED');assert.equal(a.header?.atomicVersion,3);
  assert.equal(a.effect.length,1);
  assert.equal(a.movements[0].source.actorUid,access.uid);
  assert.equal(a.consumptions[0].operatorUid,access.uid);
  assert.equal(a.consumptions[0].quantity,3);
  assert.equal(a.consumptions[0].destinationId,destination.id);
  assert.equal((await finalizeWarehouseWithdrawalV3Server(access,simple)).movementIds.length,0);
  assert.equal(await balance(),before-3);
  pass('v3 commit simples, manifesto, efeitos e replay sem dupla baixa');

  const different={...simple,lines:[logical(4)]};
  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,different),
    /WAREHOUSE_WITHDRAWAL_IDEMPOTENCY_CONFLICT/);
  const afterRename=await saveWarehouseMaterialServer(access,{
    ...material,description:'Material renomeado depois da retirada',
  });
  assert.equal(afterRename.description,'Material renomeado depois da retirada');
  assert.equal((await finalizeWarehouseWithdrawalV3Server(access,simple)).movementIds.length,0);
  pass('v3 divergência rejeitada; replay após mudança da descrição');

  const converted=await saveWarehouseMaterialServer(access,{
    ...afterRename,conversions:[{presentation:{code:'box',label:'Caixa de 12 unidades'},
      factorToBaseUnit:12}],
  });
  const boxes=v3(13,[logical(1,pos,{presentationCode:'box'})]);
  const convertedResult=await finalizeWarehouseWithdrawalV3Server(access,boxes);
  assert.equal(convertedResult.movementIds.length,1);
  const b=await inspect(boxes);
  assert.equal(b.movements[0].source.quantity,12);
  assert.equal(b.movements[0].source.requestedQuantity,12); // movimento interno base
  assert.equal(b.consumptions[0].requestedQuantity,1); // histórico na apresentação
  assert.equal(b.consumptions[0].presentationLabel,'Caixa de 12 unidades');
  assert.equal(b.consumptions[0].operatorRequestedQuantity,1);
  assert.equal(b.header?.effectManifest?.lines?.[0]?.factorToBaseUnit,12);
  assert.equal((await finalizeWarehouseWithdrawalV3Server(access,boxes)).movementIds.length,0);
  pass('1 caixa corresponde a 12 unidades no ledger, mas a 1 caixa no histórico');

  const multiline=v3(14,[logical(2),logical(2),logical(3,pos2)]);
  const many=await finalizeWarehouseWithdrawalV3Server(access,multiline);
  assert.equal(many.movementIds.length,3);
  const m=await inspect(multiline);
  assert.equal(m.effect.length,3);
  assert.equal(new Set(m.effect.map((x:any)=>x.lineId)).size,3);
  assert.equal(m.consumptions.reduce((sum:number,x:any)=>sum+x.quantity,0),7);
  assert.equal((await finalizeWarehouseWithdrawalV3Server(access,multiline)).movementIds.length,0);
  pass('v3 linhas repetidas, duas posições e IDs determinísticos');

  const failBefore=v3(15,[logical(1),logical(1)]);
  const snapshot=await balance();
  process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_LINE='2';
  try{await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,failBefore),
    /WAREHOUSE_ATOMIC_TEST_INJECTED_FAILURE/);}
  finally{delete process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_LINE;}
  assert.equal(await read('withdrawals',failBefore.withdrawalId),null);
  assert.equal(await balance(),snapshot);
  pass('falha na linha 2 antes do commit sem resíduos');

  const lost=v3(16,[logical(1)]);
  process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_AFTER_COMMIT=lost.withdrawalId;
  try{await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,lost),
    /WAREHOUSE_ATOMIC_TEST_RESPONSE_LOST/);}
  finally{delete process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_AFTER_COMMIT;}
  assert.equal((await finalizeWarehouseWithdrawalV3Server(access,lost)).movementIds.length,0);
  assert.equal(await balance(),snapshot-1);
  pass('perda de resposta após commit recupera operação original');

  // Dois operadores competindo pelo mesmo saldo: exatamente uma retirada.
  const raceA=v3(21,[logical(25)]),raceB=v3(22,[logical(25)]);
  const race=await Promise.allSettled([
    finalizeWarehouseWithdrawalV3Server(access,raceA),
    finalizeWarehouseWithdrawalV3Server(access,raceB),
  ]);
  assert.equal(race.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(await balance(),snapshot-1-25);
  pass('concorrência de duas operações diferentes preserva saldo e atomicidade');

  // Mesmo comando enviado simultaneamente: um único conjunto de efeitos.
  const identical=v3(23,[logical(1)]);
  const duplicate=await Promise.allSettled([
    finalizeWarehouseWithdrawalV3Server(access,identical),
    finalizeWarehouseWithdrawalV3Server(access,identical),
  ]);
  assert.ok(duplicate.some(x=>x.status==='fulfilled'));
  assert.equal((await finalizeWarehouseWithdrawalV3Server(access,identical)).movementIds.length,0);
  assert.equal(await balance(),snapshot-1-25-1);
  pass('concorrência com a mesma identidade jamais causa dupla baixa');

  // V2 forjado com cabeçalho COMPLETO, inclusive schemaVersion: testar
  // a ausência documental, não apenas a validação superficial de cabeçalho.
  const v2id=ident('wd_',24);
  const v2line:WarehouseWithdrawalLineInput={
    lineId:ident('wline_',24),materialId:material.id,
    materialDescription:converted.description,requestedQuantity:1,baseQuantity:1,
    presentation:material.unit,presentationLabel:'UN',unitLabel:'UN',
    position:pos,positionLabel:'W1LOCAL',barcodeAssociation:null,barcode:null,
    lotId:null,lotCode:null,
  };
  const fakeV2={withdrawalId:v2id,destinationId:destination.id,
    withdrawnBy:'Operador W1',lines:[v2line]};
  await mutate('withdrawals',v2id,{
    schemaVersion:{stringValue:'warehouse_material_withdrawal_v1'},
    id:{stringValue:v2id},workspaceId:{stringValue:ws},ug:{stringValue:ug},
    destinationId:{stringValue:destination.id},
    withdrawnBy:{stringValue:fakeV2.withdrawnBy},
    payloadHash:{stringValue:atomicWarehouseWithdrawalHash(fakeV2)},
    expectedLineCount:{integerValue:'1'},appliedLineCount:{integerValue:'1'},
    atomicVersion:{integerValue:'2'},status:{stringValue:'FINALIZED'},
    createdBy:{stringValue:access.uid},
  });
  await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,fakeV2),
    /WAREHOUSE_WITHDRAWAL_RECONCILIATION_REQUIRED/);
  pass('v2 cabeçalho FINALIZED completo rejeitado sem movimento e consumo');

  // Cabeçalho v3 forjado com hash, versão e manifesto coerentes,
  // mas sem nenhum movimento ou consumo.
  const forged=v3(17,[logical(1)]);
  const syntheticLine:WarehouseWithdrawalLineInput={
    lineId:'wline_'+'e'.repeat(32),materialId:material.id,
    materialDescription:converted.description,requestedQuantity:1,baseQuantity:1,
    presentation:material.unit,presentationLabel:'UN',unitLabel:'UN',
    position:pos,positionLabel:'W1LOCAL',barcodeAssociation:null,barcode:null,
    lotId:null,lotCode:null,
  };
  // O manifesto criado pelo servidor possui ID determinístico para intenção 0, parte 0.
  const {warehouseWithdrawalV3DerivedLineId}=await import('../lib/server/warehouseWithdrawalV3Identity.mjs');
  syntheticLine.lineId=warehouseWithdrawalV3DerivedLineId(forged.withdrawalId,0,0);
  const fakeManifest=await buildWarehouseWithdrawalEffectManifest(
    ws,forged.withdrawalId,warehouseWithdrawalV3IntentHash(forged),1,[syntheticLine],{
      [syntheticLine.lineId]:{intentIndex:0,partIndex:0,
        originalRequestedQuantity:1,originalPresentationCode:'unit',
        factorToBaseUnit:1,barcodeId:null},
    });
  await mutate('withdrawals',forged.withdrawalId,{
    schemaVersion:{stringValue:'warehouse_material_withdrawal_v1'},
    id:{stringValue:forged.withdrawalId},workspaceId:{stringValue:ws},
    ug:{stringValue:ug},destinationId:{stringValue:destination.id},
    withdrawnBy:{stringValue:access.email},
    payloadHash:{stringValue:warehouseWithdrawalV3IntentHash(forged)},
    expectedLineCount:{integerValue:'1'},appliedLineCount:{integerValue:'1'},
    intentLineCount:{integerValue:'1'},atomicVersion:{integerValue:'3'},
    status:{stringValue:'FINALIZED'},createdBy:{stringValue:access.uid},
    effectManifestHash:{stringValue:warehouseWithdrawalManifestHash(fakeManifest)},
    effectManifest:{mapValue:{fields:encodeObject(fakeManifest as unknown as Record<string,unknown>)}},
  });
  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,forged),
    /WAREHOUSE_WITHDRAWAL_RECONCILIATION_REQUIRED/);
  assert.equal(await balance(),snapshot-1-25-1);
  pass('v3 cabeçalho e manifesto forjados não bastam sem efeitos');

  await mutate('withdrawals',simple.withdrawalId,{
    effectManifestHash:{stringValue:'0'.repeat(64)},
  },'effectManifestHash');
  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,simple),
    /WAREHOUSE_WITHDRAWAL_RECONCILIATION_REQUIRED/);
  pass('manifesto adulterado detectado');

  await deleteForensic('consumptions',b.effect[0].consumptionId);
  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,boxes),
    /WAREHOUSE_WITHDRAWAL_RECONCILIATION_REQUIRED/);
  pass('consumo removido detectado sem executar segunda baixa');
  await deleteForensic('movements',m.effect[0].movementId);
  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,multiline),
    /WAREHOUSE_WITHDRAWAL_RECONCILIATION_REQUIRED/);
  pass('movimento removido detectado sem executar segunda baixa');

  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server({...access,ug:'999999'},
    v3(18,[logical(1)])),/WAREHOUSE_/);
  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,
    v3(19,[{...logical(1),materialId:ident('mat_',900)}])),/WAREHOUSE_/);
  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,
    v3(20,Array.from({length:41},()=>logical(1)))),/WAREHOUSE_/);
  pass('isolamento de UG, material desconhecido e limite de linhas');

  // Desktop v2 e Mobile v3: materiais idênticos em contextos isolados,
  // mesma apresentação, quantidade, posição, autoria, destino e barcode.
  const originalA=await registerWarehouseManualEntryServer(access,{
    operationId:'w1-desktop-parity',existingMaterialId:null,
    description:'Paridade Desktop v2',unitLabel:'UN',quantity:24,
    provenance:'Contagem',reference:'paridade',position:pos,
    expiresOn:null,barcode:null,
  });
  const originalB=await registerWarehouseManualEntryServer(access,{
    operationId:'w1-mobile-parity',existingMaterialId:null,
    description:'Paridade Mobile v3',unitLabel:'UN',quantity:24,
    provenance:'Contagem',reference:'paridade',position:pos,
    expiresOn:null,barcode:null,
  });
  const presentation={code:'box' as const,label:'Caixa com 12 unidades'};
  const [desktopMaterial,mobileMaterial]=await Promise.all([
    saveWarehouseMaterialServer(access,{...originalA.material,
      conversions:[{presentation,factorToBaseUnit:12}]}),
    saveWarehouseMaterialServer(access,{...originalB.material,
      conversions:[{presentation,factorToBaseUnit:12}]}),
  ]);
  const [desktopBarcode,mobileBarcode]=await Promise.all([
    warehouseBarcodeServer(access,'SAVE',{
      materialId:desktopMaterial.id,barcode:'7891234567801',presentation,
    }),
    warehouseBarcodeServer(access,'SAVE',{
      materialId:mobileMaterial.id,barcode:'7891234567802',presentation,
    }),
  ]);
  const desktopId=ident('wd_',31),desktopLineId=ident('wline_',31);
  const desktopCommand={
    withdrawalId:desktopId,destinationId:destination.id,withdrawnBy:access.email,
    lines:[{
      lineId:desktopLineId,materialId:desktopMaterial.id,
      materialDescription:desktopMaterial.description,requestedQuantity:1,
      baseQuantity:12,presentation,presentationLabel:presentation.label,
      unitLabel:'UN',position:pos,positionLabel:'W1LOCAL',
      barcodeAssociation:desktopBarcode,barcode:desktopBarcode.barcode,
      lotId:null,lotCode:null,
    }],
  };
  const mobileCommand=v3(32,[{
    materialId:mobileMaterial.id,position:pos,requestedQuantity:1,
    barcodeId:mobileBarcode.id,
  }]);
  const [desktopDone,mobileDone]=await Promise.all([
    finalizeWarehouseWithdrawalServer(access,desktopCommand),
    finalizeWarehouseWithdrawalV3Server(access,mobileCommand),
  ]);
  assert.equal(desktopDone.withdrawal.status,'FINALIZED');
  assert.equal(mobileDone.withdrawal.status,'FINALIZED');
  assert.equal((await read('balances',desktopMaterial.id))?.quantity,12);
  assert.equal((await read('balances',mobileMaterial.id))?.quantity,12);
  const desktopMovementId=await createWarehouseMovementId(ws,
    'material-withdrawal:'+desktopId+':'+desktopLineId);
  const desktopConsumptionId='cons_'+createHash('sha256')
    .update(ws+'\n'+'stock:'+desktopId+':'+desktopLineId).digest('hex');
  const dMove=await read('movements',desktopMovementId);
  const dConsume=await read('consumptions',desktopConsumptionId);
  const vEvidence=await inspect(mobileCommand);
  const vMove=vEvidence.movements[0],vConsume=vEvidence.consumptions[0];
  for(const item of [dMove,vMove]){
    assert.equal(item.type,'OUTBOUND');
    assert.equal(item.quantityDelta,-12);
    assert.equal(item.source.actorUid,access.uid);
    assert.deepEqual(item.source.position,pos);
  }
  for(const item of [dConsume,vConsume]){
    assert.equal(item.quantity,12);
    assert.equal(item.requestedQuantity,1);
    assert.equal(item.destinationId,destination.id);
    assert.equal(item.operatorUid,access.uid);
    assert.equal(item.presentationLabel,presentation.label);
  }
  assert.equal(dMove.source.barcodeId,desktopBarcode.id);
  assert.equal(vMove.source.barcodeId,mobileBarcode.id);
  assert.equal(dMove.source.interface,'BARCODE_SCANNER');
  assert.equal(vMove.source.interface,'BARCODE_SCANNER');
  assert.equal(dConsume.barcode,desktopBarcode.barcode);
  assert.equal(vConsume.barcode,mobileBarcode.barcode);
  assert.equal(vEvidence.header.effectManifest.lines[0].factorToBaseUnit,12);
  assert.equal((await finalizeWarehouseWithdrawalServer(access,desktopCommand)).movementIds.length,0);
  assert.equal((await finalizeWarehouseWithdrawalV3Server(access,mobileCommand)).movementIds.length,0);
  pass('Desktop v2 e Mobile v3: saldos, movimentos, consumos, apresentação, barcode, autoria e destino equivalentes');

  await warehouseBarcodeServer(access,'STATUS',{barcodeId:mobileBarcode.id,status:'inactive'});
  const inactiveBarcode=v3(33,[{
    materialId:mobileMaterial.id,position:pos,requestedQuantity:1,
    barcodeId:mobileBarcode.id,
  }]);
  await assert.rejects(()=>finalizeWarehouseWithdrawalV3Server(access,inactiveBarcode),
    /WAREHOUSE_BARCODE_INACTIVE/);
  assert.equal(await read('withdrawals',inactiveBarcode.withdrawalId),null);
  assert.equal((await finalizeWarehouseWithdrawalV3Server(access,mobileCommand)).movementIds.length,0);
  pass('barcode inativo recusa nova baixa, mas não inviabiliza replay confirmado');

  console.log('W1 V3 ASSURANCE COMPLETE');
}
function encode(value:unknown):unknown{
  if(value===null||value===undefined)return {nullValue:null};
  if(typeof value==='string')return {stringValue:value};
  if(typeof value==='number')return Number.isInteger(value)
    ?{integerValue:String(value)}:{doubleValue:value};
  if(typeof value==='boolean')return {booleanValue:value};
  if(Array.isArray(value))return {arrayValue:{values:value.map(encode)}};
  return {mapValue:{fields:encodeObject(value as Record<string,unknown>)}};
}
function encodeObject(object:Record<string,unknown>):Record<string,unknown>{
  return Object.fromEntries(Object.entries(object).map(([key,value])=>[key,encode(value)]));
}
run().catch(error=>{console.error('W1 V3 FAIL:',error);process.exitCode=1;})
  .finally(async()=>{await deleteApp(app);});
