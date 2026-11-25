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
  .replace("import { getGoogleAccessToken } from './sectorProvisioningAdmin';","const getGoogleAccessToken=async()=> 'synthetic-test-token';"));
const store=await import(moduleUrl(read('lib/server/creditControlStore.ts')
  .replace("'../controle-credito/documentUgs.mjs'",JSON.stringify(new URL('../lib/controle-credito/documentUgs.mjs',import.meta.url).href))
  .replace("'./creditControlFirestore'",JSON.stringify(firestoreUrl))
  .replace("'../controle-credito/creditBalance'",JSON.stringify(balanceUrl))));
const {encodeFields}=await import(firestoreUrl);
const prefix='projects/demo-credit-r1/databases/emprovex-credito/documents';
const root='https://firestore.googleapis.com/v1/'+prefix;
const manager={uid:'test-manager',email:'manager@example.invalid',ug:'999999',role:'gestor',centerId:null};
const centerA={uid:'test-center-a',email:'a@example.invalid',ug:'999999',role:'centro',centerId:'A'};
const other={...manager,uid:'other-manager',ug:'999998'};
const base='creditUnits/'+manager.ug+'/';
function transport(){
  const docs=new Map(), snapshots=new Map(), calls=[];
  let version=0, sequence=0, abortOnce=false;
  const seed=(path,data)=>docs.set(prefix+'/'+path,{name:prefix+'/'+path,fields:encodeFields(data),updateTime:'v'+(++version)});
  seed('creditControlMembers/'+manager.uid,{...manager,active:true});
  seed(base+'centers/A',{id:'A',name:'Centro A',active:true});
  seed(base+'centers/B',{id:'B',name:'Centro B',active:true});
  const fetch=async(url,init)=>{
    assert.equal(typeof url,'string');
    assert.ok(url.startsWith(root),'external requests are forbidden');
    assert.equal(init.method,'POST');
    assert.equal(init.headers.authorization,'Bearer synthetic-test-token');
    const op=url.slice(root.length), body=JSON.parse(init.body);
    calls.push({op,body});
    if(op===':beginTransaction'){
      const id='tx'+(++sequence);
      snapshots.set(id,{docs:structuredClone(docs),readOnly:!!body.options.readOnly});
      return Response.json({transaction:id});
    }
    const snapshot=snapshots.get(body.transaction);
    assert.ok(snapshot,'all data access must use a transaction');
    if(op===':rollback'){snapshots.delete(body.transaction);return Response.json({});}
    if(op===':batchGet'){
      return Response.json(body.documents.map(name=>snapshot.docs.has(name)?{found:snapshot.docs.get(name)}:{missing:name}));
    }
    if(op.endsWith(':runQuery')){
      const parent=op.slice(1,-':runQuery'.length), q=body.structuredQuery;
      assert.match(parent,/^creditUnits\/\d{6}$/);
      const collection=prefix+'/'+parent+'/'+q.from[0].collectionId+'/';
      const filter=q.where?.fieldFilter, after=q.startAt?.values[0].referenceValue??'';
      const found=[...snapshot.docs.values()].filter(d=>d.name.startsWith(collection)&&d.name>after&&
        (!filter||d.fields[filter.field.fieldPath]?.stringValue===filter.value.stringValue))
        .sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0).slice(0,q.limit);
      return Response.json(found.map(document=>({document})));
    }
    if(op===':commit'){
      assert.equal(snapshot.readOnly,false);
      if(abortOnce){abortOnce=false;return Response.json({error:{status:'ABORTED'}},{status:409});}
      for(const w of body.writes){
        const existing=docs.get(w.update.name);
        if(w.currentDocument.exists===false)assert.equal(existing,undefined);
        else assert.equal(existing?.updateTime,w.currentDocument.updateTime);
      }
      for(const w of body.writes)docs.set(w.update.name,{...w.update,updateTime:'v'+(++version)});
      snapshots.delete(body.transaction);
      return Response.json({});
    }
    throw new Error('unexpected REST operation '+op);
  };
  return {fetch,seed,calls,abortNextCommit:()=>{abortOnce=true;}};
}
const cell={ug:manager.ug,item:'1',num:'1',esfera:'1',ptres:'123456',fonte:'1234567890',nd:'339030',ugr:'999999',pi:'TESTE',cents:10000};
const allocation=[{centerId:'A',basisPoints:6000},{centerId:'B',basisPoints:4000}];
const ncInput=(number='2026NC000001')=>({source:'manual',draft:{number,issuingUg:'888888',beneficiaryUg:manager.ug,
  issueDate:'2026-01-02',description:'Synthetic NC',totalCents:10000,sequences:[{sequence:'1',totalCents:10000,origin:[],destination:[cell]}]},allocations:allocation});
