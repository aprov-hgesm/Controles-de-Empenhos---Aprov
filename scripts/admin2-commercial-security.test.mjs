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
const customerData = (id, linked) => ({
  version:'emprovex_commercial_customer_v1', id,
  displayName:'Cliente Teste', contactName:'Contato QA',
  contactEmail:'qa@example.invalid', contactPhone:'', relationshipStatus:'prospect',
  relationshipNotes:'Sem dados reais', workspaceIds:linked,
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
  const customerRef = doc(founder,'platformCustomers','commercial-test-one');
  const linkA = doc(founder,'platformCustomerWorkspaceLinks','commercial-qa-a');
  const linkB = doc(founder,'platformCustomerWorkspaceLinks','commercial-qa-b');
  await deny('anonymous cannot list customers',()=>getDocs(collection(anonymous,'platformCustomers')));
  await deny('anonymous cannot create customer',()=>setDoc(doc(anonymous,'platformCustomers','hostile'),customerData('hostile',[])));

  await runTransaction(founder, async transaction => {
    transaction.set(customerRef,customerData('commercial-test-one',['commercial-qa-a','commercial-qa-b']));
    transaction.set(linkA,{workspaceId:'commercial-qa-a',customerId:'commercial-test-one'});
    transaction.set(linkB,{workspaceId:'commercial-qa-b',customerId:'commercial-test-one'});
  });
  assert.equal((await getDoc(customerRef)).data()?.workspaceIds.length,2);
  assert.equal((await getDoc(linkA)).data()?.customerId,'commercial-test-one');
  const page = await getDocs(query(collection(founder,'platformCustomers'),orderBy('displayName'),limit(10)));
  assert.equal(page.docs.length,1);
  await deny('anonymous cannot read contact data',()=>getDoc(doc(anonymous,'platformCustomers','commercial-test-one')));
  await deny('anonymous cannot change links',()=>deleteDoc(doc(anonymous,'platformCustomerWorkspaceLinks','commercial-qa-a')));
  await deny('unrelated customer cannot steal linked workspace',()=>setDoc(
    doc(founder,'platformCustomerWorkspaceLinks','commercial-qa-a'),
    {workspaceId:'commercial-qa-a',customerId:'other'}
  ));
  await deny('cannot link nonexistent workspace',()=>setDoc(
    doc(founder,'platformCustomerWorkspaceLinks','nonexistent-qa'),
    {workspaceId:'nonexistent-qa',customerId:'commercial-test-one'}
  ));
  await deny('cannot delete commercial customer',()=>deleteDoc(customerRef));
  await deny('cannot add arbitrary fields to customer',()=>updateDoc(customerRef,{adminBypass:true}));
  await runTransaction(founder,async tx => {
    tx.update(customerRef,{workspaceIds:['commercial-qa-a'],updatedAt:'2026-10-18T01:00:00.000Z'});
    tx.delete(linkB);
  });
  assert.equal((await getDoc(customerRef)).data()?.workspaceIds.length,1);
  assert.equal((await getDoc(linkB)).exists(),false);
  console.log('PASS — 1:N, unique links, read security, validations, safe unlink');
}
try { await main(); } finally { for(const app of apps) await deleteApp(app); }
