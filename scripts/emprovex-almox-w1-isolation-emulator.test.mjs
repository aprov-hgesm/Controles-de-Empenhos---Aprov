#!/usr/bin/env node
/**
 * W1 R0.1 — Auth/Firestore Emulator only (demo-emprovex-security).
 * Confirma que duas modalidades podem usar a mesma UG sem obter autorização cruzada.
 * Não provisiona contas Firebase reais, não acessa Cloud Run, não publica Rules.
 */
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';

const project='demo-emprovex-security';
const host='http://127.0.0.1:9099';
const endpoint='http://127.0.0.1:8080/v1/projects/'+project+'/databases/(default)/documents';
const password='Almox-W1-R01-Demo!2026';
const ug='160416';
const testCases=[
  {workspaceId:'qa-aprov-w1', email:'w1-aprov@example.test', sectorType:undefined},
  {workspaceId:'qa-almox-w1', email:'w1-almox@example.test', sectorType:'almoxarifado'},
];
const apps=[];
function encode(value) {
  if (value===null) return {nullValue:'NULL_VALUE'};
  if (typeof value==='string') return {stringValue:value};
  if (typeof value==='boolean') return {booleanValue:value};
  if (typeof value==='number') return {integerValue:String(value)};
  if (Array.isArray(value)) return {arrayValue:{values:value.map(encode)}};
  if (typeof value==='object') return {mapValue:{fields:fields(value)}};
  throw Error('Unexpected emulator seed type');
}
function fields(object) {return Object.fromEntries(Object.entries(object).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encode(v)]));}
async function ownerSet(path,data) {
  const response=await fetch(endpoint+'/'+path,{method:'PATCH',headers:{authorization:'Bearer owner','content-type':'application/json'},body:JSON.stringify({fields:fields(data)})});
  assert.equal(response.status,200,'owner emulator seed '+path+': '+await response.text());
}
async function authPost(method,body) {
  const response=await fetch(host+'/identitytoolkit.googleapis.com/v1/'+method+'?key=fake-api-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json();
  assert.equal(response.ok,true,'auth emulator '+method+': '+JSON.stringify(result));
  return result;
}
async function verifyUser(email) {
  const signUp=await authPost('accounts:signUp',{email,password,returnSecureToken:true});
  await authPost('accounts:sendOobCode',{requestType:'VERIFY_EMAIL',idToken:signUp.idToken});
  const response=await fetch(host+'/emulator/v1/projects/'+project+'/oobCodes');
  assert.equal(response.ok,true);
  const codes=await response.json();
  const link=[...(codes.oobCodes||[])].reverse().find(c=>c.email===email&&c.requestType==='VERIFY_EMAIL')?.oobLink;
  assert.ok(link,'missing verification link');
  const verification=await fetch(link);
  assert.equal(verification.ok,true);
  return signUp.localId;
}
async function session(label,email) {
  const app=initializeApp({apiKey:'fake-api-key',projectId:project,authDomain:project+'.firebaseapp.com'},'almox-w1-'+label);
  apps.push(app);
  const auth=getAuth(app);
  connectAuthEmulator(auth,host,{disableWarnings:true});
  const credential=await signInWithEmailAndPassword(auth,email,password);
  const token=await credential.user.getIdTokenResult(true);
  assert.equal(token.signInProvider,'password');
  assert.equal(credential.user.emailVerified,true);
  const db=getFirestore(app);
  connectFirestoreEmulator(db,'127.0.0.1',8080);
  return {db,auth,user:credential.user};
}
async function denied(label,fn) {
  await assert.rejects(fn,error=>String(error?.code||error).includes('permission-denied')||String(error).includes('PERMISSION_DENIED'),label);
  console.log('DENY '+label);
}
async function main() {
  for(const seed of testCases) {
    const uid=await verifyUser(seed.email);
    seed.uid=uid;
    const workspace={
      id:seed.workspaceId,name:'Workspace '+seed.workspaceId,status:'active',ug,
      authorizedEmail:seed.email,
      ...(seed.sectorType?{sectorType:seed.sectorType}:{}),
      institutionalProfile:{organizationName:'OM QA',sectionName:seed.sectorType?'Almoxarifado':'Aprovisionamento'},
      createdAt:'2026-10-31T00:00:00Z',updatedAt:'2026-10-31T00:00:00Z',createdBy:'admin@example.test',
    };
    const account={
      email:seed.email,authProvider:'password',firebaseUid:uid,accountType:'sector',
      ...(seed.sectorType?{sectorType:seed.sectorType}:{}),
      workspaceId:seed.workspaceId,ug,status:'active',
      createdAt:'2026-10-31T00:00:00Z',updatedAt:'2026-10-31T00:00:00Z',createdBy:'admin@example.test',
    };
    seed.workspace=workspace;seed.account=account;
    await ownerSet('workspaces/'+seed.workspaceId,workspace);
    await ownerSet('platformAccounts/'+seed.email,account);
    await ownerSet('workspaces/'+seed.workspaceId+'/empenhos/prova',{id:'prova',description:'teste escopado',ug});
  }
  const apro=await session('aprov',testCases[0].email);
  const almox=await session('almox',testCases[1].email);
  const get=(s,id)=>getDoc(doc(s.db,'workspaces',id,'empenhos','prova'));
  assert.equal((await get(apro,testCases[0].workspaceId)).exists(),true);
  assert.equal((await get(almox,testCases[1].workspaceId)).exists(),true);
  console.log('ALLOW duas modalidades com a MESMA UG, workspaces diferentes');
  await denied('URL/troca de workspace apro->almox',()=>get(apro,testCases[1].workspaceId));
  await denied('URL/troca de workspace almox->apro',()=>get(almox,testCases[0].workspaceId));
  await denied('leitura do cadastro cruzado',()=>getDoc(doc(almox.db,'platformAccounts',testCases[0].email)));
  await denied('escrita client-side no indice UG setorial',()=>setDoc(doc(almox.db,'platformSectorUgIndex',ug+'-almoxarifado'),{workspaceId:testCases[1].workspaceId}));

  const target=testCases[1], id=target.workspaceId;
  try {
    await ownerSet('workspaces/'+id,{...target.workspace,sectorType:'aprovisionamento'});
    await denied('modalidade divergente workspace/conta',()=>get(almox,id));
  } finally { await ownerSet('workspaces/'+id,target.workspace); }

  try {
    await ownerSet('platformAccounts/'+target.email,{...target.account,firebaseUid:'uid-nao-autorizado'});
    await denied('UID diferente',()=>get(almox,id));
  } finally { await ownerSet('platformAccounts/'+target.email,target.account); }

  try {
    await ownerSet('platformAccounts/'+target.email,{...target.account,status:'disabled'});
    await denied('conta desativada',()=>get(almox,id));
  } finally { await ownerSet('platformAccounts/'+target.email,target.account); }

  try {
    await ownerSet('workspaces/'+id,{...target.workspace,status:'disabled'});
    await denied('workspace desativado',()=>get(almox,id));
  } finally { await ownerSet('workspaces/'+id,target.workspace); }

  try {
    await ownerSet('platformAccounts/'+target.email,{...target.account,accountType:'company'});
    await denied('modalidade de conta empresarial sem autorização',()=>get(almox,id));
  } finally { await ownerSet('platformAccounts/'+target.email,target.account); }
  assert.equal((await get(almox,id)).exists(),true);
  console.log('ALMOX W1 R0.1 FIRESTORE ISOLATION PASS');
}
try { await main(); }
finally {
  for(const app of apps) {
    try {const auth=getAuth(app);if(auth.currentUser)await signOut(auth);} catch {}
    try {await deleteApp(app);} catch {}
  }
}
