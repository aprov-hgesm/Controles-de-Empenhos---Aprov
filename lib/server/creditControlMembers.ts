import firebaseConfig from '../../firebase-applet-config.json';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import {
  CreditAccessError, type CreditMember, type CreditAuthDocument, type CreditFields,
  creditDocuments, creditAdminFetch, readCreditAuthDocument, decodeCreditMember,
  validCreditUid, validCreditCenter, activeField, stringField,
} from './creditControlAuth';

type Center={id:string;name:string;active:boolean};
type MemberRow=CreditMember & {active:boolean};
type Write={update:{name:string;fields:CreditFields};updateMask:{fieldPaths:string[]};currentDocument:{exists:boolean}|{updateTime:string}};
const LIMIT=100;
const defaults=['FARM','LAC','ODONTO','APROV','ALMOX'];
const str=(stringValue:string)=>({stringValue});
const bool=(booleanValue:boolean)=>({booleanValue});
const invalid=(message:string):never=>{throw new CreditAccessError(422,message);};
const forbidden=():never=>{throw new CreditAccessError(403,'Operação não autorizada para esta UG ou perfil.');};
function manager(member:CreditMember){if(member.role!=='gestor')forbidden();}
function centerPath(member:CreditMember,id:string){return 'creditUnits/'+member.ug+'/centers/'+id;}
function centerRow(doc:CreditAuthDocument):Center|null{
  const id=doc.name.split('/').pop(),name=stringField(doc,'name');
  return validCreditCenter(id)&&name?{id,name,active:activeField(doc)}:null;
}
function memberRow(doc:CreditAuthDocument,ug:string):MemberRow|null{
  const uid=stringField(doc,'uid'),email=stringField(doc,'email'),role=stringField(doc,'role');
  const centerId=stringField(doc,'centerId')??null;
  if(!validCreditUid(uid)||doc.name.split('/').pop()!==uid||!email||stringField(doc,'ug')!==ug
    ||(role!=='centro'&&role!=='gestor')||(role==='centro'&&!validCreditCenter(centerId))||(role==='gestor'&&centerId!==null))return null;
  return {uid,email,ug,role,centerId,active:activeField(doc)};
}
function write(path:string,fields:CreditFields,old:CreditAuthDocument|null):Write{
  return {update:{name:creditDocuments+'/'+path,fields},updateMask:{fieldPaths:Object.keys(fields)},
    currentDocument:old?{updateTime:old.updateTime}:{exists:false}};
}
async function transaction<T>(member:CreditMember,token:string,fn:(tx:string)=>Promise<{writes:Write[];result:T}>):Promise<T>{
  const start=await creditAdminFetch(':beginTransaction',token,{method:'POST',body:JSON.stringify({options:{readWrite:{}}})});
  if(!start.ok)throw new CreditAccessError(503,'Não foi possível iniciar a operação.');
  const tx=(await start.json()).transaction;
  if(typeof tx!=='string'||!tx)throw new CreditAccessError(503,'Transação indisponível.');
  let committed=false;
  try {
    // Re-read inside the transaction so a concurrent revocation cannot authorize a write.
    const actor=decodeCreditMember(await readCreditAuthDocument('creditControlMembers/'+member.uid,token,tx),member.uid);
    if(!actor||actor.role!=='gestor'||actor.ug!==member.ug||actor.email!==member.email)forbidden();
    const {writes,result}=await fn(tx);
    if(writes.length){
      const res=await creditAdminFetch(':commit',token,{method:'POST',body:JSON.stringify({transaction:tx,writes})});
      if(!res.ok){
        const detail=await res.json().catch(()=>null);
        if(res.status===409||detail?.error?.status==='FAILED_PRECONDITION'||detail?.error?.status==='ABORTED')
          throw new CreditAccessError(409,'Cadastro alterado simultaneamente. Atualize e tente novamente.');
        throw new CreditAccessError(503,'Não foi possível gravar o cadastro.');
      }
      committed=true;
    }
    return result;
  } finally {
    if(!committed)await creditAdminFetch(':rollback',token,{method:'POST',body:JSON.stringify({transaction:tx})}).catch(()=>undefined);
  }
}
export async function listCreditAdministration(member:CreditMember){
  const token=await getGoogleAccessToken();
  if(member.role==='centro'){
    const doc=await readCreditAuthDocument(centerPath(member,member.centerId!),token);
    const center=doc&&centerRow(doc);
    return {centers:center?[center]:[]};
  }
  const [centersRes,membersRes]=await Promise.all([
    creditAdminFetch('/creditUnits/'+member.ug+'/centers?pageSize='+LIMIT,token),
    creditAdminFetch(':runQuery',token,{method:'POST',body:JSON.stringify({structuredQuery:{
      from:[{collectionId:'creditControlMembers'}],
      where:{fieldFilter:{field:{fieldPath:'ug'},op:'EQUAL',value:str(member.ug)}},limit:LIMIT+1,
    }})}),
  ]);
  if(!centersRes.ok||!membersRes.ok)throw new CreditAccessError(503,'Não foi possível carregar os cadastros.');
  const centersData=await centersRes.json(), membersData=await membersRes.json();
  const docs=(membersData as {document?:CreditAuthDocument}[]).flatMap(x=>x.document?[x.document]:[]);
  const centers=(centersData.documents??[] as CreditAuthDocument[]).map(centerRow).filter(Boolean);
  const members=docs.slice(0,LIMIT).map(doc=>memberRow(doc,member.ug)).filter(Boolean);
  return {centers,members,truncated:Boolean(centersData.nextPageToken)||docs.length>LIMIT};
}
async function verifyTarget(uid:string,email:string,token:string){
  let res:Response;
  try {
    res=await fetch('https://identitytoolkit.googleapis.com/v1/projects/'+encodeURIComponent(firebaseConfig.projectId)+'/accounts:lookup',{
      method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
      body:JSON.stringify({localId:[uid]}),cache:'no-store',
    });
  } catch {throw new CreditAccessError(503,'Serviço de identidade indisponível.');}
  if(!res.ok)throw new CreditAccessError(503,'Não foi possível conferir o usuário Firebase.');
  const users=(await res.json()).users;
  const target=Array.isArray(users)?users.find(u=>u.localId===uid):null;
  if(!target||target.disabled===true||target.emailVerified!==true||String(target.email).trim().toLowerCase()!==email)
    throw new CreditAccessError(422,'UID e e-mail devem corresponder a uma conta Firebase ativa e verificada.');
}
function exact(input:Record<string,unknown>,allowed:string[]){
  if(Object.keys(input).some(key=>!allowed.includes(key)))invalid('Campos não permitidos nesta operação.');
}
export async function mutateCreditAdministration(member:CreditMember,input:Record<string,unknown>){
  manager(member);
  const token=await getGoogleAccessToken();
  if(input.action==='saveCenter'){
    if(input.initializeDefaults===true){
      exact(input,['action','initializeDefaults']);
      if(member.ug!=='160416')forbidden();
      return transaction(member,token,async tx=>{
        const docs=await Promise.all(defaults.map(id=>readCreditAuthDocument(centerPath(member,id),token,tx)));
        const writes=defaults.flatMap((id,i)=>docs[i]?[]:[write(centerPath(member,id),{id:str(id),name:str(id),active:bool(true)},null)]);
        return {writes,result:{initialized:true,created:writes.length}};
      });
    }
    exact(input,['action','id','name','active']);
    const id=input.id,name=typeof input.name==='string'?input.name.trim():'',active=input.active;
    if(!validCreditCenter(id)||!name||name.length>120||typeof active!=='boolean')return invalid('Informe código, nome e situação válidos do centro.');
    return transaction(member,token,async tx=>{
      const path=centerPath(member,id),old=await readCreditAuthDocument(path,token,tx);
      return {writes:[write(path,{id:str(id),name:str(name),active:bool(active)},old)],result:{center:{id,name,active}}};
    });
  }
  if(input.action==='saveMember'){
    exact(input,['action','uid','email','centerId']);
    const uid=input.uid,centerId=input.centerId,email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
    if(!validCreditUid(uid)||!validCreditCenter(centerId)||email.length>254||!/^\S+@\S+\.\S+$/.test(email))return invalid('Informe UID, e-mail e centro de custos válidos.');
    if(uid===member.uid)forbidden();
    await verifyTarget(uid,email,token);
    return transaction(member,token,async tx=>{
      const path='creditControlMembers/'+uid;
      const [old,center]=await Promise.all([readCreditAuthDocument(path,token,tx),readCreditAuthDocument(centerPath(member,centerId),token,tx)]);
      if(old&&(stringField(old,'ug')!==member.ug||stringField(old,'role')!=='centro'||stringField(old,'uid')!==uid))forbidden();
      if(!activeField(center))return invalid('Selecione um centro de custos ativo.');
      const result:MemberRow={uid,email,ug:member.ug,role:'centro',centerId,active:true};
      return {writes:[write(path,{uid:str(uid),email:str(email),ug:str(member.ug),role:str('centro'),centerId:str(centerId),active:bool(true)},old)],result:{member:result}};
    });
  }
  if(input.action==='revokeMember'){
    exact(input,['action','uid']);
    const uid=input.uid;
    if(!validCreditUid(uid))return invalid('UID inválido.');
    if(uid===member.uid)forbidden();
    return transaction(member,token,async tx=>{
      const path='creditControlMembers/'+uid,old=await readCreditAuthDocument(path,token,tx);
      if(!old||stringField(old,'ug')!==member.ug||stringField(old,'role')!=='centro'||stringField(old,'uid')!==uid)
        throw new CreditAccessError(404,'Membro não encontrado nesta UG.');
      return {writes:activeField(old)?[write(path,{active:bool(false)},old)]:[],result:{revoked:true,uid}};
    });
  }
  return invalid('Ação administrativa inválida.');
}
