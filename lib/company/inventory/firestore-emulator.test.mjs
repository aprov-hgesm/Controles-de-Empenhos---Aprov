/** Executar SOMENTE via firebase emulators:exec --project demo-emprovex-company-w7. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

const project=process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID;
const fsHost=process.env.FIRESTORE_EMULATOR_HOST,authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST;
assert.match(project||'',/^demo-[a-z0-9-]+$/);
assert.equal(fsHost,'127.0.0.1:8080');
assert.equal(authHost,'127.0.0.1:9099');
assert.equal(process.env.EMPROVEX_E2E_SERVER_AUTH,'1');
assert.ok(!process.env.K_SERVICE&&!process.env.VERCEL&&!process.env.GAE_SERVICE,'Never execute against production');
const prefix='projects/'+project+'/databases/(default)/documents';
const root='http://'+fsHost+'/v1/'+prefix;
const token={Authorization:'Bearer owner','Content-Type':'application/json'};
const str=value=>({stringValue:String(value)});
const fields=value=>Object.fromEntries(Object.entries(value).map(([k,v])=>[k,str(v)]));
const docName=path=>prefix+'/'+path;
const document=async path=>{
 const r=await fetch(root+'/'+path,{headers:token});
 return {status:r.status,body:await r.json().catch(()=>({}))};
};
const commit=async writes=>{
 const r=await fetch(root+':commit',{method:'POST',headers:token,body:JSON.stringify({writes})});
 return {status:r.status,body:await r.json().catch(()=>({}))};
};
const create=(path,record)=>({update:{name:docName(path),fields:fields(record)},currentDocument:{exists:false}});
const update=(path,record,version)=>({update:{name:docName(path),fields:fields(record)},currentDocument:{updateTime:version}});

test('Firestore Emulator real: duas reservas concorrentes no último saldo não confirmam juntas',async()=>{
 const scope='w7-'+randomUUID();
 const a='supplierCompanyWorkspaces/company-demo-A/stockEvents/'+scope;
 const b='supplierCompanyWorkspaces/company-demo-B/stockEvents/'+scope;
 const baseline={companyId:'company-demo-A',workspaceId:'company-demo-A',schemaVersion:'company-r1-v1',id:scope,onHand:'1',reserved:'0'};
 const seed=await commit([create(a,baseline),create(b,{...baseline,companyId:'company-demo-B',workspaceId:'company-demo-B'})]);
 assert.equal(seed.status,200,JSON.stringify(seed.body));
 const before=await document(a);assert.equal(before.status,200);
 const revision=before.body.updateTime;
 const reservation={...baseline,reserved:'1'};
 const idemA='supplierCompanyWorkspaces/company-demo-A/idempotencyKeys/idem'+randomUUID().replaceAll('-','');
 const idemB='supplierCompanyWorkspaces/company-demo-A/idempotencyKeys/idem'+randomUUID().replaceAll('-','');
 const logA='supplierCompanyWorkspaces/company-demo-A/auditEvents/audit'+randomUUID().replaceAll('-','');
 const logB='supplierCompanyWorkspaces/company-demo-A/auditEvents/audit'+randomUUID().replaceAll('-','');
 const [first,second]=await Promise.all([
  commit([update(a,reservation,revision),create(idemA,{companyId:'company-demo-A',uid:'qa'}),create(logA,{companyId:'company-demo-A',action:'stockEvents:write'})]),
  commit([update(a,reservation,revision),create(idemB,{companyId:'company-demo-A',uid:'qa'}),create(logB,{companyId:'company-demo-A',action:'stockEvents:write'})]),
 ]);
 assert.equal([first,second].filter(x=>x.status===200).length,1,JSON.stringify([first,second]));
 const after=await document(a);assert.equal(after.body.fields.reserved.stringValue,'1');
 const auditRows=await Promise.all([document(idemA),document(idemB),document(logA),document(logB)]);
 assert.equal(auditRows.filter(x=>x.status===200).length,2,'Only winner creates key+audit atomically');
 const untouched=await document(b);assert.equal(untouched.body.fields.reserved.stringValue,'0','B untouched');
});
test('Firestore Emulator real: idempotency key exists=false forbids replay write and preserves stock atomically',async()=>{
 const scope='w7-'+randomUUID();
 const rootA='supplierCompanyWorkspaces/company-demo-A/';
 const path=rootA+'stockEvents/'+scope;
 const idem=rootA+'idempotencyKeys/idem'+randomUUID().replaceAll('-','');
 assert.equal((await commit([create(path,{schemaVersion:'company-r1-v1',companyId:'company-demo-A',workspaceId:'company-demo-A',id:scope,onHand:'2',reserved:'0'})])).status,200);
 const first=await document(path);const record={schemaVersion:'company-r1-v1',companyId:'company-demo-A',workspaceId:'company-demo-A',id:scope,onHand:'2',reserved:'1'};
 const accepted=await commit([update(path,record,first.body.updateTime),create(idem,{requestHash:'sha-qa',companyId:'company-demo-A'})]);
 assert.equal(accepted.status,200);
 const latest=await document(path);
 const repeated=await commit([update(path,{...record,reserved:'2'},latest.body.updateTime),create(idem,{requestHash:'changed',companyId:'company-demo-A'})]);
 assert.notEqual(repeated.status,200);
 const after=await document(path);assert.equal(after.body.fields.reserved.stringValue,'1');
 const keyDoc=await document(idem);assert.equal(keyDoc.body.fields.requestHash.stringValue,'sha-qa');
});


test('Firestore Emulator real: consumo do mesmo W6 receipt event/linha não duplica estoque entre UIDs',async()=>{
 const scope='w7-'+randomUUID().replaceAll('-','');
 const owner='supplierCompanyWorkspaces/company-demo-A/';
 const stock=owner+'stockEvents/'+scope;
 const source=owner+'inboundShipments/evt'+scope;
 const marker=owner+'allocations/receipt'+scope;
 const idema=owner+'idempotencyKeys/idem'+randomUUID().replaceAll('-','');
 const idemb=owner+'idempotencyKeys/idem'+randomUUID().replaceAll('-','');
 const initial={schemaVersion:'company-r1-v1',id:scope,companyId:'company-demo-A',workspaceId:'company-demo-A',onHand:'0',reserved:'0'};
 const seed=await commit([create(stock,initial),create(source,{schemaVersion:'company-r1-v1',id:'evt'+scope,companyId:'company-demo-A',workspaceId:'company-demo-A',kind:'purchase.received',stockPosted:'false'})]);
 assert.equal(seed.status,200);
 const existing=await document(stock);assert.equal(existing.status,200);
 const newPhysical={...initial,onHand:'2'};
 const consumed={schemaVersion:'company-r1-v1',id:'receipt'+scope,companyId:'company-demo-A',workspaceId:'company-demo-A',kind:'receipt_consumed',purchaseEventId:'evt'+scope};
 const [a,b]=await Promise.all([
  commit([update(stock,newPhysical,existing.body.updateTime),create(marker,consumed),create(idema,{uid:'operator-a',requestHash:'a',companyId:'company-demo-A'})]),
  commit([update(stock,newPhysical,existing.body.updateTime),create(marker,consumed),create(idemb,{uid:'operator-b',requestHash:'b',companyId:'company-demo-A'})]),
 ]);
 assert.equal([a,b].filter(x=>x.status===200).length,1,JSON.stringify([a,b]));
 assert.equal((await document(stock)).body.fields.onHand.stringValue,'2');
 assert.equal((await document(marker)).status,200);
 const winnerIds=await Promise.all([document(idema),document(idemb)]);
 assert.equal(winnerIds.filter(x=>x.status===200).length,1);
 const now=await document(stock);
 const retry=await commit([update(stock,{...initial,onHand:'4'},now.body.updateTime),create(marker,consumed)]);
 assert.notEqual(retry.status,200);
 assert.equal((await document(stock)).body.fields.onHand.stringValue,'2');
});
