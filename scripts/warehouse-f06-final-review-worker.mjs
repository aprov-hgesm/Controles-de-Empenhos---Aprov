#!/usr/bin/env node
// Emulator-only process: independent Firebase Auth session + Firestore client.
// Each process has a different verified UID with the same founder permission.
// The canary hooks are inserted only by this loader, never committed to the engine.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const [materialId, key, subject, amount, mode = 'normal'] = process.argv.slice(2);
const ROOT = resolve(import.meta.dirname, '..');
const workspaceId = 'hgesm-aprov', ug = '160416';
const depotId = 'dep_'+'a'.repeat(32), locA='loc_'+'b'.repeat(32),locB='loc_'+'c'.repeat(32);
const from={kind:'LOCATION',depotId,locationId:locA,subpositionId:null};
const to={kind:'LOCATION',depotId,locationId:locB,subpositionId:null};
require.extensions['.ts']=(module,filename)=>{
  let code=readFileSync(filename,'utf8');
  if(filename.endsWith('/lib/warehouse/locationRepository.ts') && mode !== 'normal'){
    let target,inject;
    if(mode === 'pause-proof') {
      target='const classified = await runTransaction(db, async (proof) => {';
      inject=`process.send?.({type:'proof-pause'});
          await new Promise(resolve => {
            const listener = msg => { if(msg?.type === 'resume'){process.off('message',listener);resolve();} };
            process.on('message',listener);
          });
          `+target;
    } else if(mode === 'pause-prewrite') {
      target='  try {\n    return await runTransaction(db, async (transaction) => {\n      const materialRef = doc(db, materialPath);';
      inject=`  process.send?.({type:'prewrite-pause'});
  await new Promise(resolve => {
    const listener = async msg => {
      if(msg?.type !== 'resume')return;
      process.off('message',listener);
      if(msg.revokeAuth) await require('firebase/auth').signOut(auth);
      resolve();
    };
    process.on('message',listener);
  });
`+target;
    }else throw new Error('UNKNOWN_CANARY_MODE');
    if(code.split(target).length !== 2)throw new Error('CANARY_INJECTION_NOT_UNIQUE '+mode);
    code=code.replace(target,inject);
  }
  const output=ts.transpileModule(code,{fileName:filename,compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true
  }}).outputText;
  module._compile(output,filename);
};
const {auth}=require(resolve(ROOT,'lib/firebase.ts'));
const {transferWarehouseStock}=require(resolve(ROOT,'lib/warehouse/locationRepository.ts'));
const {GoogleAuthProvider,signInWithCredential}=require('firebase/auth');
const {deleteApp,getApp}=require('firebase/app');
await signInWithCredential(auth,GoogleAuthProvider.credential(JSON.stringify({
  sub:subject,email:'aprov1hgesm@gmail.com',email_verified:true
})));
process.send({type:'ready',uid:auth.currentUser.uid,subject,ug});
process.on('message',async m=>{
  if(m?.type!=='go')return;
  try{
    const result=await transferWarehouseStock(workspaceId,{
      materialId,idempotencyKey:'F06:'+key,from,to,quantity:Number(amount),note:'F06 emulator'
    });
    process.send({type:'result',status:'fulfilled',applied:result.applied,uid:subject,movementId:result.movement?.id});
  }catch(e){
    process.send({type:'result',status:'rejected',code:e?.code||null,error:String(e),uid:subject});
  }finally{
    await deleteApp(getApp());
    process.exit(0);
  }
});
