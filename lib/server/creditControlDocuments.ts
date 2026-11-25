import { createHash } from 'node:crypto';
import firebaseConfig from '../../firebase-applet-config.json';
import { CreditAccessError, type CreditMember } from './creditControlAuth';
import { FounderAuthError } from './firebaseFounderAuth';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import { getCredit, getCommitment } from './creditControlStore';
import { parseSagCreditHtml } from '../controle-credito/sagCreditHtml.mjs';
import { parseNe } from './creditControlImport';
import { creditPdf, creditPdfResponse, displayDate, money } from '../controle-credito/reports/creditPdf';

type Kind = 'nc' | 'ne';
type Fields = Record<string, {stringValue?: string; integerValue?: string; booleanValue?: boolean}>;
type RecordDoc = {name: string; fields: Fields; updateTime: string};
type Metadata = {id: string; name: string; mimeType: string; size?: string; parents?: string[]; ownedByMe?: boolean; trashed?: boolean; appProperties?: Record<string,string>; permissions?: {type:string;role:string}[]};
type Stored = {
  id:string; entityType:Kind; entityId:string; entityKey:string; filename:string; mimeType:string;
  sizeBytes:number; sha256:string; status:'pending'|'ready'|'failed'; createdAt:string;
  driveId:string; folderId:string; ownerEmail:string; version:string; uploadedBy:string;
};
const fail = (status:number, message:string): never => { throw new CreditAccessError(status,message); };
const hash = (bytes:Uint8Array|string) => createHash('sha256').update(bytes).digest('hex');
const root = 'https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(firebaseConfig.projectId)+'/databases/emprovex-credito/documents';
const drive = 'https://www.googleapis.com/drive/v3';
const upload = 'https://www.googleapis.com/upload/drive/v3';
const folderMime = 'application/vnd.google-apps.folder';
const headers = {'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const unit = (m:CreditMember) => {
  if(!/^\d{6}$/.test(m.ug)) fail(403,'UG inválida.');
  return '/creditUnits/'+m.ug;
};
export function documentKind(value:unknown):Kind {
  if(value==='nc'||value==='ne') return value;
  return fail(422,'Tipo documental inválido.');
}
export function documentEntityId(value:unknown):string {
  if(typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value)) return value;
  return fail(422,'Identificador financeiro inválido.');
}
function manager(m:CreditMember) {
  if(m.role!=='gestor') fail(403,'Operação reservada ao gestor.');
}
export function documentError(e:unknown):Response {
  if(e instanceof CreditAccessError||e instanceof FounderAuthError) {
    return Response.json({error:e.message},{status:e.status,headers});
  }
  // Do not log provider payloads, OAuth tokens or private file identifiers.
  const status=typeof e==='object'&&e!==null&&'status' in e ? Number(e.status):503;
  return Response.json({error:status===404||status===403?'Documento ou registro não acessível.':'Não foi possível concluir a operação documental.'},{status:[403,404,409,422].includes(status)?status:503,headers});
}
export function documentJson(body:unknown) {return Response.json(body,{headers});}
async function db(path:string,init:RequestInit={}) {
  const h=new Headers(init.headers);
  h.set('Authorization','Bearer '+await getGoogleAccessToken());
  h.set('Content-Type','application/json');
  const res=await fetch(root+path,{...init,headers:h,cache:'no-store',redirect:'error'});
  if(!res.ok&&res.status!==404&&res.status!==409&&res.status!==412&&res.status!==400) fail(503,'Armazenamento documental indisponível.');
  return res;
}
async function read(path:string):Promise<RecordDoc|null> {
  const res=await db(path);
  if(res.status===404)return null;
  if(!res.ok)fail(503,'Não foi possível consultar o documento.');
  return res.json();
}
function encode(value:Record<string,string|number>):Fields {
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,typeof v==='number'?{integerValue:String(v)}:{stringValue:v}]));
}
function str(doc:RecordDoc,key:string) {return doc.fields[key]?.stringValue||'';}
function stored(doc:RecordDoc):Stored {
  const d={
    id:str(doc,'id'),entityType:documentKind(str(doc,'entityType')),entityId:documentEntityId(str(doc,'entityId')),
    entityKey:str(doc,'entityKey'),filename:str(doc,'filename'),mimeType:str(doc,'mimeType'),sizeBytes:Number(doc.fields.sizeBytes?.integerValue),
    sha256:str(doc,'sha256'),status:str(doc,'status') as Stored['status'],createdAt:str(doc,'createdAt'),driveId:str(doc,'driveId'),
    folderId:str(doc,'folderId'),ownerEmail:str(doc,'ownerEmail'),version:str(doc,'version'),uploadedBy:str(doc,'uploadedBy'),
  };
  if(!/^[a-f0-9]{64}$/.test(d.id)||!/^[a-f0-9]{64}$/.test(d.sha256)||!Number.isSafeInteger(d.sizeBytes)||d.sizeBytes<=0||
    d.sizeBytes>maxSize(d.entityType)||d.mimeType!==mime(d.entityType)||!['pending','ready','failed'].includes(d.status)||
    d.entityKey!==d.entityType+':'+d.entityId||!validDriveId(d.driveId)||!validDriveId(d.folderId)) fail(503,'Referência documental inválida.');
  return d;
}
function publicRef(d:Stored) {
  const {id,entityType,entityId,filename,mimeType,sizeBytes,sha256,status,createdAt,version}=d;
  return {id,entityType,entityId,filename,mimeType,sizeBytes,sha256,status,createdAt,version};
}
function validDriveId(s:string){return /^[A-Za-z0-9_-]{5,200}$/.test(s);}
async function create(path:string,id:string,value:Record<string,string|number>):Promise<boolean> {
  const res=await db(path+'?documentId='+encodeURIComponent(id),{method:'POST',body:JSON.stringify({fields:encode(value)})});
  if(res.status===409)return false;
  if(!res.ok)fail(503,'Não foi possível reservar o documento.');
  return true;
}
async function setStatus(doc:RecordDoc,path:string,status:Stored['status']) {
  const res=await db(path+'?updateMask.fieldPaths=status&currentDocument.updateTime='+encodeURIComponent(doc.updateTime),{method:'PATCH',body:JSON.stringify({fields:encode({status})})});
  if(!res.ok&&![400,409,412].includes(res.status))fail(503,'Não foi possível confirmar o documento.');
  return res.ok;
}
async function driveRequest(token:string,url:string,init:RequestInit={}) {
  const h=new Headers(init.headers);h.set('Authorization','Bearer '+token);
  return fetch(url,{...init,headers:h,cache:'no-store',redirect:'error'});
}
async function driveJson<T>(token:string,url:string,init:RequestInit={}):Promise<T> {
  const res=await driveRequest(token,url,init);
  if(!res.ok) fail(res.status===401?403:503,'Drive indisponível ou sem autorização. Reconecte a conta autorizada.');
  return res.json() as Promise<T>;
}
async function checkedToken(m:CreditMember,request:Request):Promise<string> {
  manager(m);
  const token=request.headers.get('x-credit-drive-token')||'';
  if(!/^[A-Za-z0-9._~+\/=-]{20,4096}$/.test(token))fail(403,'Conecte o Google Drive do gestor.');
  const about=await driveJson<{user?:{emailAddress?:string}}>(token,drive+'/about?fields=user(emailAddress)');
  if(about.user?.emailAddress?.trim().toLowerCase()!==m.email.trim().toLowerCase()) fail(403,'A conta Drive não corresponde ao gestor autenticado.');
  return token;
}
async function generateId(token:string) {
  const r=await driveJson<{ids:string[]}>(token,drive+'/files/generateIds?count=1&space=drive');
  if(!validDriveId(r.ids?.[0]||''))fail(503,'Não foi possível reservar identificador no Drive.');
  return r.ids[0];
}
const metaFields='id,name,mimeType,size,parents,ownedByMe,trashed,appProperties,permissions(type,role)';
async function metadata(token:string,id:string):Promise<Metadata|null> {
  if(!validDriveId(id))fail(503,'Referência Drive inválida.');
  const res=await driveRequest(token,drive+'/files/'+id+'?fields='+encodeURIComponent(metaFields));
  if(res.status===404)return null;
  if(!res.ok)fail(503,'Não foi possível verificar a propriedade do documento.');
  return res.json();
}
function privateOwned(meta:Metadata|null,id:string,props:Record<string,string>):Metadata {
  if(!meta||meta.id!==id||meta.trashed||meta.ownedByMe!==true||!meta.permissions?.length||
    meta.permissions.some(p=>p.type!=='user'||p.role!=='owner')||
    Object.entries(props).some(([k,v])=>meta.appProperties?.[k]!==v)) {
    return fail(409,'Arquivo ou pasta não é privado, não pertence à conta autorizada ou possui vínculo divergente.');
  }
  return meta;
}
const folderProps=(m:CreditMember)=>({ownerApp:'EMPROVEX',creditUg:m.ug,creditRole:'root'});
async function ensureFolder(m:CreditMember,token:string) {
  const path=unit(m)+'/settings/storage';
  let config=await read(path);
  if(!config) {
    const folderId=await generateId(token);
    await create(unit(m)+'/settings','storage',{folderId,ownerEmail:m.email,provider:'google-drive',createdAt:new Date().toISOString()});
    config=await read(path);
  }
  if(!config) return fail(503,'Configuração documental indisponível.');
  const folderId=str(config,'folderId');
  if(str(config,'ownerEmail')!==m.email||!validDriveId(folderId)||str(config,'provider')!=='google-drive')fail(403,'A UG possui outra conta de armazenamento. Solicite a transferência segura antes de continuar.');
  let meta=await metadata(token,folderId);
  if(!meta) {
    const res=await driveRequest(token,drive+'/files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      id:folderId,name:'EMPROVEX - Controle de Crédito - UG '+m.ug,mimeType:folderMime,appProperties:folderProps(m)
    })});
    if(!res.ok&&res.status!==409)fail(503,'Não foi possível criar a pasta privada do Controle de Crédito.');
    meta=await metadata(token,folderId);
  }
  if(privateOwned(meta,folderId,folderProps(m)).mimeType!==folderMime)fail(409,'Pasta documental inválida.');
  return folderId;
}
export async function connectCreditStorage(m:CreditMember,request:Request){
  const token=await checkedToken(m,request);await ensureFolder(m,token);
}
const mime=(kind:Kind)=>kind==='nc'?'text/html':'application/pdf';
const maxSize=(kind:Kind)=>kind==='nc'?1_000_000:10*1024*1024;
function safeFilename(name:string,kind:Kind) {
  const base=name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9._ -]/g,'-').replace(/^\.+/,'').slice(0,130);
  const ext=kind==='nc'?'.html':'.pdf';
  return (base.replace(/\.(?:html?|pdf)$/i,'')||'documento')+ext;
}
type Entity = {id:string;number:string;fullNumber?:string;issuingUg?:string;issueDate:string;deadline?:string|null;description?:string;centerId?:string;supplierCnpj?:string;netCents?:number;totalCents?:number};
function asEntity(value:unknown,kind:Kind,id:string):Entity {
  if(!value||typeof value!=='object')return fail(404,'Registro financeiro não encontrado.');
  const obj=value as Record<string,unknown>;
  const wrapped=obj[kind==='nc'?'credit':'commitment']??obj;
  if(!wrapped||typeof wrapped!=='object')return fail(404,'Registro financeiro não encontrado.');
  const e=wrapped as Entity;
  if(e.id!==id||typeof e.number!=='string')return fail(404,'Registro financeiro não encontrado.');
  return e;
}
async function entity(m:CreditMember,kind:Kind,id:string) {
  const value=kind==='nc'?await getCredit(m,id):await getCommitment(m,id);
  const record=asEntity(value,kind,id);
  if(m.role==='centro'&&kind==='ne'&&record.centerId!==m.centerId)fail(404,'Registro financeiro não encontrado.');
  return record;
}
function normalizeNumber(s:string) {return s.toUpperCase().replace(/[^A-Z0-9]/g,'');}
function validateSource(bytes:Uint8Array,kind:Kind,m:CreditMember,e:Entity) {
  try {
    if(kind==='nc') {
      const parsed=parseSagCreditHtml(new TextDecoder('utf-8',{fatal:true}).decode(bytes),m.ug);
      if(normalizeNumber(parsed.number)!==normalizeNumber(e.number)||parsed.issuingUg!==e.issuingUg||parsed.beneficiaryUg!==m.ug)throw new Error();
    } else {
      if(Buffer.from(bytes.subarray(0,5)).toString('ascii')!=='%PDF-')throw new Error();
      // O anexo precisa passar pelas mesmas verificações de tamanho expandido,
      // estrutura, identidade e emissão original da importação financeira.
      const parsed=parseNe(bytes,m,true);
      if(parsed.ug!==m.ug||normalizeNumber(parsed.number)!==normalizeNumber(e.number)||parsed.issueDate!==e.issueDate||parsed.supplierCnpj.replace(/\D/g,'')!==e.supplierCnpj?.replace(/\D/g,''))throw new Error();
      if(parsed.netCents!==e.netCents)fail(422,'O valor do PDF difere do valor registrado. Use Substituir NE para atualizar o saldo, ou registre a anulação em Registrar ajuste.');
    }
  }catch(error) {if(error instanceof CreditAccessError)throw error;fail(422,'O arquivo original não corresponde à identidade do registro (UG, número, emissão ou favorecido). Confira o documento.');}
}
function fileProps(m:CreditMember,d:Stored) {return {ownerApp:'EMPROVEX',creditUg:m.ug,creditRole:'original',creditDocument:d.id,creditHash:d.sha256};}
async function verifyFile(m:CreditMember,token:string,d:Stored):Promise<Uint8Array> {
  const folder=privateOwned(await metadata(token,d.folderId),d.folderId,folderProps(m));
  if(folder.mimeType!==folderMime)fail(409,'Pasta documental inválida.');
  const meta=privateOwned(await metadata(token,d.driveId),d.driveId,fileProps(m,d));
  if(meta.mimeType!==d.mimeType||meta.name!==d.filename||Number(meta.size)!==d.sizeBytes||meta.parents?.length!==1||meta.parents[0]!==d.folderId)fail(409,'Metadados do arquivo divergem do registro.');
  const res=await driveRequest(token,drive+'/files/'+d.driveId+'?alt=media');
  if(!res.ok)fail(503,'Não foi possível conferir o arquivo no Drive.');
  const bytes=await boundedBytes(res.body,maxSize(d.entityType));
  if(bytes.byteLength!==d.sizeBytes||hash(bytes)!==d.sha256)fail(409,'A integridade SHA-256 do documento não foi confirmada.');
  return bytes;
}
async function boundedBytes(body:ReadableStream<Uint8Array>|null,max:number):Promise<Uint8Array> {
  if(!body)return fail(422,'Arquivo não informado.');
  const reader=body.getReader(),chunks:Uint8Array[]=[];let total=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>max){await reader.cancel();fail(422,'Arquivo excede o limite permitido.');}chunks.push(value);}}
  finally{reader.releaseLock();}
  return new Uint8Array(Buffer.concat(chunks,total));
}
export async function readDocumentForm(request:Request) {
  const limit=10*1024*1024+32*1024;
  const contentType=request.headers.get('content-type')||'';
  if(!/^multipart\/form-data;\s*boundary=/i.test(contentType))fail(422,'Envie um arquivo no formulário documental.');
  const bytes=await boundedBytes(request.body,limit);
  try{return await new Response(new Uint8Array(bytes),{headers:{'Content-Type':contentType}}).formData();}
  catch{return fail(422,'Formulário documental inválido.');}
}
export async function saveDocument(m:CreditMember,request:Request,form:FormData) {
  manager(m);
  const kind=documentKind(form.get('entityType')),id=documentEntityId(form.get('entityId')),file=form.get('file');
  if(!file||typeof file==='string'||file.size<=0||file.size>maxSize(kind)||file.type!==mime(kind))return fail(422,'Formato ou tamanho do documento inválido.');
  const record=await entity(m,kind,id);
  const bytes=new Uint8Array(await file.arrayBuffer());
  validateSource(bytes,kind,m,record);
  const sha256=hash(bytes),docId=hash(kind+':'+id+':'+sha256),path=unit(m)+'/documents/'+docId;
  const token=await checkedToken(m,request),folderId=await ensureFolder(m,token);
  let doc=await read(path);
  if(!doc) {
    await create(unit(m)+'/documents',docId,{
      id:docId,entityType:kind,entityId:id,entityKey:kind+':'+id,filename:safeFilename(file.name,kind),mimeType:mime(kind),
      sizeBytes:bytes.byteLength,sha256,status:'pending',createdAt:new Date().toISOString(),driveId:await generateId(token),
      folderId,ownerEmail:m.email,uploadedBy:m.uid,version:sha256,
    });
    doc=await read(path);
  }
  if(!doc)return fail(503,'Reserva documental indisponível.');
  const d=stored(doc);
  if(d.ownerEmail!==m.email||d.folderId!==folderId||d.id!==docId||d.sha256!==sha256||d.entityId!==id||d.entityType!==kind)fail(409,'Reserva documental divergente.');
  try {
    if(d.status!=='ready'&&!await metadata(token,d.driveId)) {
      const boundary='credit_'+hash(docId+Date.now()+Math.random());
      const meta={id:d.driveId,name:d.filename,mimeType:d.mimeType,parents:[folderId],appProperties:fileProps(m,d)};
      const body=Buffer.concat([Buffer.from('--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(meta)+'\r\n--'+boundary+'\r\nContent-Type: '+d.mimeType+'\r\n\r\n'),Buffer.from(bytes),Buffer.from('\r\n--'+boundary+'--')]);
      const res=await driveRequest(token,upload+'/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body:new Uint8Array(body)});
      if(!res.ok&&res.status!==409)fail(503,'O upload falhou. Tente novamente com o mesmo arquivo.');
    }
    await verifyFile(m,token,d);
    if(d.status!=='ready') {
      await setStatus(doc,path,'ready');
      const confirmed=await read(path);
      if(!confirmed||str(confirmed,'status')!=='ready')fail(409,'Confirmação concorrente. Repita a operação.');
    }
    return publicRef({...d,status:'ready'});
  } catch(e) {
    if(d.status!=='ready')await setStatus(doc,path,'failed').catch(()=>undefined);
    throw e;
  }
}
export async function listDocuments(m:CreditMember,kind:Kind,id:string) {
  const record=await entity(m,kind,id);
  // Centers receive no original metadata or Drive identifier; only a live, authorized projection.
  if(m.role==='centro')return [{id:'projection-'+kind+'-'+id,entityType:kind,entityId:id,filename:kind+'-consulta.pdf',mimeType:'application/pdf',status:'ready',generated:true}];
  const res=await db(unit(m)+':runQuery',{method:'POST',body:JSON.stringify({structuredQuery:{
    from:[{collectionId:'documents'}],where:{fieldFilter:{field:{fieldPath:'entityKey'},op:'EQUAL',value:{stringValue:kind+':'+record.id}}},limit:100
  }})});
  if(!res.ok)fail(503,'Não foi possível listar os documentos.');
  const rows=await res.json() as {document?:RecordDoc}[];
  return rows.flatMap(row=>row.document?[publicRef(stored(row.document))]:[]).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export async function downloadDocument(m:CreditMember,request:Request,id:string):Promise<Response> {
  const projection=/^projection-(nc|ne)-([A-Za-z0-9_-]{1,160})$/.exec(id);
  if(projection) {
    const kind=documentKind(projection[1]),e=await entity(m,kind,projection[2]);
    const lines=[{label:kind==='nc'?'Nota de crédito':'Nota de empenho',value:e.number},{label:'Emissão',value:displayDate(e.issueDate)}];
    if(kind==='nc')lines.push({label:'Prazo informado',value:displayDate(e.deadline)});
    if(kind==='ne'&&Number.isSafeInteger(e.netCents))lines.push({label:'Valor líquido',value:money(e.netCents!)});
    lines.push({label:'Origem',value:'Consulta reconstruída do registro autorizado; não é o documento original.'});
    const bytes=creditPdf(m,'Consulta documental',lines);
    return new Response(new Uint8Array(bytes),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="consulta.pdf"'}});
  }
  manager(m);
  if(!/^[a-f0-9]{64}$/.test(id))return fail(404,'Documento não encontrado.');
  const doc=await read(unit(m)+'/documents/'+id);
  if(!doc)return fail(404,'Documento não encontrado.');
  const d=stored(doc);
  await entity(m,d.entityType,d.entityId);
  if(d.id!==id||d.status!=='ready'||d.ownerEmail!==m.email)fail(404,'Documento não disponível para esta conta.');
  const token=await checkedToken(m,request);
  const bytes=await verifyFile(m,token,d);
  if(d.entityType==='nc'&&new URL(request.url).searchParams.get('format')==='pdf'){
    // Parse the verified original, never execute HTML or make remote requests for its assets.
    const parsed=parseSagCreditHtml(new TextDecoder('utf-8',{fatal:true}).decode(bytes),m.ug);
    const lines=[{label:'Nota de crédito',value:parsed.fullNumber},{label:'UG emitente',value:parsed.issuingUg},{label:'UG favorecida',value:parsed.beneficiaryUg},{label:'Emissão',value:displayDate(parsed.issueDate)},{label:'Prazo original',value:displayDate(parsed.deadline)},{label:'Operação',value:parsed.operation},{label:'Descentralização',value:parsed.decentralization},{label:'Sistema de origem',value:parsed.sourceSystem},{label:'Total do documento',value:money(parsed.documentTotalCents)},{label:'Total favorecido',value:money(parsed.totalCents)}];
    for(let i=0;i<parsed.description.length;i+=800)lines.push({label:'Finalidade',value:parsed.description.slice(i,i+800)});
    for(const seq of parsed.sequences){lines.push({label:'Sequencial '+seq.sequence,value:money(seq.totalCents)});for(const [label,rows] of [['Origem',seq.origin],['Destino',seq.destination]] as const){for(const cell of rows)lines.push({label,value:'UG '+cell.ug+' | Item '+cell.item+' | Num '+cell.num+' | Esfera '+cell.esfera+' | PTRES '+cell.ptres+' | Fonte '+(cell.fonte||'Não informada')+' | ND '+cell.nd+' | UGR '+cell.ugr+' | PI '+(cell.pi||'Não informado')+' | '+money(cell.cents)});}}
    lines.push({label:'Integridade',value:'SHA-256 do HTML: '+d.sha256},{label:'Natureza',value:'PDF textual reconstruído do HTML original; não é reprodução oficial do layout SAG.'});
    return creditPdfResponse(creditPdf(m,'Nota de Crédito — conversão textual do SAG',lines),safeFilename(d.filename,'nc').replace(/\\.html$/i,'.pdf'));
  }
  return new Response(new Uint8Array(bytes),{headers:{...headers,
    'Content-Type':d.entityType==='ne'?'application/pdf':'application/octet-stream','Content-Disposition':'attachment; filename="'+safeFilename(d.filename,d.entityType)+'"',
    'Content-Security-Policy':"default-src 'none'; sandbox",
  }});
}
