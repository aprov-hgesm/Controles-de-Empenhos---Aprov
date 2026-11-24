import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import firebaseConfig from '@/firebase-applet-config.json';
import { verifyFirebaseRequest } from '@/lib/server/firebaseFounderAuth';
import { verifyFounderSession, getGoogleAccessToken } from '@/lib/server/sectorProvisioningAdmin';
import { HGESM_SECTOR_EMAIL } from '@/lib/hgesmWorkspace';
import { isFounderSignInProvider } from '@/lib/platformIdentity';
import { CreditAccessError, creditAuthFailure, creditAdminFetch, creditDocuments, readCreditAuthDocument, validCreditUid, stringField, type CreditFields, type CreditAuthDocument } from '@/lib/server/creditControlAuth';
import { listCreditAdministration } from '@/lib/server/creditControlMembers';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const ug='160416';
const centers={APROV:'Aprovisionamento',ALMOX:'Almoxarifado',FARM:'Farmácia',LAC:'Laboratório de Análises Clínicas',ODONTO:'Odontologia'} as const;
const str=(stringValue:string)=>({stringValue});
const bool=(booleanValue:boolean)=>({booleanValue});
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
type Identity={localId?:string;email?:string;emailVerified?:boolean;disabled?:boolean;validSince?:string};
async function authRequest(token:string,method:string,body:Record<string,unknown>){
  const res=await fetch('https://identitytoolkit.googleapis.com/v1/projects/'+encodeURIComponent(firebaseConfig.projectId)+'/'+method,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  const data=await res.json().catch(()=>({}));
  if(!res.ok){
    const reason=String(data?.error?.message??'');
    if(method==='accounts:lookup'&&reason==='USER_NOT_FOUND')return {users:[]};
    if(reason.includes('EMAIL_EXISTS'))throw new CreditAccessError(409,'E-mail já cadastrado. Vincule a conta existente sem alterar a senha.');
    if(reason.includes('PASSWORD'))throw new CreditAccessError(422,'Senha não atende à política do Firebase.');
    throw new CreditAccessError(503,'Não foi possível concluir a operação de identidade.');
  }
  return data;
}
async function authorize(request:Request){
  const identity=await verifyFirebaseRequest(request.headers.get('authorization'));
  if(identity.email!==HGESM_SECTOR_EMAIL||!isFounderSignInProvider(identity.signInProvider))throw new CreditAccessError(403,'Acesso exclusivo da administração do EMPROVEX.');
  try{await verifyFounderSession(identity.idToken);}catch{throw new CreditAccessError(403,'Sessão administrativa inválida. Entre novamente.');}
  const token=await getGoogleAccessToken();
  const data=await authRequest(token,'accounts:lookup',{localId:[identity.uid]});
  const current=(data.users as Identity[]|undefined)?.find(u=>u.localId===identity.uid);
  const since=Number(current?.validSince??0);
  if(!current||current.disabled||current.emailVerified!==true||current.email?.toLowerCase()!==identity.email||typeof identity.claims.auth_time!=='number'||!Number.isFinite(since)||identity.claims.auth_time<since)throw new CreditAccessError(403,'Sessão administrativa revogada ou inválida.');
  return {identity,token};
}
function write(path:string,fields:CreditFields,old:CreditAuthDocument|null){
  return {update:{name:creditDocuments+'/'+path,fields},updateMask:{fieldPaths:Object.keys(fields)},currentDocument:old?{updateTime:old.updateTime}:{exists:false}};
}
async function commit(token:string,writes:ReturnType<typeof write>[]){
  const res=await creditAdminFetch(':commit',token,{method:'POST',body:JSON.stringify({writes})});
  if(!res.ok){
    if(res.status===409||res.status===400)throw new CreditAccessError(409,'Cadastro não concluído. Atualize a lista e, se a conta já foi criada, vincule-a sem senha.');
    throw new CreditAccessError(503,'Não foi possível salvar o vínculo. Se a conta Firebase foi criada, tente vinculá-la sem senha.');
  }
}
async function bodyOf(request:Request):Promise<Record<string,unknown>>{
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')||!request.body)throw new CreditAccessError(422,'Dados inválidos.');
  const reader=request.body.getReader();const decoder=new TextDecoder('utf-8',{fatal:true});let raw='',size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw new CreditAccessError(422,'Dados excedem o limite.');}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();const data=JSON.parse(raw);if(!data||typeof data!=='object'||Array.isArray(data))throw new Error();return data;}
  catch(error){if(error instanceof CreditAccessError)throw error;throw new CreditAccessError(422,'Dados inválidos.');}finally{reader.releaseLock();}
}
function audit(actor:string,uid:string,action:string){
  return write('creditUnits/'+ug+'/accessAudit/'+randomUUID(),{actorUid:str(actor),targetUid:str(uid),action:str(action),createdAt:str(new Date().toISOString())},null);
}
export async function GET(request:Request){
  try{const {identity}=await authorize(request);return reply(await listCreditAdministration({uid:identity.uid,email:identity.email,ug,role:'gestor',centerId:null}));}
  catch(error){const f=creditAuthFailure(error);return reply({error:f.error},f.status);}
}
export async function POST(request:Request){
  try{
    const {identity,token}=await authorize(request);
    const body=await bodyOf(request);
    if(body.action==='revoke'){
      if(Object.keys(body).some(k=>!['action','uid'].includes(k))||!validCreditUid(body.uid))throw new CreditAccessError(422,'Usuário inválido.');
      const path='creditControlMembers/'+body.uid;const old=await readCreditAuthDocument(path,token);
      if(!old||stringField(old,'ug')!==ug||stringField(old,'uid')!==body.uid)throw new CreditAccessError(404,'Vínculo não encontrado.');
      await commit(token,[write(path,{active:bool(false)},old),audit(identity.uid,body.uid,'revoke')]);
      return reply({ok:true});
    }
    if(body.action!=='save'||Object.keys(body).some(k=>!['action','email','password','role','centerId','confirmInstitutionalEmail'].includes(k)))throw new CreditAccessError(422,'Ação inválida.');
    const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
    const password=typeof body.password==='string'?body.password:'';
    const role=body.role;
    const centerId=typeof body.centerId==='string'?body.centerId:'';
    if(email.length>254||!/^\S+@\S+\.\S+$/.test(email)||(role!=='gestor'&&role!=='centro')||(role==='gestor'&&centerId)||(role==='centro'&&!Object.hasOwn(centers,centerId)))throw new CreditAccessError(422,'Informe e-mail e perfil válidos.');
    if(password&&(password.length<12||password.length>128||body.confirmInstitutionalEmail!==true))throw new CreditAccessError(422,'Use senha de 12 a 128 caracteres e confirme a titularidade institucional do e-mail.');
    const found=await authRequest(token,'accounts:lookup',{email:[email]});
    let target=(found.users as Identity[]|undefined)?.[0];
    if(target&&password)throw new CreditAccessError(409,'A conta já existe. Para preservar a senha dos outros módulos, vincule-a sem preencher a senha.');
    if(!target){
      if(!password)throw new CreditAccessError(422,'Conta não localizada. Informe a senha inicial para criar um novo acesso.');
      target=await authRequest(token,'accounts',{email,password,emailVerified:true,disabled:false}) as Identity;
    }
    const uid=target?.localId;
    if(!validCreditUid(uid)||target.disabled===true||target.emailVerified!==true||target.email?.toLowerCase()!==email)throw new CreditAccessError(422,'Conta Firebase precisa estar ativa e com e-mail verificado.');
    const path='creditControlMembers/'+uid;
    const old=await readCreditAuthDocument(path,token);
    if(old&&(stringField(old,'uid')!==uid||stringField(old,'ug')!==ug||stringField(old,'role')!==role||(role==='centro'&&stringField(old,'centerId')!==centerId)))throw new CreditAccessError(409,'Este usuário já possui outro vínculo. Não é permitido alterar automaticamente sua UG ou perfil.');
    const writes:ReturnType<typeof write>[]=[];
    // Only initialize absent default centers; never overwrite names or inactive state.
    for(const [id,name] of Object.entries(centers)){
      const cp='creditUnits/'+ug+'/centers/'+id;
      const existing=await readCreditAuthDocument(cp,token);
      if(!existing)writes.push(write(cp,{id:str(id),name:str(name),active:bool(true)},null));
      else if(role==='centro'&&centerId===id&&(!existing.fields.active||!('booleanValue' in existing.fields.active)||!existing.fields.active.booleanValue))throw new CreditAccessError(422,'Centro inativo. Reative-o pelo gestor antes de vincular o usuário.');
    }
    const fields:CreditFields={uid:str(uid),email:str(email),ug:str(ug),role:str(role),centerId:role==='gestor'?{nullValue:null}:str(centerId),active:bool(true)};
    writes.push(write(path,fields,old),audit(identity.uid,uid,'grant'));
    await commit(token,writes);
    return reply({ok:true,uid});
  }catch(error){const f=creditAuthFailure(error);return reply({error:f.error},f.status);}
}