const neInput=(creditId,number,centerId,netCents,expectedCreditRevision)=>({creditId,centerId,cellId:'s1_l1',expectedCreditRevision,
  draft:{ug:manager.ug,number,issueDate:'2026-01-03',description:'Synthetic NE',supplier:'Synthetic supplier',supplierCnpj:'00000000000000',
    netCents,nd:cell.nd,ptres:cell.ptres,fonte:cell.fonte,ugr:cell.ugr,pi:cell.pi}});
const status=n=>e=>e.status===n;
test('store + REST adapter: identity, money, idempotency, revisions, deficits, retry and isolation',async t=>{
  const db=transport(), originalFetch=globalThis.fetch;
  globalThis.fetch=db.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  const nc=await store.createCredit(manager,ncInput()), id=nc.credit.id;
  assert.equal(nc.balance.availableCents,10000);
  assert.equal((await store.createCredit(manager,ncInput())).credit.id,id);
  await assert.rejects(store.createCredit(centerA,ncInput()),status(403));
  await assert.rejects(store.getCredit(other,id),status(404));
  const first=neInput(id,'2026NE000001','A',3000,1);
  db.abortNextCommit();
  const a=await store.createCommitment(manager,first);
  assert.equal(a.balance.availableCents,7000);
  assert.equal((await store.createCommitment(manager,first)).balance.committedCents,3000);
  await assert.rejects(store.createCommitment(manager,neInput(id,'2026NE000002','B',4000,1)),status(409));
  await assert.rejects(store.createCommitment(manager,neInput(id,'2026NE000002','B',5000,2)),status(409));
  const b=await store.createCommitment(manager,neInput(id,'2026NE000002','B',4000,2));
  assert.equal(b.balance.availableCents,3000);
  await assert.rejects(store.getCommitment(centerA,b.commitment.id),status(404));
  const restricted=await store.getCredit(centerA,id);
  assert.equal(restricted.balance.creditCents,6000);
  assert.equal(restricted.balance.committedCents,3000);
  assert.deepEqual(restricted.cells,[]);
  assert.deepEqual(restricted.credit.sequences,[]);
  assert.equal(restricted.credit.documentTotalCents,null);
  assert.deepEqual(restricted.balance.centers.map(c=>c.centerId),['A']);
  const patch={id,expectedRevision:3,allocations:[{centerId:'A',basisPoints:2000},{centerId:'B',basisPoints:8000}]};
  await assert.rejects(store.updateCredit(manager,patch),status(409));
  const edited=await store.updateCredit(manager,{...patch,acknowledgeDeficit:true});
  assert.equal(edited.balance.centers.find(c=>c.centerId==='A').availableCents,-1000);
  const mov={entityType:'ne',entityId:b.commitment.id,kind:'anulacao',amountCents:1000,reference:'SYNTHETIC-001',reason:'Synthetic adjustment',expectedRevision:1};
  const moved=await store.registerMovement(manager,mov);
  assert.equal(moved.balance.committedCents,6000);
  assert.equal(moved.balance.availableCents,4000);
  assert.equal((await store.registerMovement(manager,mov)).balance.committedCents,6000);
  const reinforcement={entityType:'nc',entityId:id,kind:'reforco',amountCents:1000,reference:'SYNTHETIC-002',reason:'Synthetic reinforcement',expectedRevision:5};
  const reinforced=await store.registerMovement(manager,reinforcement);
  assert.equal(reinforced.balance.creditCents,11000);
  assert.equal(reinforced.balance.availableCents,5000);
  const recollection={...reinforcement,kind:'recolhimento',reference:'SYNTHETIC-003',expectedRevision:6};
  await assert.rejects(store.registerMovement(manager,recollection),status(409));
  const restored=await store.registerMovement(manager,{...recollection,acknowledgeDeficit:true});
  assert.equal(restored.balance.creditCents,10000);
  assert.equal(restored.balance.availableCents,4000);
  await store.createCredit(manager,ncInput('2026NC000002'));
  const callsBefore=db.calls.length;
  const report=await store.listFinance(manager,{year:'2026',limit:1},true);
  const queries=db.calls.slice(callsBefore).filter(c=>c.op.endsWith(':runQuery'));
  assert.equal(report.credits.length,2);
  assert.equal(report.commitments.length,2);
  assert.equal(report.totals.creditCents,20000);
  assert.equal(report.totals.committedCents,6000);
  assert.equal(report.totals.availableCents,14000);
  assert.equal(report.nextCursor,undefined);
  assert.equal(queries.filter(c=>c.body.structuredQuery.from[0].collectionId==='credits').length,1);
  assert.equal(new Set(queries.map(c=>c.body.transaction)).size,1);
  const p1=await store.listFinance(manager,{year:'2026',limit:1});
  assert.ok(p1.nextCursor);
  assert.equal(p1.credits.length,1);
  assert.equal(p1.commitments.length,1);
  const p2=await store.listFinance(manager,{year:'2026',limit:1,cursor:p1.nextCursor});
  assert.notEqual(p1.credits[0].id,p2.credits[0].id);
  assert.notEqual(p1.commitments[0].id,p2.commitments[0].id);
  await assert.rejects(store.listFinance(centerA,{year:'2026',limit:1,cursor:p1.nextCursor}),status(422));
  const centerReport=await store.listFinance(centerA,{year:'2026',limit:1},true);
  assert.equal(centerReport.totals.creditCents,8000);
  assert.equal(centerReport.totals.committedCents,3000);
  assert.deepEqual(centerReport.commitments.map(n=>n.centerId),['A']);
  db.seed('creditControlMembers/'+manager.uid,{...manager,active:false});
  await assert.rejects(store.createCredit(manager,ncInput('2026NC000003')),status(403));
});

