import test from 'node:test';
import assert from 'node:assert/strict';
import { createFiscalTransport } from './firestoreTransport.mjs';
import { createFiscalStore, FiscalStoreError } from './firestoreStore.mjs';
const project=process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID||'';
assert.match(project,/^demo-/);
assert.equal(process.env.EMPROVEX_E2E_SERVER_AUTH,'1');
assert.ok(['127.0.0.1:8080','localhost:8080'].includes(process.env.FIRESTORE_EMULATOR_HOST));
assert.ok(['127.0.0.1:9099','localhost:9099'].includes(process.env.FIREBASE_AUTH_EMULATOR_HOST));
const transport=createFiscalTransport({projectId:project,emulatorHost:process.env.FIRESTORE_EMULATOR_HOST,tokenProvider:async()=> 'owner'});
const store=createFiscalStore(transport);
const make=(company,id,number,key='idem-key')=>({
  id,companyId:company,workspaceId:company,issuerCnpj:'11444777000161',
  connectionId:'conn-qa',environment:'homologacao',series:1,number,
  orderId:'order-qa',idempotencyKey:key,fingerprint:'a'.repeat(64),
  reservationId:'reservation-qa',createdByUid:'owner-qa',
  createdAt:'2026-11-06T20:00:00Z',updatedAt:'2026-11-06T20:00:00Z',
  revision:1,status:'draft',audit:[{type:'created',uid:'owner-qa'}]
});
const meta=(company,number,key='idem-key')=>({
  numberKey:company+':11444777000161:homologacao:1:'+number,
  idempotencyKey:key,fingerprint:'a'.repeat(64)
});
test('Emulator REAL: reserva atômica A/B, replay, conflito de número e CAS concorrente',async()=>{
 const A='company-w10-stage3-a',B='company-w10-stage3-b';
 const a=make(A,'document-A',22),b=make(B,'document-B',22);
 for (const forged of [A+':wrong-cnpj:homologacao:1:22',A+':11444777000161:homologacao:1:23',B+':11444777000161:homologacao:1:22']) {
  await assert.rejects(store.reserve(a,{...meta(A,22),numberKey:forged}),e=>e.code==='NFE_RESERVATION_INVALID');
 }
 await assert.rejects(store.reserve({...a,series:0},meta(A,22)),e=>e.code==='NFE_RESERVATION_INVALID');
 const [ra,rb]=await Promise.all([store.reserve(a,meta(A,22)),store.reserve(b,meta(B,22))]);
 assert.equal(ra.id,'document-A');assert.equal(rb.id,'document-B');
 assert.equal((await store.reserve(make(A,'another-id',22),meta(A,22))).id,'document-A');
 await assert.rejects(store.reserve(make(A,'duplicate-number',22,'second-key'),meta(A,22,'second-key')),e=>e.code==='NFE_NUMBER_RESERVED');
 assert.equal((await store.read(A,'document-A')).revision,1);
 assert.equal(await store.read(A,'document-B'),null);
 const next={...a,revision:2,status:'ready_for_review',audit:[...a.audit,{uid:'owner-qa'}]};
 const [r1,r2]=await Promise.all([store.cas(A,a.id,1,next),store.cas(A,a.id,1,next)]);
 assert.equal([r1,r2].filter(Boolean).length,1,'CAS must allow exactly one update');
 assert.equal((await store.read(A,a.id)).revision,2);
 assert.equal(await store.cas(A,a.id,1,next),null);
 await assert.rejects(store.cas(A,a.id,2,{...next,revision:3,companyId:B}),e=>e.code==='NFE_CAS_SCOPE_INVALID');
});
