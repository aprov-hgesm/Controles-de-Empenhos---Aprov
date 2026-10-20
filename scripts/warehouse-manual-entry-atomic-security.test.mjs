#!/usr/bin/env node
/**
 * Firebase Emulator: entrada avulsa localizada, atômica e isolada.
 * Executar apenas no projeto demo-emprovex-security com auth + firestore.
 * NUNCA aponta ao projeto de produção.
 */
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithCredential,
} from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc,
  runTransaction, serverTimestamp,
} from 'firebase/firestore';

const PROJECT = 'demo-emprovex-security';
const WORKSPACE = 'hgesm-aprov';
const UG = '160416';
const ROOT = ['warehouse', WORKSPACE];
const apps = [];
const hex = (prefix, char, count) => prefix + char.repeat(count);
const materialId = hex('mat_', '1', 32);
const depotId = hex('dep_', '2', 32);
const locationId = hex('loc_', '3', 32);
const subId = hex('sub_', '4', 32);
const localId = hex('locbal_', '5', 64);
const subBalanceId = hex('locbal_', '6', 64);
const firstMovement = hex('mov_', 'a', 64);
const secondMovement = hex('mov_', 'b', 64);
const lotId = hex('lot_', 'c', 32);
const barcodeId = hex('bar_', 'd', 64);
const outsiderMovement = hex('mov_', 'e', 64);
const fraudulentMovement = hex('mov_', 'f', 64);
const location = { kind: 'LOCATION', depotId, locationId, subpositionId: null };
const subposition = { kind: 'SUBPOSITION', depotId, locationId, subpositionId: subId };
const unit = { code: 'kg', label: null };

async function session(label, email) {
  const app = initializeApp({
    projectId: PROJECT, apiKey: 'fake-api-key', authDomain: PROJECT + '.firebaseapp.com',
  }, 'atomic-entry-' + label);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({
    sub: 'atomic-entry-' + label, email, email_verified: true,
  })));
  const db = getFirestore(app, 'emprovex-warehouse');
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return { db, user: auth.currentUser };
}
const ref = (db, collectionName, id) => doc(db, ...ROOT, collectionName, id);
const movement = (id, uid, quantity, position, balanceId, material = materialId) => ({
  schemaVersion: 'warehouse_movement_v1', id,
  workspaceId: WORKSPACE, ug: UG, materialId: material, type: 'MANUAL_ENTRY',
  quantityDelta: quantity, idempotencyKeyHash: id.slice(4),
  reversesMovementId: null, note: 'Entrada avulsa · Contagem',
  source: {
    kind: 'MANUAL_ENTRY', actorUid: uid, provenance: 'Contagem', reference: null,
    position, locationBalanceId: balanceId,
  }, createdAt: serverTimestamp(),
});
const balance = (material, quantity, revision, movementId) => ({
  schemaVersion: 'warehouse_balance_v1', workspaceId: WORKSPACE, ug: UG,
  materialId: material, quantity, revision, lastMovementId: movementId,
  updatedAt: serverTimestamp(),
});
const locationBalance = (id, material, position, quantity, revision, movementId) => ({
  schemaVersion: 'warehouse_location_balance_v1', id,
  workspaceId: WORKSPACE, ug: UG, materialId: material,
  position, quantity, revision, lastMovementId: movementId,
  updatedAt: serverTimestamp(),
});

async function mustDeny(label, action) {
  try { await action(); }
  catch (error) {
    const msg = String(error?.code || '') + ' ' + String(error);
    assert.match(msg, /permission-denied|PERMISSION_DENIED|Missing or insufficient permissions/);
    console.log('DENY PASS:', label);
    return;
  }
  throw new Error('Rules permitiram indevidamente: ' + label);
}

