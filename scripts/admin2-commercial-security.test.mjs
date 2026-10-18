#!/usr/bin/env node
// Executes ONLY against Firebase Emulators. No production project/credentials.
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInAnonymously, signInWithCredential } from 'firebase/auth';
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, query, orderBy, limit, runTransaction, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-emprovex-commercial';
const FOUNDER = 'aprov1hgesm@gmail.com';
const AUTH_BASE = 'http://127.0.0.1:9099';
const FIRESTORE_BASE = 'http://127.0.0.1:8080/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';
const apps = [];
const seed = async (path, data) => {
  const encode = value => {
    if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
    if (value && typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)])) } };
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'boolean') return { booleanValue: value };
    return { nullValue: null };
  };
  const result = await fetch(FIRESTORE_BASE + '/' + path, {
    method:'PATCH',
    headers: { Authorization:'Bearer owner', 'Content-Type':'application/json' },
    body:JSON.stringify({fields:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,encode(v)]))}),
  });
  assert.ok(result.ok, await result.text());
};
const makeSession = async (name, google) => {
  const app = initializeApp({ projectId:PROJECT_ID,apiKey:'fake-api-key',authDomain:PROJECT_ID+'.firebaseapp.com' }, 'commercial-'+name);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, AUTH_BASE, {disableWarnings:true});
  if (google) {
    const credential = GoogleAuthProvider.credential(JSON.stringify({sub:'google-commercial-founder',email:FOUNDER,email_verified:true}));
    await signInWithCredential(auth, credential);
  } else {
    await signInAnonymously(auth);
  }
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return db;
};
const customerData = workspaceId => ({
  version:'emprovex_commercial_customer_v2', id:workspaceId, workspaceId,
  displayName:'Cliente Teste '+workspaceId, contactName:'Contato QA',
  contactEmail:'qa@example.invalid', contactPhone:'', relationshipStatus:'prospect',
  relationshipNotes:'Sem dados reais',
  createdAt:'2026-10-18T00:00:00.000Z',updatedAt:'2026-10-18T00:00:00.000Z',
  createdBy:FOUNDER,updatedBy:FOUNDER,
});
const deny = async (label, action) => {
  await assert.rejects(action, error => error?.code==='permission-denied', label);
  console.log('PASS DENY '+label);
};
async function main() {
  assert.equal(PROJECT_ID.startsWith('demo-'),true);
  await seed('workspaces/commercial-qa-a',{id:'commercial-qa-a',name:'QA A',status:'active',authorizedEmail:'sector@example.invalid',institutionalProfile:{organizationName:'Teste',sectionName:'APROV'},createdAt:'2026-01-01',updatedAt:'2026-01-01',createdBy:FOUNDER});
  await seed('workspaces/commercial-qa-b',{id:'commercial-qa-b',name:'QA B',status:'active',authorizedEmail:'sector@example.invalid',institutionalProfile:{organizationName:'Teste',sectionName:'APROV'},createdAt:'2026-01-01',updatedAt:'2026-01-01',createdBy:FOUNDER});
  const founder = await makeSession('founder',true);
  const anonymous = await makeSession('anonymous',false);
  const customerA = doc(founder,'platformCustomers','commercial-qa-a');
  const customerB = doc(founder,'platformCustomers','commercial-qa-b');
  await deny('anonymous cannot list customers',()=>getDocs(collection(anonymous,'platformCustomers')));
  await deny('anonymous cannot create customer',()=>setDoc(doc(anonymous,'platformCustomers','hostile'),customerData('hostile')));
  await deny('cannot register a nonexistent workspace',()=>setDoc(doc(founder,'platformCustomers','not-a-workspace'),customerData('not-a-workspace')));
  await deny('cannot register customer under wrong workspace ID',()=>setDoc(customerA,customerData('commercial-qa-b')));

  // One deterministic document per workspace; no second link collection.
  await setDoc(customerA,customerData('commercial-qa-a'));
  await setDoc(customerB,customerData('commercial-qa-b'));
  assert.equal((await getDoc(customerA)).data()?.workspaceId,'commercial-qa-a');
  assert.equal((await getDoc(customerB)).data()?.workspaceId,'commercial-qa-b');
  const page=await getDocs(query(collection(founder,'platformCustomers'),orderBy('displayName'),limit(10)));
  assert.equal(page.docs.length,2);
  await deny('anonymous cannot read contact',()=>getDoc(doc(anonymous,'platformCustomers','commercial-qa-a')));
  await deny('cannot turn customer A into workspace B',()=>updateDoc(customerA,{workspaceId:'commercial-qa-b'}));
  await deny('cannot relabel customer ID',()=>updateDoc(customerA,{id:'other-client'}));
  await deny('cannot add workspaceIds 1:N',()=>updateDoc(customerA,{workspaceIds:['commercial-qa-b']}));
  await deny('cannot overwrite original author',()=>updateDoc(customerA,{createdBy:'other@example.invalid'}));
  await deny('cannot delete commercial customer',()=>deleteDoc(customerA));
  await deny('cannot add unexpected fields',()=>updateDoc(customerA,{adminBypass:true}));
  await deny('anonymous cannot edit commercial customer',()=>updateDoc(doc(anonymous,'platformCustomers','commercial-qa-b'),{displayName:'Invasor'}));
  await updateDoc(customerA,{displayName:'Cliente A atualizado',updatedAt:'2026-10-18T01:00:00.000Z'});
  assert.equal((await getDoc(customerA)).data()?.displayName,'Cliente A atualizado');
  assert.equal((await getDoc(customerB)).data()?.displayName,'Cliente Teste commercial-qa-b');
  console.log('PASS — 1 workspace = 1 cliente; integridade imutável, founder-only, sem coleções de vínculos');
}
try { await main(); } finally { for(const app of apps) await deleteApp(app); }
