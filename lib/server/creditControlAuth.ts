import firebaseConfig from '../../firebase-applet-config.json';
import { verifyFirebaseRequest, FounderAuthError } from './firebaseFounderAuth';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';

export class CreditAccessError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export type CreditMember = {
  uid: string; email: string; ug: string; role: 'gestor' | 'centro'; centerId: string | null;
};
export const creditDatabase = 'projects/'+firebaseConfig.projectId+'/databases/emprovex-credito';
export const creditDocuments = creditDatabase+'/documents';
export type CreditField = {stringValue:string}|{booleanValue:boolean}|{nullValue:null};
export type CreditFields = Record<string, CreditField>;
export type CreditAuthDocument = {name:string;fields:CreditFields;updateTime:string};
export const validCreditUid = (value:unknown): value is string => typeof value==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export const validCreditCenter = (value:unknown): value is string => typeof value==='string' && /^[A-Za-z0-9_-]{1,64}$/.test(value) && !/^__.*__$/.test(value);
export const stringField = (doc:CreditAuthDocument|null,key:string) => {
  const v=doc?.fields?.[key]; return v && 'stringValue' in v ? v.stringValue : undefined;
};
export const activeField = (doc:CreditAuthDocument|null) => {
  const v=doc?.fields?.active; return !!v && 'booleanValue' in v && v.booleanValue===true;
};
export async function creditAdminFetch(path:string, token:string, init:RequestInit={}) {
  try {
    return await fetch('https://firestore.googleapis.com/v1/'+creditDocuments+path,{
      ...init, headers:{authorization:'Bearer '+token,'content-type':'application/json'},cache:'no-store',
    });
  } catch { throw new CreditAccessError(503,'Banco de Controle de Crédito indisponível.'); }
}
export async function readCreditAuthDocument(path:string,token:string,transaction?:string):Promise<CreditAuthDocument|null>{
  const res=await creditAdminFetch('/'+path+(transaction?'?transaction='+encodeURIComponent(transaction):''),token);
  if(res.status===404)return null;
  if(!res.ok)throw new CreditAccessError(res.status===409?409:503,'Não foi possível consultar a autorização.');
  return await res.json() as CreditAuthDocument;
}
export function decodeCreditMember(doc:CreditAuthDocument|null,uid:string):CreditMember|null{
  const email=stringField(doc,'email'),ug=stringField(doc,'ug'),role=stringField(doc,'role');
  const centerId=stringField(doc,'centerId')??null;
  const centerField=doc?.fields?.centerId;
  if(!validCreditUid(uid)||!activeField(doc)||stringField(doc,'uid')!==uid||!email||!ug||!/^\d{6}$/.test(ug)
    ||(role!=='gestor'&&role!=='centro')||(role==='centro'&&!validCreditCenter(centerId))
    ||(role==='gestor'&&(!centerField||!('nullValue' in centerField)||centerId!==null)))return null;
  return {uid,email,ug,role,centerId};
}
/** No billing, subscription, workspace or founder gate. Membership is read afresh. */
export async function requireCreditMember(request:Request,managerOnly=false):Promise<CreditMember>{
  // Production rollout is explicit for the existing Cloud Run service; 0 remains a kill switch.
  // All non-production services remain disabled unless explicitly opted in.
  const gate=process.env.EMPROVEX_CREDIT_CONTROL_ENABLED;
  const enabled=gate==='1'||(gate===undefined&&process.env.NODE_ENV==='production'&&process.env.K_SERVICE==='emprovex-cloudrun-candidate');
  if(!enabled)
    throw new CreditAccessError(503,'Controle de Crédito ainda não habilitado neste ambiente.');
  const identity=await verifyFirebaseRequest(request.headers.get('authorization'));
  if(!validCreditUid(identity.uid)||!['password','google.com'].includes(identity.signInProvider))
    throw new CreditAccessError(403,'Identidade não autorizada.');
  let lookup:Response;
  try {
    lookup=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(firebaseConfig.apiKey),{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({idToken:identity.idToken}),cache:'no-store',
    });
  } catch { throw new CreditAccessError(503,'Serviço de identidade indisponível.'); }
  if(!lookup.ok)throw new CreditAccessError(lookup.status>=500||lookup.status===429?503:401,'Não foi possível validar a sessão Firebase.');
  const current=(await lookup.json()).users?.[0];
  if(!current||current.disabled===true||current.emailVerified!==true||current.localId!==identity.uid
    ||String(current.email).trim().toLowerCase()!==identity.email)
    throw new CreditAccessError(403,'Identidade não autorizada.');
  const authTime=identity.claims.auth_time;
  const validSince=Number(current.validSince??0);
  if(typeof authTime!=='number'||!Number.isFinite(validSince)||authTime<validSince)
    throw new CreditAccessError(401,'Sessão revogada. Entre novamente.');
  const token=await getGoogleAccessToken();
  const member=decodeCreditMember(await readCreditAuthDocument('creditControlMembers/'+identity.uid,token),identity.uid);
  if(!member||member.email!==identity.email||(managerOnly&&member.role!=='gestor'))
    throw new CreditAccessError(403,'Perfil não autorizado para esta operação.');
  if(member.role==='centro'){
    const center=await readCreditAuthDocument('creditUnits/'+member.ug+'/centers/'+member.centerId,token);
    if(!activeField(center))throw new CreditAccessError(403,'Centro de custos inativo ou não cadastrado.');
  }
  return member;
}
export function creditAuthFailure(error:unknown):{status:number;error:string}{
  if(error instanceof CreditAccessError||error instanceof FounderAuthError)return {status:error.status,error:error.message};
  return {status:503,error:'Não foi possível concluir a operação no Controle de Crédito.'};
}