async function main() {
  const owner = await session('founder', 'aprov1hgesm@gmail.com');
  const other = await session('outsider', 'outsider@example.test');
  const db = owner.db, uid = owner.user.uid;

  // Estrutura física preexistente, preservada durante reset real.
  await setDoc(ref(db, 'depots', depotId), {
    schemaVersion: 'warehouse_depot_v1', id: depotId,
    workspaceId: WORKSPACE, ug: UG, code: 'DEP-ATOMIC',
    name: 'Depósito atomic', description: null,
    visualType: 'CONTAINER', sizeProfile: 'MEDIUM', status: 'active',
    createdBy: uid, updatedBy: uid,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  for (const [id, kind, parentLocationId, code] of [
    [locationId, 'LOCAL', null, 'LOC-ATOMIC'],
    [subId, 'SUBPOSITION', locationId, 'SUB-ATOMIC'],
  ]) {
    await setDoc(ref(db, 'locations', id), {
      schemaVersion: 'warehouse_location_v1', id,
      workspaceId: WORKSPACE, ug: UG, depotId, kind, parentLocationId,
      code, name: code, description: null, status: 'active',
      createdBy: uid, updatedBy: uid,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  }

  // Teste central: 4 writes (material + movimento + 2 projeções), novos em conjunto.
  await runTransaction(db, async tx => {
    const mr=ref(db,'materials',materialId), mv=ref(db,'movements',firstMovement),
      br=ref(db,'balances',materialId), lr=ref(db,'locationBalances',localId);
    const snapshots=await Promise.all([mr,mv,br,lr].map(r=>tx.get(r)));
    assert.ok(snapshots.every(s=>!s.exists()));
    tx.set(mr, {
      schemaVersion:'warehouse_material_v1', id:materialId, workspaceId:WORKSPACE,
      ug:UG, description:'Arroz para teste atômico',
      aliases:[], unit, status:'active', conversions:[],
    });
    tx.set(mv,movement(firstMovement,uid,80,location,localId));
    tx.set(br,balance(materialId,80,1,firstMovement));
    tx.set(lr,locationBalance(localId,materialId,location,80,1,firstMovement));
  });
  assert.equal((await getDoc(ref(db,'balances',materialId))).data().quantity,80);
  console.log('ALLOW PASS: material e entrada LOCAL criados juntos');

  // Segunda entrada na subposição: atomicamente movimento, saldos, lote e código.
  await runTransaction(db, async tx=>{
    const mr=ref(db,'movements',secondMovement), br=ref(db,'balances',materialId),
      lr=ref(db,'locationBalances',subBalanceId), lot=ref(db,'lots',lotId),
      barcode=ref(db,'barcodes',barcodeId);
    const [ms,bs,ls,lotS,barS]=await Promise.all([mr,br,lr,lot,barcode].map(r=>tx.get(r)));
    assert.ok(!ms.exists() && bs.exists() && !ls.exists() && !lotS.exists() && !barS.exists());
    tx.set(mr,movement(secondMovement,uid,20,subposition,subBalanceId));
    tx.set(br,balance(materialId,100,2,secondMovement));
    tx.set(lr,locationBalance(subBalanceId,materialId,subposition,20,1,secondMovement));
    tx.set(lot,{
      schemaVersion:'warehouse_lot_v1',id:lotId, workspaceId:WORKSPACE,
      ug:UG,materialId,code:'__EMPROVEX_PENDING_LOT__:manual-atomic-test',
      expiresOn:'2027-04-18',quantity:20,position:subposition,
      origin:{kind:'MANUAL_ENRICHMENT',movementId:secondMovement,
        invoiceRecordKey:null,invoiceId:null,supplier:null,supplierCnpj:null},
      status:'active',createdBy:uid,updatedBy:uid,
      createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
    });
    tx.set(barcode,{
      schemaVersion:'warehouse_barcode_v1',id:barcodeId,
      workspaceId:WORKSPACE,ug:UG,materialId,barcode:'7896305701574',
      presentation:unit,factorToBaseUnit:1,status:'active',
      createdBy:uid,updatedBy:uid,
      createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
    });
  });
  assert.equal((await getDoc(ref(db,'balances',materialId))).data().quantity,100);
  assert.equal((await getDoc(ref(db,'locationBalances',subBalanceId))).data().quantity,20);
  assert.equal((await getDoc(ref(db,'barcodes',barcodeId))).data().materialId,materialId);
  assert.equal((await getDoc(ref(db,'lots',lotId))).data().quantity,20);
  console.log('ALLOW PASS: SUBPOSITION + validade + barcode numa única transação');

  // Falha na referência física deve invalidar a transação inteira.
  await mustDeny('movimento aponta para outro saldo local',()=>runTransaction(db,async tx=>{
    const mv=ref(db,'movements',fraudulentMovement),br=ref(db,'balances',materialId),
      lb=ref(db,'locationBalances',subBalanceId);
    await Promise.all([mv,br,lb].map(r=>tx.get(r)));
    tx.set(mv,movement(fraudulentMovement,uid,10,location,localId));
    tx.set(br,balance(materialId,110,3,fraudulentMovement));
    tx.set(lb,locationBalance(subBalanceId,materialId,subposition,30,2,fraudulentMovement));
  }));
  assert.equal((await getDoc(ref(db,'movements',fraudulentMovement))).exists(),false);
  assert.equal((await getDoc(ref(db,'balances',materialId))).data().quantity,100);

  await mustDeny('usuário sem acesso não registra material',()=>runTransaction(other.db,async tx=>{
    const mv=ref(other.db,'movements',outsiderMovement);
    const br=ref(other.db,'balances',materialId);
    const lr=ref(other.db,'locationBalances',localId);
    await Promise.all([mv,br,lr].map(r=>tx.get(r)));
    tx.set(mv,movement(outsiderMovement,other.user.uid,1,location,localId));
    tx.set(br,balance(materialId,101,3,outsiderMovement));
    tx.set(lr,locationBalance(localId,materialId,location,81,2,outsiderMovement));
  }));
  assert.equal((await getDoc(ref(db,'movements',outsiderMovement))).exists(),false);
  console.log('EMULATOR SUITE PASS');
}
try { await main(); }
finally { await Promise.all(apps.map(app=>deleteApp(app))); }
