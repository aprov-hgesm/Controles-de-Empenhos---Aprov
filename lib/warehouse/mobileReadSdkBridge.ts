'use client';

/**
 * Compatibilidade enxuta para os leitores exclusivos do Operador Movel.
 * A tela continua montando consultas conhecidas, mas getDoc/getDocs usam
 * API autorizada (IAM) no servidor — nunca SDK Firestore para leitura.
 */
import { auth } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';

type DocumentRow = {id:string;data:Record<string,unknown>};
type Reference = {kind:'DOCUMENT';path:string};
type CollectionReference = {kind:'QUERY';path:string;conditions:Condition[];count:number;newestFirst:boolean};
type Condition = {field:string;op:'=='|'in';value:string|string[]};
type Operator = '=='|'in';

function context(path:string) {
  const match=/^warehouse\/([a-z0-9_-]+)\/(materials|barcodes|depots|locations|locationBalances|balances|lots|inventories|destinations)(?:\/([A-Za-z0-9_-]+)(?:\/items(?:\/([A-Za-z0-9_-]+))?)?)?$/.exec(path);
  if(!match)throw new Error('WAREHOUSE_MOBILE_READ_PATH_INVALID');
  const user=auth.currentUser;
  if(!user)throw new Error('WAREHOUSE_MOBILE_READ_AUTH_REQUIRED');
  const scope=getCurrentOperationalScope(user.uid);
  if(scope.workspaceId!==match[1]||!scope.ug)throw new Error('WAREHOUSE_MOBILE_READ_SCOPE_MISMATCH');
  const nested=path.includes('/items');
  return {workspaceId:scope.workspaceId,domain:nested?'items':match[2],
    id:nested?match[4]:match[3],inventoryId:nested?match[3]:undefined};
}

async function read(path:string,read:Record<string,unknown>):Promise<DocumentRow[]> {
  const ctx=context(path);
  const token=await auth.currentUser!.getIdToken();
  let response:Response;
  try {
    response=await fetch('/api/central-depositos/mobile-read',{
      method:'POST',headers:{'content-type':'application/json',
        authorization:'Bearer '+token},
      body:JSON.stringify({workspaceId:ctx.workspaceId,read:{
        domain:ctx.domain,...(ctx.inventoryId?{inventoryId:ctx.inventoryId}:{}),
        ...read,
      }}),cache:'no-store',
    });
  }catch{throw new Error('WAREHOUSE_MOBILE_READ_UNAVAILABLE');}
  const payload=await response.json().catch(()=>null) as
    {ok?:boolean;result?:{documents?:DocumentRow[]};error?:string}|null;
  if(!response.ok||!payload?.ok||!Array.isArray(payload.result?.documents))
    throw new Error(payload?.error||'WAREHOUSE_MOBILE_READ_UNAVAILABLE');
  return payload.result.documents;
}

export function doc(_db:unknown,path:string):Reference {
  return {kind:'DOCUMENT',path};
}
export function collection(_db:unknown,path:string):CollectionReference {
  return {kind:'QUERY',path,conditions:[],count:100,newestFirst:false};
}
export function documentId(){return '__name__';}
export function where(field:string,op:Operator,value:string|string[]):Condition {
  return {field,op,value};
}
export function limit(n:number){return {type:'limit',n} as const;}
export function orderBy(field:string,direction:'asc'|'desc'='asc') {
  return {type:'order',field,direction} as const;
}
export function query(ref:CollectionReference,...clauses:(Condition|ReturnType<typeof limit>|ReturnType<typeof orderBy>)[]):CollectionReference {
  let count=ref.count,newestFirst=ref.newestFirst;
  const conditions=[...ref.conditions];
  for(const c of clauses) {
    if('type'in c) {
      if(c.type==='limit')count=c.n;
      else {
        if(c.field!=='createdAt'||c.direction!=='desc')
          throw new Error('WAREHOUSE_MOBILE_READ_ORDER_FORBIDDEN');
        newestFirst=true;
      }
    } else conditions.push(c);
  }
  return {...ref,count,conditions,newestFirst};
}
function asSnapshot(row:DocumentRow) {
  return {id:row.id,data:()=>row.data,exists:()=>true};
}
export async function getDoc(ref:Reference) {
  const ctx=context(ref.path);
  if(!ctx.id)throw new Error('WAREHOUSE_MOBILE_READ_DOCUMENT_REQUIRED');
  const rows=await read(ref.path,{kind:'DOCUMENT',id:ctx.id});
  return rows.length?asSnapshot(rows[0]):{
    id:ctx.id,data:()=>undefined,exists:()=>false,
  };
}
export async function getDocs(ref:CollectionReference) {
  const nameIn=ref.conditions.filter(x=>x.field==='__name__'&&x.op==='in');
  let request:Record<string,unknown>;
  if(nameIn.length) {
    if(ref.conditions.length!==1||nameIn.length!==1
      ||!Array.isArray(nameIn[0].value))
      throw new Error('WAREHOUSE_MOBILE_READ_BATCH_INVALID');
    request={kind:'BATCH',ids:nameIn[0].value};
  } else {
    request={kind:'QUERY',
      filters:ref.conditions.map(c=>{
        if(c.op!=='=='||Array.isArray(c.value))throw new Error('WAREHOUSE_MOBILE_READ_FILTER_INVALID');
        return c;
      }),maxResults:ref.count,...(ref.newestFirst?{newestFirst:true}:{})};
  }
  const rows=await read(ref.path,request);
  const docs=rows.map(asSnapshot);
  return {docs,size:docs.length,empty:docs.length===0};
}
