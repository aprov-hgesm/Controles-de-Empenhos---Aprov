#!/usr/bin/env node
// Generate an ADVERSARIAL companion suite from the exact original W6 fixture.
// The canonical nine F06 tests are not edited or replaced.
import { readFileSync, writeFileSync } from 'node:fs';
const original = readFileSync('scripts/warehouse-f06-transaction-emulator.test.mjs','utf8');
const marker = "  const final = await snapshot('materials', fixtureId(1));";
const extraHelpers = "\nconst {fork}=require('node:child_process');\nasync function registerSectorUser(email){\n  const base='http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/';\n  const api='?key=fake-api-key';\n  const signup=await fetch(base+'accounts:signUp'+api,{\n    method:'POST',headers:{'content-type':'application/json'},\n    body:JSON.stringify({email,password:'F06-Sector-Testing-123!',returnSecureToken:true})\n  });\n  const data=await signup.json();\n  if(!signup.ok)throw new Error('AUTH_EMULATOR_SIGNUP_FAILED '+JSON.stringify(data));\n  const claims={emprovexWarehouse:true,emprovexWarehouseVersion:'v1',emprovexRole:'sector',\n    emprovexWorkspaceId:WORKSPACE_ID,emprovexUg:UG};\n  const patch=await fetch(base+'accounts:update'+api,{\n    method:'POST',headers:{'content-type':'application/json'},\n    body:JSON.stringify({localId:data.localId,emailVerified:true,customAttributes:JSON.stringify(claims)})\n  });\n  const updated=await patch.json();\n  if(!patch.ok)throw new Error('AUTH_EMULATOR_CLAIMS_FAILED '+JSON.stringify(updated));\n  return data.localId;\n}\n\nfunction launchActor(f,key,subject,amount,mode='normal'){\n  const cp=fork(resolve(ROOT,'scripts/warehouse-f06-final-review-worker.mjs'),\n    [f.materialId,key,subject,String(amount),mode],{\n      stdio:['ignore','pipe','pipe','ipc'],env:{...process.env}\n    });\n  let stderr='';\n  cp.stderr.on('data',b=>{stderr+=b.toString();});\n  const seen=[],waiters=[];\n  cp.on('message',m=>{\n    const index=waiters.findIndex(x=>x.type===m.type);\n    if(index>=0){waiters.splice(index,1)[0].resolve(m);}\n    else seen.push(m);\n  });\n  cp.on('exit',(code)=>{\n    for(const w of waiters.splice(0))w.reject(new Error('worker exited '+code+' '+stderr.slice(-600)));\n  });\n  return{\n    send:msg=>cp.send(msg),\n    wait:type=>new Promise((resolve,reject)=>{\n      const i=seen.findIndex(x=>x.type===type);\n      if(i>=0) return resolve(seen.splice(i,1)[0]);\n      waiters.push({type,resolve,reject});\n      setTimeout(()=>reject(new Error('timeout '+type+' '+stderr.slice(-600))),12000).unref();\n    }),\n    stop:()=>cp.kill(),\n  };\n}\n";
if (original.split(marker).length !== 2
    || !original.includes("await t.test('same-key concurrent calls commit once'")
    || !original.includes("await t.test('different-key concurrency cannot overdraw")) {
  throw new Error('COMPOSITION_SAFETY_W6_FIXTURE_ANCHOR_MISMATCH');
}
const extra = `
  await t.test('revoked session cannot transfer even if previously authorized', async () => {
    const f = await fixture(11, 3);
    await signOut(auth);
    await assert.rejects(
      () => transferWarehouseStock(WORKSPACE_ID, input(f,'revoked',1)),
      /WAREHOUSE_LOCATION_AUTH_REQUIRED/
    );
    await signInWithCredential(auth, GoogleAuthProvider.credential(
      JSON.stringify({ sub: 'f06-founder-emulator', email: OWNER_EMAIL, email_verified: true })
    ));
    await assertState(f, 3, 0, 0);
  });

  await t.test('reading a material does not authorize malformed movement writes', async () => {
    const f = await fixture(12, 3);
    const { getDocFromServer, setDoc } = require('firebase/firestore');
    const material = await getDocFromServer(doc(warehouseDb, pathFor('materials', f.materialId)));
    assert.equal(material.exists(), true);
    const badMovementId = 'mov_' + 'f'.repeat(64);
    await assert.rejects(
      () => setDoc(doc(warehouseDb, pathFor('movements', badMovementId)),
        { schemaVersion:'warehouse_movement_v1', id:badMovementId,
          workspaceId:WORKSPACE_ID, ug:UG, materialId:f.materialId,
          type:'TRANSFER', quantityDelta:0 }),
      error => error?.code === 'permission-denied'
    );
    await assertState(f, 3, 0, 0);
  });

  await t.test('offline server proof fails closed instead of using cache', async () => {
    const f = await fixture(13, 4);
    const { disableNetwork, enableNetwork, getDocFromServer } = require('firebase/firestore');
    await disableNetwork(warehouseDb);
    try {
      await assert.rejects(
        () => getDocFromServer(doc(warehouseDb, pathFor('materials', f.materialId))),
        error => error?.code === 'unavailable'
      );
    } finally {
      await enableNetwork(warehouseDb);
    }
    await assertState(f, 4, 0, 0);
  });

  await t.test('three different-key concurrent transfers conserve quantity without partial commit', async () => {
    const f = await fixture(14, 10);
    const attempts = await Promise.allSettled(['triple-A','triple-B','triple-C']
      .map(key => transferWarehouseStock(WORKSPACE_ID, input(f, key, 7))));
    const applied = attempts.filter(x => x.status === 'fulfilled' && x.value.applied === true);
    assert.equal(applied.length, 1, JSON.stringify(attempts));
    const losers = attempts.filter(x => x.status === 'rejected');
    assert.equal(losers.length, 2, JSON.stringify(attempts));
    for (const result of losers) {
      // No unrelated PERMISSION_DENIED may be normalized as insufficient.
      assert.match(String(result.reason), /WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK/);
    }
    await assertState(f, 3, 7, 1);
  });

  await t.test('two independent authenticated UIDs contend with distinct keys', async () => {
    const f=await fixture(15,10);
    const [emailA,emailB]=['f06-operator-a@example.test','f06-operator-b@example.test'];
    await Promise.all([registerSectorUser(emailA),registerSectorUser(emailB)]);
    const a=launchActor(f,'actor-A',emailA,7,'sector');
    const b=launchActor(f,'actor-B',emailB,7,'sector');
    try {
      const [ar,br]=await Promise.all([a.wait('ready'),b.wait('ready')]);
      assert.notEqual(ar.uid,br.uid,'clients must have distinct authorized UIDs');
      a.send({type:'go'});b.send({type:'go'});
      const results=await Promise.all([a.wait('result'),b.wait('result')]);
      assert.equal(results.filter(x=>x.status==='fulfilled' && x.applied).length,1,JSON.stringify(results));
      assert.equal(results.filter(x=>x.status==='rejected').length,1,JSON.stringify(results));
      assert.match(results.find(x=>x.status==='rejected').error,/WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK/);
      const movements=await allMovements(f.materialId);
      assert.equal(movements.length,1);
      const winner=results.find(x=>x.status==='fulfilled');
      assert.equal(movements[0].data().source.actorUid,winner.uid);
      await assertState(f,3,7,1);
    } finally{a.stop();b.stop();}
  });
  await t.test('revocation after preflight before commit is not a replay',async()=>{
    const f=await fixture(16,4);
    const a=launchActor(f,'revoked-inflight','f06-revoked',2,'pause-prewrite');
    try{
      await a.wait('ready');a.send({type:'go'});
      await a.wait('prewrite-pause');
      a.send({type:'resume',revokeAuth:true});
      const result=await a.wait('result');
      assert.equal(result.status,'rejected',JSON.stringify(result));
      assert.equal(result.applied,undefined);
      await assertState(f,4,0,0);
    }finally{a.stop();}
  });
  await t.test('valid request loses write permission after preflight',async()=>{
    const f=await fixture(17,4);
    const a=launchActor(f,'write-revoked','f06-write-revoked',2,'pause-prewrite');
    try{
      await a.wait('ready');a.send({type:'go'});
      await a.wait('prewrite-pause');
      await seed(pathFor('locations',locationB),{
        schemaVersion:'warehouse_location_v1',id:locationB,workspaceId:WORKSPACE_ID,ug:UG,
        depotId,kind:'LOCAL',parentLocationId:null,code:'LOC-F06-B',name:'Destino F06',
        description:null,status:'inactive',createdBy:'f06-seed',updatedBy:'f06-seed'
      });
      a.send({type:'resume'});
      const result=await a.wait('result');
      assert.equal(result.status,'rejected',JSON.stringify(result));
      assert.doesNotMatch(String(result.error),/WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK/);
      await assertState(f,4,0,0);
    }finally{
      a.stop();
      await seed(pathFor('locations',locationB),{
        schemaVersion:'warehouse_location_v1',id:locationB,workspaceId:WORKSPACE_ID,ug:UG,
        depotId,kind:'LOCAL',parentLocationId:null,code:'LOC-F06-B',name:'Destino F06',
        description:null,status:'active',createdBy:'f06-seed',updatedBy:'f06-seed'
      });
    }
  });

  await t.test('third concurrent movement during reconciler read window is fail-closed',async()=>{
    const f=await fixture(18,10);
    const loser=launchActor(f,'interleaved-denied','f06-interleaved',7,'force-budget-third');
    try{
      await loser.wait('ready'); loser.send({type:'go'});
      await loser.wait('proof-half');
      // The production code is running a read-only Firestore transaction;
      // inject two valid other operations during its read window. The budget
      // error itself is injected by the TEST LOADER only, not production.
      let started=0,finishedBeforeResume=0;
      const writes=(async()=>{
        started++;
        const first=await transferWarehouseStock(WORKSPACE_ID,input(f,'interleaved-winner',7));
        assert.equal(first.applied,true);
        started++;
        const third=await transferWarehouseStock(WORKSPACE_ID,input(f,'interleaved-third',1));
        assert.equal(third.applied,true);
        return [first,third];
      })();
      await new Promise(r=>setTimeout(r,120));
      finishedBeforeResume=(await Promise.race([writes.then(()=>1),new Promise(r=>setTimeout(()=>r(0),10))]));
      loser.send({type:'resume'});
      const [reconciled,committed]=await Promise.all([loser.wait('result'),writes]);
      assert.equal(reconciled.status,'rejected',JSON.stringify(reconciled));
      assert.equal(committed.length,2);
      await assertState(f,2,8,2);
      console.log('F06_THIRD_WRITER_WINDOW: transactionsStarted='+started+' commitsBeforeResume='+finishedBeforeResume);
    }finally{loser.stop();}
  });

`;
writeFileSync('scripts/warehouse-f06-composition-security.test.mjs',original.replace(marker,extra+marker).replace('test.after(async () => {',extraHelpers+'test.after(async () => {'));
console.log('COMPOSITION_SAFETY_ORIGINAL_9_ASSERTIONS_UNMODIFIED; +8 adversarial tests generated');
