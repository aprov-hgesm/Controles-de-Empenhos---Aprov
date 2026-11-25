/**
 * R1.6 — Google Drive ACL adapter.
 * This module does not authenticate or authorize a financial record.
 * Callers MUST prove owner, UG, entity generation, file hash, parent and current
 * membership, and serialize mutations for the file before using it.
 * No public, group, domain or writer grants, no refresh-token storage.
 */
export type ReaderPermission={id:string;type:'user';role:'reader';emailAddress:string};
type DrivePermission={id?:string;type?:string;role?:string;emailAddress?:string;deleted?:boolean;expirationTime?:string};
type Options={fetcher?:typeof fetch;signal?:AbortSignal};
export class CreditDrivePermissionError extends Error {
  constructor(public readonly code:'INVALID'|'UNSAFE_ACL'|'PROVIDER'|'INCOMPLETE',message:string){super(message);this.name='CreditDrivePermissionError';}
}
const err=(code:CreditDrivePermissionError['code'],message:string):never=>{throw new CreditDrivePermissionError(code,message);};
const filePattern=/^[A-Za-z0-9_-]{5,200}$/;
const permissionPattern=/^[A-Za-z0-9_-]{1,200}$/;
const endpoint='https://www.googleapis.com/drive/v3/files/';
function email(value:unknown):string{
  if(typeof value!=='string')return err('INVALID','Conta Google inválida.');
  const normalized=value.trim().toLowerCase();
  if(normalized.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))return err('INVALID','Conta Google inválida.');
  return normalized;
}
function safeId(id:string,pattern:RegExp){if(!pattern.test(id))err('INVALID','Referência Drive inválida.');return encodeURIComponent(id);}
function safeAcl(permissions:DrivePermission[],owner:string):ReaderPermission[]{
  const result:ReaderPermission[]=[];
  const ids=new Set<string>(),emails=new Set<string>();
  let owners=0;
  for(const p of permissions){
    if(!p.id||!permissionPattern.test(p.id)||ids.has(p.id)||p.deleted)err('UNSAFE_ACL','Permissão Drive inválida ou divergente.');
    ids.add(p.id!);
    if(p.type!=='user'||!p.emailAddress)err('UNSAFE_ACL','Compartilhamento público, por domínio ou grupo não permitido.');
    const addr=email(p.emailAddress);
    if(p.role==='owner'&&addr===owner&&!p.expirationTime){owners++;continue;}
    if(p.role!=='reader'||addr===owner||emails.has(addr)||p.expirationTime)err('UNSAFE_ACL','Permissão externa ou não autorizada. Revise o compartilhamento do arquivo no Drive.');
    emails.add(addr);
    result.push({id:p.id!,type:'user',role:'reader',emailAddress:addr});
  }
  if(owners!==1)err('UNSAFE_ACL','Proprietário Drive não confirmado.');
  return result;
}
export function createCreditDrivePermissionAdapter(accessToken:string,ownerEmail:string,options:Options={}){
  if(!/^[A-Za-z0-9._~+\/=-]{20,4096}$/.test(accessToken))err('INVALID','Conecte novamente o Drive do gestor.');
  const owner=email(ownerEmail),fetcher=options.fetcher??fetch;
  async function request(url:string,init:RequestInit={}){
    const headers=new Headers(init.headers);
    headers.set('Authorization','Bearer '+accessToken);
    const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000);
    try{return await fetcher(url,{...init,headers,signal,cache:'no-store',redirect:'error'});}
    catch{return err('PROVIDER','Não foi possível consultar as permissões do Google Drive.');}
  }
  function url(fileId:string){return endpoint+safeId(fileId,filePattern)+'/permissions';}
  async function list(fileId:string):Promise<ReaderPermission[]>{
    const result:DrivePermission[]=[];
    const seen=new Set<string>();
    let pageToken='';
    for(let i=0;i<20;i++){
      const params=new URLSearchParams({fields:'nextPageToken,permissions(id,type,role,emailAddress,deleted,expirationTime)',pageSize:'100'});
      if(pageToken)params.set('pageToken',pageToken);
      const res=await request(url(fileId)+'?'+params);
      if(!res.ok)err('PROVIDER','Não foi possível conferir as permissões do arquivo.');
      const data=await res.json() as {permissions?:DrivePermission[];nextPageToken?:string};
      if(!Array.isArray(data.permissions))err('INCOMPLETE','Resposta de permissões incompleta.');
      result.push(...data.permissions!);
      if(!data.nextPageToken)return safeAcl(result,owner);
      if(seen.has(data.nextPageToken)||data.nextPageToken.length>4096)err('INCOMPLETE','Paginação Drive inconsistente.');
      seen.add(data.nextPageToken);pageToken=data.nextPageToken;
    }
    return err('INCOMPLETE','Quantidade de permissões acima do limite seguro.');
  }
  async function remove(fileId:string,id:string){
    const res=await request(url(fileId)+'/'+safeId(id,permissionPattern),{method:'DELETE'});
    // 404 is not enough for confirmation; the final complete ACL must prove absence.
    if(!res.ok&&res.status!==404)err('PROVIDER','Não foi possível revogar a permissão no Drive.');
  }
  async function grant(fileId:string,recipient:string):Promise<void>{
    const addr=email(recipient);
    if(addr===owner)err('INVALID','O proprietário não precisa de compartilhamento.');
    const res=await request(url(fileId)+'?sendNotificationEmail=false&fields=id,type,role,emailAddress',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'user',role:'reader',emailAddress:addr}),
    });
    if(!res.ok)err('PROVIDER','Não foi possível conceder leitura à conta Google do centro.');
    const created=await res.json() as DrivePermission;
    if(!created.id||!permissionPattern.test(created.id)||created.type!=='user'||created.role!=='reader'||email(created.emailAddress)!==addr)
      err('INCOMPLETE','A permissão criada não foi confirmada pelo Drive.');
  }
  /** Desired recipients come exclusively from verified active centre membership.
   * knownRecipients is the persisted allowlist of previous or reserved grants.
   * Refuse externally created reader grants instead of silently legitimizing them.
   * Operations are sequential per file; caller owns the durable mutation lock.
   */
  async function reconcile(fileId:string,desiredRecipients:readonly string[],knownRecipients:readonly string[]):Promise<ReaderPermission[]>{
    const desired=new Set(desiredRecipients.map(email)),known=new Set(knownRecipients.map(email));
    if(desired.size>100||known.size>100||desired.has(owner)||known.has(owner))err('INVALID','Lista de destinatários inválida.');
    const before=await list(fileId);
    if(before.some(p=>!known.has(p.emailAddress)))err('UNSAFE_ACL','Existe permissão não registrada pelo EMPROVEX. Revise o arquivo no Drive.');
    // Reserve desired addresses durably BEFORE calling reconcile, so a crash
    // following a successful grant is recoverable and cannot orphan an ACL.
    if([...desired].some(addr=>!known.has(addr)))err('INVALID','Destinatário ainda não reservado no registro de compartilhamento.');
    for(const p of before)if(!desired.has(p.emailAddress))await remove(fileId,p.id);
    const remaining=await list(fileId);
    if(remaining.some(p=>!desired.has(p.emailAddress)))err('INCOMPLETE','A revogação não foi confirmada.');
    const present=new Set(remaining.map(p=>p.emailAddress));
    for(const addr of desired)if(!present.has(addr))await grant(fileId,addr);
    const after=await list(fileId);
    if(after.length!==desired.size||after.some(p=>!desired.has(p.emailAddress)))err('INCOMPLETE','Compartilhamento não confirmado integralmente.');
    return after;
  }
  return {list,reconcile};
}
/** Construct only a fixed Google Drive origin, never trust a stored arbitrary URL. */
export function creditDriveViewUrl(fileId:string){return 'https://drive.google.com/file/d/'+safeId(fileId,filePattern)+'/view';}