test('R1.2: budget differences require acknowledgement; replacement returns exact balance without duplicate movements; scoped order and reports',async()=>{
  const db=transport(),previousFetch=globalThis.fetch;globalThis.fetch=db.fetch;
  try{
    const first=await store.createCredit(manager,{...ncInput(),deadline:'2026-12-01'});
    const second=await store.createCredit(manager,{...ncInput('2026NC000002'),deadline:'2026-02-01',draft:{...ncInput('2026NC000002').draft,issueDate:'2026-01-05'}});
    const third=await store.createCredit(manager,ncInput('2026NC000003'));
    const list1=await store.listFinance(manager,{year:'2026',limit:1,sort:'deadline'});
    assert.equal(list1.credits[0].id,second.credit.id);
    const list2=await store.listFinance(manager,{year:'2026',limit:1,sort:'deadline',cursor:list1.nextCursor});
    assert.equal(list2.credits[0].id,first.credit.id);
    const list3=await store.listFinance(manager,{year:'2026',limit:1,sort:'deadline',cursor:list2.nextCursor});
    assert.equal(list3.credits[0].id,third.credit.id);
    await assert.rejects(store.listFinance(manager,{year:'2026',limit:1,sort:'issue',cursor:list1.nextCursor}),status(422));
    assert.equal((await store.listFinance(manager,{year:'2026',sort:'issue'})).credits[0].id,second.credit.id);
    const input=neInput(first.credit.id,'2026NE000011','A',5000,1);
    input.draft.nd='339039';input.draft.pi='DIFERENTE';
    await assert.rejects(store.createCommitment(manager,input),e=>e.status===409&&e.message.includes('339039')&&e.message.includes('339030'));
    const saved=await store.createCommitment(manager,{...input,acknowledgeBudgetDifference:true});
    assert.equal(saved.balance.availableCents,5000);
    assert.equal(saved.commitment.budgetDifferences.length,2);
    assert.equal(saved.commitment.budgetDifferences[0].commitment,'339039');
    const replacement={id:saved.commitment.id,number:saved.commitment.number,issueDate:saved.commitment.issueDate,supplierCnpj:saved.commitment.supplierCnpj,netCents:3000,expectedRevision:1,confirmed:true,documentHash:'a'.repeat(64)};
    await assert.rejects(store.replaceCommitmentPdf(centerA,replacement),status(403));
    await assert.rejects(store.replaceCommitmentPdf(manager,{...replacement,number:'2026NE000012'}),status(422));
    await assert.rejects(store.replaceCommitmentPdf(manager,{...replacement,netCents:6000}),status(422));
    const adjusted=await store.replaceCommitmentPdf(manager,replacement);
    assert.equal(adjusted.commitment.netCents,3000);
    assert.equal(adjusted.balance.availableCents,7000);
    assert.equal(adjusted.balance.centers.find(x=>x.centerId==='A').availableCents,3000);
    assert.equal((await store.replaceCommitmentPdf(manager,replacement)).commitment.revision,2);
    await assert.rejects(store.replaceCommitmentPdf(manager,{...replacement,documentHash:'b'.repeat(64),netCents:1000}),status(409));
    const report=await store.listFinance(manager,{year:'2026',center:'A',sort:'deadline'},true);
    assert.equal(report.commitments.length,1);
    assert.equal(report.commitments[0].netCents,3000);
    assert.equal((await store.listFinance(manager,{year:'2026',center:'B'})).commitments.length,0);
    await assert.rejects(store.listFinance(centerA,{year:'2026',center:'B'}),status(403));
  }finally{globalThis.fetch=previousFetch;}
});

