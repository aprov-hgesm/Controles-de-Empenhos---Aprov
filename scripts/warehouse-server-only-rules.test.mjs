#!/usr/bin/env node
/**
 * Warehouse Server R2 — verifica Rules candidatas no Auth/Firestore Emulator.
 * Sem dados reais: somente projeto demo, sem permitir gravações SDK cliente.
 */
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithCredential,
  signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, collection, getDoc,
  getDocs, setDoc, updateDoc, deleteDoc, writeBatch,
} from 'firebase/firestore';

const PROJECT='demo-emprovex-security',API='fake-api-key';
const AUTH='http://127.0.0.1:9099',FIRESTORE='http://127.0.0.1:8080';
const WS='workspace-rule-a',UG='160500',PASSWORD='Emprovex-Teste!2026';
const apps=[];
const materialId='mat_'+'a'.repeat(32);
const materialPath=(db,ws=WS)=>doc(db,'warehouse',ws,'materials',materialId);
function app(label) {
  const x=initializeApp({projectId:PROJECT,apiKey:API,authDomain:PROJECT+'.firebaseapp.com'},
    'r2-rules-'+label+'-'+Date.now()+'-'+Math.random().toString(36).slice(2));
  apps.push(x);const auth=getAuth(x);
  connectAuthEmulator(auth,AUTH,{disableWarnings:true});
  const db=getFirestore(x,'emprovex-warehouse');
  connectFirestoreEmulator(db,'127.0.0.1',8080);
  return {auth,db};
}
async function authApi(endpoint,body,admin=false){
  const response=await fetch(AUTH+'/identitytoolkit.googleapis.com/v1/'+endpoint+'?key='+API,{
    method:'POST',headers:{'Content-Type':'application/json',...(admin?{authorization:'Bearer owner'}:{})},
    body:JSON.stringify(body),
  });
  if(!response.ok)throw new Error('Auth Emulator: '+endpoint+' — '+await response.text());
  return response.json();
}
async function verifiedSector(email,claims){
  const created=await authApi('accounts:signUp',{email,password:PASSWORD,returnSecureToken:true});
  await authApi('accounts:sendOobCode',{requestType:'VERIFY_EMAIL',idToken:created.idToken});
  const oob=await (await fetch(AUTH+'/emulator/v1/projects/'+PROJECT+'/oobCodes')).json();
  const code=[...(oob.oobCodes||[])].reverse().find(x=>x.email===email&&x.requestType==='VERIFY_EMAIL');
  assert.ok(code?.oobLink,'Verification token ausente');
  assert.equal((await fetch(code.oobLink)).ok,true,'Verificação de email');
  if(claims)await authApi('projects/'+PROJECT+'/accounts:update',{
    localId:created.localId,customAttributes:JSON.stringify(claims)
  },true);
  const session=app(email);await signInWithEmailAndPassword(session.auth,email,PASSWORD);
  assert.equal(session.auth.currentUser.emailVerified,true);
  await session.auth.currentUser.getIdToken(true);
  return session;
}
async function founder(email,label){
  const session=app(label);
  const credential=GoogleAuthProvider.credential(JSON.stringify({
    sub:'google-'+label,email,email_verified:true
  }));
  await signInWithCredential(session.auth,credential);
  return session;
}
async function lifecycle(status,ug=UG){
  const response=await fetch(
    FIRESTORE+'/v1/projects/'+PROJECT+'/databases/emprovex-warehouse/documents/warehouseAccess/'+WS,
    {method:'PATCH',headers:{'Content-Type':'application/json',authorization:'Bearer owner'},
    body:JSON.stringify({fields:{
      schemaVersion:{stringValue:'warehouse_workspace_access_v1'},
      workspaceId:{stringValue:WS},ug:{stringValue:ug},status:{stringValue:status}
    }})}
  );
  if(!response.ok)throw new Error('Lifecycle seed: '+await response.text());
}
async function denied(label,fn){
  try {await fn();}catch(e){
    const code=String(e?.code||'');
    if(code.includes('permission-denied')||String(e).includes('PERMISSION_DENIED')){
      console.log('DENY PASS — '+label);return;
    }
    throw new Error(label+': erro inesperado '+String(e));
  }
  throw new Error('Violação de segurança: permitido '+label);
}
async function allowed(label,fn) {
  await fn();console.log('ALLOW PASS — '+label);
}
async function main(){
  const boundClaims={emprovexWarehouse:true,emprovexWarehouseVersion:'v1',
    emprovexRole:'sector',emprovexWorkspaceId:WS,emprovexUg:UG};
  const sector=await verifiedSector('sector-r2@example.test',boundClaims);
  const outsider=await verifiedSector('outsider-r2@example.test',null);
  const admin=await founder('aprov1hgesm@gmail.com','founder');
  const otherGoogle=await founder('not-founder@example.test','outsider-google');
  const anonymous=app('anonymous');

  await allowed('setor com claims lê workspace próprio',()=>getDoc(materialPath(sector.db)));
  await allowed('setor autorizado lista materiais',()=>getDocs(collection(sector.db,'warehouse',WS,'materials')));
  await denied('setor não lê workspace alheio',()=>getDoc(materialPath(sector.db,'workspace-rule-b')));
  await denied('setor sem claims não lê',()=>getDoc(materialPath(outsider.db)));
  await denied('não autenticado não lê',()=>getDoc(materialPath(anonymous.db)));
  await denied('Google não fundador não lê',()=>getDoc(materialPath(otherGoogle.db)));
  await allowed('fundador lê workspace fundador',()=>getDoc(materialPath(admin.db,'hgesm-aprov')));
  await denied('fundador não lê outro workspace pelo SDK',()=>getDoc(materialPath(admin.db)));

  await denied('setor não cria material',()=>setDoc(materialPath(sector.db),{workspaceId:WS,ug:UG}));
  await denied('setor não altera saldo',()=>updateDoc(doc(sector.db,'warehouse',WS,'balances',materialId),{quantity:99}));
  await denied('setor não apaga lote',()=>deleteDoc(doc(sector.db,'warehouse',WS,'lots','lot_'+'b'.repeat(32))));
  await denied('setor não grava em batch',()=>{
    const batch=writeBatch(sector.db);
    batch.set(doc(sector.db,'warehouse',WS,'intakes','intake_'+'c'.repeat(64)),{workspaceId:WS});
    return batch.commit();
  });
  await denied('fundador não grava diretamente',()=>setDoc(materialPath(admin.db,'hgesm-aprov'),{workspaceId:'hgesm-aprov'}));

  await lifecycle('disabled');
  await denied('workspace desativado revoga leitura na sessão existente',()=>getDoc(materialPath(sector.db)));
  await lifecycle('active','160501');
  await denied('UG diferente no lifecycle revoga leitura',()=>getDoc(materialPath(sector.db)));
  await lifecycle('active',UG);
  await allowed('reativação restaura leitura',()=>getDoc(materialPath(sector.db)));
  console.log('WAREHOUSE SERVER-ONLY RULES EMULATOR PASS');
}
try {await main();}
finally {await Promise.all(apps.map(async x=>{try{
  const auth=getAuth(x);if(auth.currentUser)await signOut(auth);
}catch{}try{await deleteApp(x);}catch{}}));}
