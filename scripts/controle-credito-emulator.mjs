import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Synthetic REST transport only: executes the actual adapter/store, without IAM,
// production credentials, external requests, or claiming an emulator/GCP test.
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const moduleUrl = source => 'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText).toString('base64');
const balanceUrl=moduleUrl(read('lib/controle-credito/creditBalance.ts'));
const firestoreUrl=moduleUrl(read('lib/server/creditControlFirestore.ts')
  .replace("import firebaseConfig from '../../firebase-applet-config.json';","const firebaseConfig={projectId:'demo-credit-r1'};")
  .replace("import { getGoogleAccessToken } from './sectorProvisioningAdmin';","const getGoogleAccessToken=async()=> 'owner';"));
const store=await import(moduleUrl(read('lib/server/creditControlStore.ts')
  .replace("'./creditControlFirestore'",JSON.stringify(firestoreUrl))
  .replace("'../controle-credito/creditBalance'",JSON.stringify(balanceUrl))));
const {encodeFields}=await import(firestoreUrl);
const prefix='projects/demo-credit-r1/databases/emprovex-credito/documents';
const root='https://firestore.googleapis.com/v1/'+prefix;
const manager={uid:'test-manager',email:'manager@example.invalid',ug:'999999',role:'gestor',centerId:null};
const centerA={uid:'test-center-a',email:'a@example.invalid',ug:'999999',role:'centro',centerId:'A'};
const other={...manager,uid:'other-manager',ug:'999998'};
const base='creditUnits/'+manager.ug+'/';
const cell={ug:manager.ug,item:'1',num:'1',esfera:'1',ptres:'123456',fonte:'1234567890',nd:'339030',ugr:'999999',pi:'TESTE',cents:10000};
const allocation=[{centerId:'A',basisPoints:6000},{centerId:'B',basisPoints:4000}];
const ncInput=(number='2026NC000001')=>({source:'manual',draft:{number,issuingUg:'888888',beneficiaryUg:manager.ug,
  issueDate:'2026-01-02',description:'Synthetic NC',totalCents:10000,sequences:[{sequence:'1',totalCents:10000,origin:[],destination:[cell]}]},allocations:allocation});
const neInput=(creditId,number,centerId,netCents,expectedCreditRevision)=>({creditId,centerId,cellId:'s1_l1',expectedCreditRevision,
  draft:{ug:manager.ug,number,issueDate:'2026-01-03',description:'Synthetic NE',supplier:'Synthetic supplier',supplierCnpj:'00000000000000',
    netCents,nd:cell.nd,ptres:cell.ptres,fonte:cell.fonte,ugr:cell.ugr,pi:cell.pi}});
const status=n=>e=>e.status===n;

import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, getDoc, setDoc, doc, terminate } from 'firebase/firestore';
assert.match(process.env.FIRESTORE_EMULATOR_HOST||'',/^(127\.0\.0\.1|localhost):8080$/);
assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST||'',/^(127\.0\.0\.1|localhost):9099$/);
const local='http://127.0.0.1:8080/v1/'+prefix;
const originalFetch=globalThis.fetch;
async function seed(path,data){
  const res=await originalFetch(local+'/'+path,{method:'PATCH',headers:{authorization:'Bearer owner','content-type':'application/json'},body:JSON.stringify({fields:encodeFields(data)})});
  assert.ok(res.ok,await res.text());
}
test('named Firestore emulator: real transactions and direct client denial',async t=>{
  const app=initializeApp({projectId:'demo-credit-r1',apiKey:'fake-api-key',authDomain:'demo-credit-r1.firebaseapp.com'},'credit-r1-emulator');
  const auth=getAuth(app), firestore=getFirestore(app,'emprovex-credito');
  connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
  connectFirestoreEmulator(firestore,'127.0.0.1',8080);
  t.after(async()=>{globalThis.fetch=originalFetch;await terminate(firestore);await deleteApp(app);});
  const session=await signInWithCredential(auth,GoogleAuthProvider.credential(JSON.stringify({sub:'credit-r1-test',email:'manager@example.invalid',email_verified:true})));
  const actor={...manager,uid:session.user.uid};
  await seed('creditControlMembers/'+actor.uid,{...actor,active:true});
  await seed(base+'centers/A',{id:'A',name:'Centro A',active:true});
  await seed(base+'centers/B',{id:'B',name:'Centro B',active:true});
  const direct=doc(firestore,'creditControlMembers',actor.uid);
  const denied=e=>e.code==='permission-denied';
  await assert.rejects(getDoc(direct),denied);
  await assert.rejects(setDoc(direct,{active:true}),denied);
  globalThis.fetch=(url,init)=>{
    assert.equal(typeof url,'string');assert.ok(url.startsWith(root),'No external network in credit test');
    assert.equal(init.headers.authorization,'Bearer owner');
    return originalFetch(local+url.slice(root.length),init);
  };
  const nc=await store.createCredit(actor,ncInput());
  const id=nc.credit.id;
  const a=await store.createCommitment(actor,neInput(id,'2026NE000001','A',3000,1));
  assert.equal(a.balance.availableCents,7000);
  await assert.rejects(store.createCommitment(actor,neInput(id,'2026NE000002','B',1000,1)),status(409));
  await assert.rejects(store.getCredit(other,id),status(404));
  const report=await store.listFinance(actor,{year:'2026',limit:1},true);
  assert.equal(report.totals.creditCents,10000);
  assert.equal(report.totals.committedCents,3000);
  assert.equal(report.totals.availableCents,7000);
  assert.equal((await store.getCredit(centerA,id)).balance.creditCents,6000);
  await seed('creditControlMembers/'+actor.uid,{...actor,active:false});
  await assert.rejects(store.createCredit(actor,ncInput('2026NC000002')),status(403));
});
