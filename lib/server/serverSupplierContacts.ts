/**
 * Server IAM gateway for supplier contacts only (not a generic Firestore proxy).
 * All paths are derived from the verified server-side principal.
 */
import firebaseConfig from '../../firebase-applet-config.json';
import type { SupplierContact } from '../types';
import { isValidSupplierCnpj, normalizeSupplierCnpj } from '../invoiceIdentity';
import type { VerifiedPlatformPrincipal } from './platformAuthorization';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';

export class SupplierServerError extends Error {
  constructor(public readonly code:string,public readonly status:number) {
    super(code);this.name='SupplierServerError';
  }
}
type RemoteRecord={name?:string,fields?:Record<string,{stringValue?:string}>,updateTime?:string};
const names=['id','legalName','cnpj','email','phone','whatsapp','createdAt','updatedAt','updatedBy'] as const;
function base():{root:string,emulator:boolean} {
  if(process.env.EMPROVEX_E2E_SERVER_AUTH==='1'){
    const host=process.env.FIRESTORE_EMULATOR_HOST?.trim()||'';
    const project=process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID?.trim()||'';
    if(process.env.NODE_ENV==='production'
      ||!/^(?:127\.0\.0\.1|localhost):\d{2,5}$/.test(host)
      ||!project.startsWith('demo-'))throw new SupplierServerError('SUPPLIER_SERVER_CONFIG',503);
    return {root:'http://'+host+'/v1/projects/'+encodeURIComponent(project)+'/databases/(default)/documents',emulator:true};
  }
  return {root:'https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(firebaseConfig.projectId)
    +'/databases/'+encodeURIComponent(firebaseConfig.firestoreDatabaseId)+'/documents',emulator:false};
}
async function credentials(){
  const target=base();
  return {root:target.root,authorization:'Bearer '+(target.emulator?'owner':await getGoogleAccessToken())};
}
function collectionPath(principal:VerifiedPlatformPrincipal) {
  return 'workspaces/'+encodeURIComponent(principal.workspaceId)+'/suppliers';
}
function contact(data:RemoteRecord):SupplierContact {
  const values=Object.fromEntries(names.map(x=>[x,data.fields?.[x]?.stringValue||'']));
  return values as unknown as SupplierContact;
}
function sanitize(input:unknown,uid:string,createdAt:string,recordId:string):SupplierContact {
  if(!input || typeof input!=='object' || Array.isArray(input))
    throw new SupplierServerError('SUPPLIER_INVALID',400);
  const data=input as Record<string,unknown>;
  if(Object.keys(data).some(k=>!names.includes(k as (typeof names)[number])))
    throw new SupplierServerError('SUPPLIER_INVALID_FIELDS',400);
  const cnpj=normalizeSupplierCnpj(typeof data.cnpj==='string'?data.cnpj:'');
  if(!isValidSupplierCnpj(cnpj)||data.id!==recordId)
    throw new SupplierServerError('SUPPLIER_IDENTITY_INVALID',400);
  const fields=['legalName','email','phone','whatsapp'] as const;
  const values=Object.fromEntries(fields.map(k=>{
    const value=data[k];
    if(typeof value!=='string'||value.length>500||value.includes('\u0000'))
      throw new SupplierServerError('SUPPLIER_INVALID_FIELDS',400);
    return [k,value.trim()];
  }));
  const now=new Date().toISOString();
  if(!(values.legalName as string))throw new SupplierServerError('SUPPLIER_INVALID_FIELDS',400);
  const email=values.email as string;
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new SupplierServerError('SUPPLIER_INVALID_FIELDS',400);
  return {id:recordId,cnpj,...values,
    createdAt,updatedAt:now,updatedBy:uid} as SupplierContact;
}
export async function listServerSupplierContacts(principal:VerifiedPlatformPrincipal):Promise<SupplierContact[]> {
  const {root,authorization}=await credentials();
  const prefix=root+'/'+collectionPath(principal);
  const result:SupplierContact[]=[];
  let pageToken='';
  for(let page=0;page<20;page++){
    const url=prefix+'?pageSize=250'+(pageToken?'&pageToken='+encodeURIComponent(pageToken):'');
    const response=await fetch(url,{headers:{authorization},cache:'no-store'});
    if(!response.ok)throw new SupplierServerError('SUPPLIER_READ_FAILED',503);
    const payload=await response.json() as {documents?:RemoteRecord[],nextPageToken?:string};
    for(const entry of payload.documents||[]){
      const item=contact(entry);
      if(!/^[A-Za-z0-9_-]{1,120}$/.test(item.id))throw new SupplierServerError('SUPPLIER_READ_FAILED',503);
      result.push(item);
    }
    pageToken=payload.nextPageToken||'';
    if(!pageToken)return result;
  }
  throw new SupplierServerError('SUPPLIER_RESULT_TOO_LARGE',503);
}
export async function saveServerSupplierContact(principal:VerifiedPlatformPrincipal,input:unknown):Promise<SupplierContact>{
  if(!input||typeof input!=='object'||Array.isArray(input))
    throw new SupplierServerError('SUPPLIER_INVALID',400);
  const supplied=input as Record<string,unknown>;
  const cnpj=normalizeSupplierCnpj(typeof supplied.cnpj==='string'?supplied.cnpj:'');
  const recordId=typeof supplied.id==='string'?supplied.id:'';
  if(!isValidSupplierCnpj(cnpj)||!(/^[A-Za-z0-9_-]{1,120}$/).test(recordId))
    throw new SupplierServerError('SUPPLIER_IDENTITY_INVALID',400);
  const {root,authorization}=await credentials();
  const path=collectionPath(principal)+'/'+encodeURIComponent(recordId);
  const existing=await fetch(root+'/'+path,{headers:{authorization},cache:'no-store'});
  if(existing.status!==404&&!existing.ok)throw new SupplierServerError('SUPPLIER_READ_FAILED',503);
  const record:RemoteRecord|null=existing.ok?await existing.json() as RemoteRecord:null;
  if(record&&!record.updateTime)throw new SupplierServerError('SUPPLIER_READ_FAILED',503);
  const current=record?contact(record):null;
  // IDs históricos só podem ser atualizados se o registro existir e mantiver CNPJ.
  // Novos registros usam obrigatoriamente a identidade canônica supplier_{cnpj}.
  if((recordId!=='supplier_'+cnpj && !current) ||
      (current && (current.id!==recordId||normalizeSupplierCnpj(current.cnpj)!==cnpj)))
    throw new SupplierServerError('SUPPLIER_IDENTITY_INVALID',400);
  const sanitized=sanitize(input,principal.uid,current?.createdAt||new Date().toISOString(),recordId);
  const fields=Object.fromEntries(names.map(k=>[k,{stringValue:String(sanitized[k])}]));
  const response=await fetch(root+':commit',{
    method:'POST',
    headers:{authorization,'content-type':'application/json'},
    body:JSON.stringify({writes:[{
      update:{name:path.startsWith('projects/')?path:root.slice(root.indexOf('/projects/')+1)+'/'+path,fields},
      currentDocument:record?{updateTime:record.updateTime}:{exists:false},
    }]}),cache:'no-store',
  });
  if(response.status===409||response.status===412)throw new SupplierServerError('SUPPLIER_CONCURRENT_UPDATE',409);
  if(!response.ok)throw new SupplierServerError('SUPPLIER_WRITE_FAILED',503);
  return sanitized;
}
