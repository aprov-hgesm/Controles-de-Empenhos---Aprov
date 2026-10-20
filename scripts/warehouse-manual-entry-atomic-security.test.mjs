#!/usr/bin/env node
/**
 * Firestore Rules Emulator — caminho localizado é somente do servidor.
 * Testa explicitamente que cliente autenticado NÃO pode gravar diretamente.
 */
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc,
  runTransaction, serverTimestamp,
} from 'firebase/firestore';

const projectId = 'demo-emprovex-security';
const workspaceId = 'hgesm-aprov';
const ug = '160416';
const mat = 'mat_' + '1'.repeat(32);
const dep = 'dep_' + '2'.repeat(32);
const loc = 'loc_' + '3'.repeat(32);
const locbal = 'locbal_' + '4'.repeat(64);
const mov = 'mov_' + '5'.repeat(64);
const position = {kind:'LOCATION',depotId:dep,locationId:loc,subpositionId:null};
const app = initializeApp({
  projectId,apiKey:'fake-api-key',authDomain:projectId+'.firebaseapp.com',
}, 'server-only-warehouse-test');

const auth = getAuth(app);
connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
await signInWithCredential(auth,GoogleAuthProvider.credential(JSON.stringify({
  sub:'server-only-founder',email:'aprov1hgesm@gmail.com',email_verified:true,
})));
const db = getFirestore(app,'emprovex-warehouse');
connectFirestoreEmulator(db,'127.0.0.1',8080);
const ref=(domain,id)=>doc(db,'warehouse',workspaceId,domain,id);

async function denied(name,action) {
  await assert.rejects(action,error=>String(error.code||error).includes('permission-denied'));
  console.log('DENY PASS:',name);
}
try {
  await setDoc(ref('materials',mat),{
    schemaVersion:'warehouse_material_v1',id:mat,
    workspaceId,ug,description:'Arroz',aliases:[],
    unit:{code:'kg',label:null},status:'active',conversions:[],
  });
  await setDoc(ref('depots',dep),{
    schemaVersion:'warehouse_depot_v1',id:dep,workspaceId,ug,
    code:'DEP-SERVER',name:'Depósito Server',description:null,
    visualType:'CONTAINER',sizeProfile:'MEDIUM',status:'active',
    createdBy:auth.currentUser.uid,updatedBy:auth.currentUser.uid,
    createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
  });
  await setDoc(ref('locations',loc),{
    schemaVersion:'warehouse_location_v1',id:loc,workspaceId,ug,depotId:dep,
    kind:'LOCAL',parentLocationId:null,code:'LOC-SERVER',
    name:'Local Server',description:null,status:'active',
    createdBy:auth.currentUser.uid,updatedBy:auth.currentUser.uid,
    createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
  });
  await denied('criacao MANUAL_ENTRY localizada via SDK do navegador',()=>runTransaction(db,async tx=>{
    const [m,b,l]=[ref('movements',mov),ref('balances',mat),ref('locationBalances',locbal)];
    await Promise.all([m,b,l].map(r=>tx.get(r)));
    tx.set(m,{
      schemaVersion:'warehouse_movement_v1',id:mov,workspaceId,ug,materialId:mat,
      type:'MANUAL_ENTRY',quantityDelta:80,idempotencyKeyHash:'5'.repeat(64),
      reversesMovementId:null,note:'Teste',
      source:{kind:'MANUAL_ENTRY',actorUid:auth.currentUser.uid,provenance:'Contagem',
        reference:null,position,locationBalanceId:locbal},
      createdAt:serverTimestamp(),
    });
    tx.set(b,{
      schemaVersion:'warehouse_balance_v1',workspaceId,ug,
      materialId:mat,quantity:80,revision:1,lastMovementId:mov,
      updatedAt:serverTimestamp(),
    });
    tx.set(l,{
      schemaVersion:'warehouse_location_balance_v1',id:locbal,workspaceId,
      ug,materialId:mat,position,quantity:80,revision:1,
      lastMovementId:mov,updatedAt:serverTimestamp(),
    });
  }));
  assert.equal((await getDoc(ref('movements',mov))).exists(),false);
  assert.equal((await getDoc(ref('balances',mat))).exists(),false);
  console.log('PASS: nenhum commit parcial após bloqueio das Rules');
} finally {
  await deleteApp(app);
}
