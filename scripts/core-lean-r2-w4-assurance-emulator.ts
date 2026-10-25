#!/usr/bin/env node
/**
 * CORE LEAN R2 / W4 independent server assurance.
 * Execute ONLY against the isolated Auth + named Firestore emulators.
 * Tests real committed documents, not source-code patterns.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { verifyWarehouseRequest } from '../lib/server/warehouseAccess';
import { registerWarehouseManualEntryServer } from '../lib/server/warehouseManualEntry';
import { warehouseDestinationCreateServer } from '../lib/server/warehouseDestinationWrite';
import { saveWarehouseMaterialServer } from '../lib/server/warehouseMaterialWrite';
import { writeWarehouseLotServer } from '../lib/server/warehouseLotWrite';
import { finalizeWarehouseWithdrawalServer } from '../lib/server/warehouseWithdrawalWrite';
import { atomicWarehouseWithdrawalHash } from '../lib/server/warehouseWithdrawalAtomicWrite';
import { createWarehouseMovementId } from '../lib/warehouse/movement';
import { createWarehouseLocationBalanceId } from '../lib/warehouse/location';
import type { WarehouseStockPosition } from '../lib/warehouse/location';
import type { WarehouseWithdrawalLineInput } from '../lib/warehouse/withdrawal';
import type { FinalizeWarehouseMaterialWithdrawalInput } from '../lib/warehouse/withdrawalRepository';

const project='demo-emprovex-security';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080'
    || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
    || process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID !== project) {
  throw new Error('W4_REQUIRES_ISOLATED_EMULATORS');
}
process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR='1';
process.env.EMPROVEX_E2E_SERVER_AUTH='1';

const ws='hgesm-aprov', ug='160416';
const depotId='dep_'+'4'.repeat(32), locationId='loc_'+'5'.repeat(32);
const position:WarehouseStockPosition={kind:'LOCATION',depotId,locationId,subpositionId:null};
const app=initializeApp({projectId:project,apiKey:'fake-api-key',
  authDomain:project+'.firebaseapp.com'},'core-lean-w4-assurance');

const pass=(name:string)=>console.log('W4 PASS: '+name);
const ident=(prefix:string,number:number)=>prefix+Number(number).toString(16).padStart(32,'0');
const consumptionId=(withdrawalId:string,lineId:string)=>'cons_'+createHash('sha256')
  .update(ws+'\n'+'stock:'+withdrawalId+':'+lineId).digest('hex');

async function run() {
  const auth=getAuth(app);
  connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
  const login=await signInWithCredential(auth,GoogleAuthProvider.credential(
    JSON.stringify({sub:'core-lean-w4-founder',email:'aprov1hgesm@gmail.com',email_verified:true})
  ));
  const access=await verifyWarehouseRequest('Bearer '+await login.user.getIdToken());
  assert.equal(access.workspaceId,ws);
  assert.equal(access.ug,ug);
  assert.equal(access.uid,login.user.uid);
  const db=getFirestore(app,'emprovex-warehouse');
  connectFirestoreEmulator(db,'127.0.0.1',8080);
  const ref=(kind:string,id:string)=>doc(db,'warehouse',ws,kind,id);
  const read=async(kind:string,id:string)=>(await getDoc(ref(kind,id))).data()??null;

  await setDoc(ref('depots',depotId),{
    schemaVersion:'warehouse_depot_v1',id:depotId,workspaceId:ws,ug,
    code:'W4QA',name:'Depósito W4',description:null,
    visualType:'CONTAINER',sizeProfile:'MEDIUM',status:'active',
    createdBy:access.uid,updatedBy:access.uid,
    createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
  });
  await setDoc(ref('locations',locationId),{
    schemaVersion:'warehouse_location_v1',id:locationId,workspaceId:ws,ug,
    depotId,kind:'LOCAL',parentLocationId:null,code:'W4LOCAL',
    name:'Local W4',description:null,status:'active',createdBy:access.uid,
    updatedBy:access.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
  });
  const destination=await warehouseDestinationCreateServer(access,{name:'Consumo W4'});

  const seeded=await registerWarehouseManualEntryServer(access,{
    operationId:'core-lean-w4-stock-lot',existingMaterialId:null,
    description:'Material W4 com validade',unitLabel:'KG',quantity:40,
    provenance:'Contagem',reference:'W4 fixture',position,
    expiresOn:'2027-11-10',lotCode:'W4-V-001',barcode:null,
  });
  const validity=seeded.validity;
  if(!validity) throw new Error('SEED_VALIDADE_AUSENTE');
  const material=seeded.material, lotId=validity.id;
  await registerWarehouseManualEntryServer(access,{
    operationId:'core-lean-w4-stock-free',existingMaterialId:material.id,
    description:material.description,unitLabel:'KG',quantity:10,
    provenance:'Contagem',reference:'W4 livre',position,
    expiresOn:null,barcode:null,
  });
  const locationBalanceId=await createWarehouseLocationBalanceId(ws,material.id,position);
  const state=async()=>({
    total:(await read('balances',material.id))?.quantity,
    local:(await read('locationBalances',locationBalanceId))?.quantity,
    tracked:(await read('lots',lotId))?.quantity,
  });
  const line=(quantity:number,serial:number,lot:string|null=lotId):WarehouseWithdrawalLineInput=>({
    lineId:ident('wline_',serial),materialId:material.id,
    materialDescription:material.description,requestedQuantity:quantity,
    baseQuantity:quantity,presentation:material.unit,
    presentationLabel:'KG',unitLabel:'KG',position,
    positionLabel:'W4QA / W4LOCAL',barcodeAssociation:null,
    barcode:null,lotId:lot,lotCode:lot===lotId?validity.code:null,
  });
  const command=(number:number,lines:WarehouseWithdrawalLineInput[]):FinalizeWarehouseMaterialWithdrawalInput=>({
    withdrawalId:ident('wd_',number),destinationId:destination.id,
    withdrawnBy:'Operador QA',lines,
  });
  const effects=async(input:FinalizeWarehouseMaterialWithdrawalInput)=>{
    const h=await read('withdrawals',input.withdrawalId);
    const lines=await Promise.all(input.lines.map(async item=>{
      const mid=await createWarehouseMovementId(ws,
        'material-withdrawal:'+input.withdrawalId+':'+item.lineId);
      return {movement:await read('movements',mid),
        consumption:await read('consumptions',consumptionId(input.withdrawalId,item.lineId))};
    }));
    return {header:h,lines};
  };
  const noEffects=async(input:FinalizeWarehouseMaterialWithdrawalInput)=>{
    const actual=await effects(input);
    assert.equal(actual.header,null,'Cabeçalho indevido');
    for(const item of actual.lines){
      assert.equal(item.movement,null,'Movimento indevido');
      assert.equal(item.consumption,null,'Consumo indevido');
    }
  };
  const complete=async(input:FinalizeWarehouseMaterialWithdrawalInput)=>{
    const actual=await effects(input);
    assert.equal(actual.header?.status,'FINALIZED');
    assert.equal(actual.header?.atomicVersion,2);
    assert.equal(actual.header?.appliedLineCount,input.lines.length);
    assert.equal(actual.header?.createdBy,access.uid);
    let sum=0;
    for(let i=0;i<input.lines.length;i++){
      const {movement,consumption}=actual.lines[i],l=input.lines[i];
      assert.ok(movement,'Movimento ausente para linha '+i);
      assert.ok(consumption,'Consumo ausente para linha '+i);
      assert.equal(movement.workspaceId,ws);
      assert.equal(movement.ug,ug);
      assert.equal(movement.quantityDelta,-l.baseQuantity);
      assert.equal(movement.source.actorUid,access.uid);
      assert.equal(consumption.operatorUid,access.uid);
      assert.equal(consumption.quantity,l.baseQuantity);
      assert.equal(consumption.withdrawalId,input.withdrawalId);
      assert.equal(consumption.lineId,l.lineId);
      assert.equal(consumption.movementId,movement.id);
      sum+=consumption.quantity;
    }
    assert.equal(sum,input.lines.reduce((s,l)=>s+l.baseQuantity,0));
  };

  assert.deepEqual(await state(),{total:50,local:50,tracked:40});
  await assert.rejects(()=>verifyWarehouseRequest(null));
  await assert.rejects(()=>verifyWarehouseRequest('Bearer forged-w4-token'));
  pass('sessão Firebase real resolve UID/UG/escopo; token ausente/forjado é recusado');

  const lastLineFails=command(100,[line(1,101),line(70,102)]);
  await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,lastLineFails));
  await noEffects(lastLineFails);
  assert.deepEqual(await state(),{total:50,local:50,tracked:40});
  pass('estoque insuficiente na última linha: rollback global e zero documentos');

  const fault=command(110,[line(1,111),line(2,112)]);
  process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_LINE='2';
  try{
    await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,fault),
      /WAREHOUSE_ATOMIC_TEST_INJECTED_FAILURE/);
  } finally {delete process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_LINE;}
  await noEffects(fault);
  assert.deepEqual(await state(),{total:50,local:50,tracked:40});
  pass('falha injetada na linha posterior antes do commit: zero efeito');

  const multi=command(120,[line(3,121),line(4,122)]);
  const created=await finalizeWarehouseWithdrawalServer(access,multi);
  assert.equal(created.movementIds.length,2);
  await complete(multi);
  assert.deepEqual(await state(),{total:43,local:43,tracked:33});
  const repeat=await finalizeWarehouseWithdrawalServer(access,multi);
  assert.equal(repeat.movementIds.length,0);
  await complete(multi);
  assert.deepEqual(await state(),{total:43,local:43,tracked:33});
  pass('retirada multilinha na mesma posição/validade: saldos, ledger, consumo, autoria e replay');

  await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,{
    ...multi,lines:[multi.lines[0],{...multi.lines[1],requestedQuantity:5,baseQuantity:5}],
  }),/WAREHOUSE_WITHDRAWAL_IDEMPOTENCY_CONFLICT/);
  assert.deepEqual(await state(),{total:43,local:43,tracked:33});
  pass('mesmo ID e payload divergente bloqueados');

  const renamed=await saveWarehouseMaterialServer(access,{
    ...material,description:'Material W4 renomeado após a primeira retirada',
  });
  assert.equal(renamed.description,'Material W4 renomeado após a primeira retirada');
  assert.equal((await finalizeWarehouseWithdrawalServer(access,multi)).movementIds.length,0);
  assert.deepEqual(await state(),{total:43,local:43,tracked:33});
  pass('rótulo de material alterado após commit não impede replay do comando original');

  const afterCommit=command(130,[line(2,131)]);
  process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_AFTER_COMMIT=afterCommit.withdrawalId;
  try{
    await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,afterCommit),
      /WAREHOUSE_ATOMIC_TEST_RESPONSE_LOST/);
  }finally{delete process.env.EMPROVEX_WAREHOUSE_ATOMIC_FAULT_AFTER_COMMIT;}
  await complete(afterCommit);
  assert.deepEqual(await state(),{total:41,local:41,tracked:31});
  assert.equal((await finalizeWarehouseWithdrawalServer(access,afterCommit)).movementIds.length,0);
  assert.deepEqual(await state(),{total:41,local:41,tracked:31});
  pass('resposta HTTP perdida após commit: convergência sem dupla baixa');

  const sameId=command(140,[line(2,141)]);
  await Promise.allSettled([
    finalizeWarehouseWithdrawalServer(access,sameId),
    finalizeWarehouseWithdrawalServer(access,sameId),
  ]);
  const reconciled=await finalizeWarehouseWithdrawalServer(access,sameId);
  assert.equal(reconciled.withdrawal.status,'FINALIZED');
  await complete(sameId);
  assert.deepEqual(await state(),{total:39,local:39,tracked:29});
  pass('concorrência com comando idêntico: movimento único após reconciliação');

  const contenderA=command(150,[line(25,151)]);
  const contenderB=command(160,[line(25,161)]);
  await Promise.allSettled([
    finalizeWarehouseWithdrawalServer(access,contenderA),
    finalizeWarehouseWithdrawalServer(access,contenderB),
  ]);
  // Uma tentativa pode abortar por contenção. Repetir as duas identidades
  // demonstra que somente uma pode consumir o mesmo saldo remanescente.
  await Promise.allSettled([
    finalizeWarehouseWithdrawalServer(access,contenderA),
    finalizeWarehouseWithdrawalServer(access,contenderB),
  ]);
  const a=(await effects(contenderA)).header;
  const b=(await effects(contenderB)).header;
  assert.equal(Number(Boolean(a))+Number(Boolean(b)),1,
    'Deve existir exatamente um commit para o saldo disputado');
  if(a)await complete(contenderA);
  if(b)await complete(contenderB);
  assert.deepEqual(await state(),{total:14,local:14,tracked:4});
  pass('duas identidades diferentes disputam saldo: sem duplo débito e sem negativo');

  const nullBypass=command(170,[line(11,171,null)]);
  await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,nullBypass),
    /WAREHOUSE_OUTBOUND_UNTRACKED_QUANTITY_NOT_AVAILABLE/);
  await noEffects(nullBypass);
  assert.deepEqual(await state(),{total:14,local:14,tracked:4});
  pass('lotId nulo não consome estoque atribuído a validade (4 atribuídos, 10 livres)');

  await writeWarehouseLotServer(access,'UPDATE',{
    lotId,input:{expiresOn:'2026-01-01'},
  });
  const expired=command(180,[line(1,181)]);
  await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,expired),
    /WAREHOUSE_OUTBOUND_LOT_EXPIRED/);
  await noEffects(expired);
  await writeWarehouseLotServer(access,'UPDATE',{
    lotId,input:{expiresOn:'2027-11-10'},
  });
  pass('validade vencida recusada antes de qualquer commit');

  const badUg=command(190,[line(1,191)]);
  await assert.rejects(()=>finalizeWarehouseWithdrawalServer({...access,ug:'999999'},badUg));
  await noEffects(badUg);
  const foreign=command(200,[{
    ...line(1,201),materialId:ident('mat_',200),
  }]);
  await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,foreign));
  await noEffects(foreign);
  pass('escopo de UG divergente e material não pertencente ao workspace bloqueados');

  const invalidId=command(210,[line(1,211)]);
  await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,{
    ...invalidId,withdrawalId:'../anotherWorkspace',
  }),/WAREHOUSE_WITHDRAWAL_INPUT_INVALID/);
  const repeatedLines=command(220,[line(1,221),line(1,221)]);
  await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,repeatedLines),
    /WAREHOUSE_WITHDRAWAL_DUPLICATE_LINE_ID/);
  await noEffects(repeatedLines);
  const overflow=command(230,Array.from({length:41},(_,i)=>line(1,240+i)));
  await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,overflow),
    /WAREHOUSE_WITHDRAWAL_INPUT_INVALID/);
  await noEffects(overflow);
  pass('identidades arbitrárias, linhas duplicadas e limites rejeitados');

  const secondValidity=await writeWarehouseLotServer(access,'CREATE',{
    materialId:material.id,code:'W4-V-002',quantity:3,
    position,expiresOn:'2027-12-01',
  });
  assert.equal(secondValidity.quantity,3);
  const withConversion=await saveWarehouseMaterialServer(access,{
    ...renamed,conversions:[{
      presentation:{code:'box',label:'Caixa 2 KG'},factorToBaseUnit:2,
    }],
  });
  assert.equal(withConversion.conversions.length,1);
  const secondLine:WarehouseWithdrawalLineInput={
    ...line(2,262,secondValidity.id),requestedQuantity:1,
    baseQuantity:2,presentation:{code:'box',label:'Caixa 2 KG'},
    presentationLabel:'Caixa 2 KG',lotCode:secondValidity.code,
  };
  const splitValidity=command(260,[line(1,261),secondLine]);
  const splitResult=await finalizeWarehouseWithdrawalServer(access,splitValidity);
  assert.equal(splitResult.movementIds.length,2);
  await complete(splitValidity);
  const splitRecords=await effects(splitValidity);
  assert.equal(splitRecords.lines[0].movement?.source.lotId,lotId);
  assert.equal(splitRecords.lines[1].movement?.source.lotId,secondValidity.id);
  assert.equal(splitRecords.lines[1].movement?.source.factorToBaseUnit,2);
  assert.equal(splitRecords.lines[1].consumption?.requestedQuantity,1);
  assert.equal((await read('lots',secondValidity.id))?.quantity,1);
  assert.deepEqual(await state(),{total:11,local:11,tracked:3});
  assert.equal((await finalizeWarehouseWithdrawalServer(access,splitValidity)).movementIds.length,0);
  pass('duas validades no mesmo comando e apresentação convertida 1 caixa = 2 KG');

  await writeWarehouseLotServer(access,'UPDATE',{
    lotId:secondValidity.id,input:{status:'inactive'},
  });
  const inactive=command(270,[{
    ...line(1,271,secondValidity.id),lotCode:secondValidity.code,
  }]);
  await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,inactive),
    /WAREHOUSE_OUTBOUND_LOT_INACTIVE/);
  await noEffects(inactive);
  assert.deepEqual(await state(),{total:11,local:11,tracked:3});
  pass('validade inativa é rejeitada antes do commit sem documentos residuais');

  // Negative control: forged FINALIZED v2 header without any movements/consumptions.
  // Should fail until engine checks audit evidence on a confirmed replay.
  const forged=command(300,[line(1,301)]);
  const phantomFields={
    id:{stringValue:forged.withdrawalId},workspaceId:{stringValue:ws},
    ug:{stringValue:ug},destinationId:{stringValue:destination.id},
    withdrawnBy:{stringValue:forged.withdrawnBy},
    payloadHash:{stringValue:atomicWarehouseWithdrawalHash(forged)},
    expectedLineCount:{integerValue:'1'},appliedLineCount:{integerValue:'1'},
    atomicVersion:{integerValue:'2'},status:{stringValue:'FINALIZED'},
    createdBy:{stringValue:access.uid},
  };
  const url='http://127.0.0.1:8080/v1/projects/'+project+
    '/databases/emprovex-warehouse/documents/warehouse/'+ws+
    '/withdrawals/'+forged.withdrawalId;
  const response=await fetch(url,{
    method:'PATCH',headers:{authorization:'Bearer owner','content-type':'application/json'},
    body:JSON.stringify({fields:phantomFields}),
  });
  assert.equal(response.ok,true,'Fixture forense do cabeçalho inconsistente');
  await assert.rejects(()=>finalizeWarehouseWithdrawalServer(access,forged),
    /RECONCILIATION_REQUIRED|ATOMIC_HEADER_INVALID|INTEGRITY/);
  pass('replay v2 detecta FINALIZED sem movimentação/consumo (controle negativo)');

  console.log('W4 ASSURANCE COMPLETE');
}

run().catch(error=>{console.error('W4 FAIL:',error);process.exitCode=1;})
  .finally(async()=>{await deleteApp(app);});