test('R1.3: manager-only deletion returns credit, checks cascade count and revision, hides records and allows safe re-registration',async()=>{
  const db=transport(),previousFetch=globalThis.fetch;globalThis.fetch=db.fetch;
  try{
    const nc=await store.createCredit(manager,ncInput('2026NC000071'));
    const input=neInput(nc.credit.id,'2026NE000071','A',3000,1);
    const saved=await store.createCommitment(manager,input);
    const second=await store.createCommitment(manager,neInput(nc.credit.id,'2026NE000072','B',2000,2));
    const target={id:saved.commitment.id,expectedRevision:1,confirmed:true};
    await assert.rejects(store.deleteCommitment(centerA,target),status(403));
    await assert.rejects(store.deleteCommitment(manager,{...target,confirmed:false}),status(422));
    await assert.rejects(store.deleteCommitment(manager,{...target,expectedRevision:2}),status(409));
    const removed=await store.deleteCommitment(manager,target);assert.equal(removed.returnedCents,3000);
    assert.equal((await store.getCredit(manager,nc.credit.id)).balance.availableCents,8000);
    await assert.rejects(store.getCommitment(manager,target.id),status(404));
    await assert.rejects(store.getCommitment(centerA,target.id),status(404));
    const report=await store.listFinance(manager,{year:'2026'},true);
    assert.deepEqual(report.commitments.map(n=>n.id),[second.commitment.id]);
    assert.equal(report.totals.committedCents,2000);
    const recreate=await store.createCommitment(manager,{...input,expectedCreditRevision:4});
    assert.equal(recreate.commitment.revision,3);assert.equal(recreate.commitment.generation,'r3');
    assert.equal(recreate.balance.committedCents,5000);
    await assert.rejects(store.deleteCommitment(manager,target),status(409));
    const cascade={id:nc.credit.id,expectedRevision:5,expectedCommitmentCount:2,confirmed:true};
    await assert.rejects(store.deleteCredit(centerA,cascade),status(403));
    await assert.rejects(store.deleteCredit(manager,{...cascade,expectedCommitmentCount:1}),status(409));
    await assert.rejects(store.deleteCredit(manager,{...cascade,expectedRevision:4}),status(409));
    await assert.rejects(store.deleteCredit(manager,{...cascade,confirmed:false}),status(422));
    const result=await store.deleteCredit(manager,cascade);assert.equal(result.deletedCommitments,2);
    await assert.rejects(store.getCredit(manager,nc.credit.id),status(404));
    await assert.rejects(store.getCommitment(manager,second.commitment.id),status(404));
    const empty=await store.listFinance(manager,{year:'2026'},true);
    assert.equal(empty.totals.creditCents,0);assert.equal(empty.totals.committedCents,0);assert.equal(empty.totals.commitmentCount,0);
    assert.deepEqual(empty.credits,[]);assert.deepEqual(empty.commitments,[]);
    const newNc=await store.createCredit(manager,ncInput('2026NC000071'));
    assert.equal(newNc.credit.revision,7);assert.equal(newNc.credit.generation,'r7');assert.equal(newNc.balance.availableCents,10000);
    const newNe=await store.createCommitment(manager,{...input,expectedCreditRevision:7});
    assert.equal(newNe.commitment.revision,5);assert.equal(newNe.commitment.generation,'r5');
    assert.equal(newNe.balance.availableCents,7000);
  }finally{globalThis.fetch=previousFetch;}
});

test('R1.5: independent list queries and whole-year catalogue keep scoped cursors and avoid unrelated collection reads',async()=>{
  const db=transport(),old=globalThis.fetch;globalThis.fetch=db.fetch;
  try{
    const a=await store.createCredit(manager,ncInput('2026NC000081'));
    await store.createCredit(manager,ncInput('2026NC000082'));
    const neA=await store.createCommitment(manager,neInput(a.credit.id,'2026NE000081','A',1000,1));
    const neB=await store.createCommitment(manager,neInput(a.credit.id,'2026NE000082','B',1000,2));
    db.calls.length=0;
    const first=await store.listFinanceCommitments(manager,{year:'2026',limit:1});
    assert.equal(first.commitments.length,1);assert.ok(first.nextCursor);
    assert.ok(!db.calls.some(x=>x.body.structuredQuery?.from[0].collectionId==='credits'));
    assert.equal(db.calls.filter(x=>x.op===':batchGet').length,1);
    const second=await store.listFinanceCommitments(manager,{year:'2026',limit:1,cursor:first.nextCursor});
    assert.equal(second.commitments.length,1);
    assert.notEqual(first.commitments[0].id,second.commitments[0].id);
    await assert.rejects(store.listFinanceCommitments(manager,{year:'2026',limit:1,center:'A',cursor:first.nextCursor}),status(422));
    const sector=await store.listFinanceCommitments(centerA,{year:'2026'});
    assert.deepEqual(sector.commitments.map(n=>n.id),[neA.commitment.id]);
    await assert.rejects(store.listFinanceCommitments(centerA,{year:'2026',center:'B'}),status(403));
    assert.deepEqual((await store.listFinanceCommitments(manager,{year:'2026',center:'B'})).commitments.map(n=>n.id),[neB.commitment.id]);
    db.calls.length=0;
    const ncPage=await store.listFinance(manager,{year:'2026',kind:'nc',limit:1});
    assert.equal(ncPage.credits.length,1);assert.equal(ncPage.commitments.length,0);assert.equal(ncPage.totals.creditCount,2);
    assert.ok(!db.calls.some(x=>x.body.structuredQuery?.from[0].collectionId==='commitments'));
    db.calls.length=0;
    const catalog=await store.listCreditChoices(manager,'2026');
    assert.equal(catalog.choices.length,2);
    assert.ok(catalog.choices.every(c=>!('cells' in c)&&!('allocations' in c)));
    assert.deepEqual(db.calls.filter(x=>x.body.structuredQuery).map(x=>x.body.structuredQuery.from[0].collectionId),['credits']);
    assert.equal((await store.listCreditChoices(other,'2026')).choices.length,0);
    assert.equal((await store.listCreditChoices(centerA,'2026')).choices.length,2);
  }finally{globalThis.fetch=old;}
});

test('HGeSM document UGs share only authorized tenant, keep independent NC identity and match NE UG',async t=>{
 const db=transport(), originalFetch=globalThis.fetch;globalThis.fetch=db.fetch;t.after(()=>{globalThis.fetch=originalFetch;});
 const h={...manager,uid:'hgesm-manager',ug:'160416'};
 db.seed('creditControlMembers/'+h.uid,{...h,active:true});
 db.seed('creditUnits/160416/centers/A',{id:'A',name:'Centro A',active:true});
 db.seed('creditUnits/160416/centers/B',{id:'B',name:'Centro B',active:true});
 const make=ug=>{const a=ncInput();return {...a,draft:{...a.draft,beneficiaryUg:ug,sequences:[{sequence:'1',totalCents:10000,origin:[],destination:[{...cell,ug}]}]}};};
 const first=await store.createCredit(h,make('160416'));
 const second=await store.createCredit(h,make('167416'));
 assert.equal(first.credit.id,'888888_2026NC000001');
 assert.equal(second.credit.id,'888888_2026NC000001_167416');
 assert.equal(second.credit.beneficiaryUg,'167416');
 assert.equal((await store.createCredit(h,make('167416'))).credit.id,second.credit.id);
 await assert.rejects(store.createCredit(h,make('167417')),status(403));
 await assert.rejects(store.getCredit({...h,ug:'167416'},second.credit.id),status(404));
 const n=neInput(second.credit.id,'2026NE000001','A',3000,1);
 await assert.rejects(store.createCommitment(h,{...n,draft:{...n.draft,ug:'160416'}}),status(422));
 const saved=await store.createCommitment(h,{...n,draft:{...n.draft,ug:'167416'}});
 assert.equal(saved.commitment.id,'167416_2026NE000001');assert.equal(saved.balance.availableCents,7000);
 assert.equal((await store.getCredit(h,first.credit.id)).balance.availableCents,10000);
});
