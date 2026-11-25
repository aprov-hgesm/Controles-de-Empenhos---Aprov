import type { User } from 'firebase/auth';
import { creditAuth as auth } from '@/features/controle-credito/auth/creditFirebase';
import type { SagHtmlCreditDraft, SagHtmlCreditSequence } from '@/lib/controle-credito/sagCreditHtml.mjs';
import type { SagCreditCell } from '@/lib/controle-credito/sagCreditText';
import type { ParsedEmpenhoPdfResult } from '@/lib/server/empenhoPdfParser';
import type { CreditAllocation, calculateCreditBalance } from '@/lib/controle-credito/creditBalance';

export type Member = { uid:string; email:string; ug:string; role:'gestor'|'centro'; centerId:string|null; active?:boolean };
export type Center = { id:string; name:string; active:boolean };
export type Cell = SagCreditCell & {cellId?:string; availableCents?:number; committedCents?:number};
export type Credit = Omit<SagHtmlCreditDraft,'warnings'|'requiresReview'|'sequences'|'documentTotalCents'> & {
  id:string; revision:number; createdAt:string; updatedAt:string; allocations:CreditAllocation[]; documentTotalCents:number|null; cells?:Cell[];
  sequences:(Omit<SagHtmlCreditSequence,'destination'> & {destination:Cell[]})[];
};
export type Commitment = {id:string;number:string;creditId:string;centerId:string;cellId:string;ug:string;issueDate:string;description:string;supplier:string;supplierCnpj:string;netCents:number;revision:number;createdAt:string;updatedAt:string;budgetDifferences?:{field:string;credit:string|null;commitment:string|null}[]};
export type Balance = ReturnType<typeof calculateCreditBalance>;
export type FinanceView = {
  member:Member; totals:{creditCents:number;committedCents:number;availableCents:number;creditCount:number;commitmentCount:number;noCommitmentsCount:number;unallocatedCents?:number};
  credits:(Credit & {balance:Balance})[];commitments:Commitment[];centers:Center[];alerts:unknown;nextCursor?:string|null;
};
export type Preview<T> = {result:T; draftToken?:string; token?:string; proof?:unknown};
export type NcPreview = Preview<SagHtmlCreditDraft>;
export type NePreview = Preview<ParsedEmpenhoPdfResult>;
export type DocumentInfo={id:string;entityType:'nc'|'ne';entityId:string;filename:string;mimeType:string;sizeBytes:number;sha256:string;status:'pending'|'ready'|'failed';createdAt:string};

const root='/api/controle-credito';
const fallback:Record<number,string>={
  401:'Sessão expirada. Entre novamente.',403:'Seu perfil não possui autorização para esta operação.',
  404:'Registro não encontrado ou indisponível para seu perfil.',409:'O registro foi alterado ou já existe. Atualize os dados e confira antes de tentar novamente.',
  413:'O arquivo excede o tamanho permitido.',422:'Confira os dados informados.',503:'Serviço temporariamente indisponível. Tente novamente.'
};
export class CreditApiError extends Error {
  constructor(public status:number, message:string, public code?:string){super(message);this.name='CreditApiError';}
}
function assertIdentity(user:User,signal:AbortSignal){
  if(signal.aborted||auth.currentUser?.uid!==user.uid)throw new DOMException('Operação cancelada','AbortError');
}
export function cancelled(error:unknown){return error instanceof Error&&error.name==='AbortError';}
export function errorText(error:unknown){return error instanceof CreditApiError?error.message:error instanceof Error?error.message:'Não foi possível concluir a operação.';}
async function request(user:User,path:string,signal:AbortSignal,init:RequestInit={}){
  assertIdentity(user,signal);
  const token=await user.getIdToken();
  assertIdentity(user,signal);
  const headers=new Headers(init.headers);
  headers.set('Authorization','Bearer '+token);
  const response=await fetch(root+path,{...init,headers,signal,cache:'no-store'});
  assertIdentity(user,signal);
  if(!response.ok){
    const data=await response.json().catch(()=>null);
    assertIdentity(user,signal);
    throw new CreditApiError(response.status,typeof data?.error==='string'?data.error:fallback[response.status]||'Não foi possível concluir a operação.',typeof data?.code==='string'?data.code:undefined);
  }
  return response;
}
export async function api<T>(user:User,path:string,signal:AbortSignal,init:RequestInit={}):Promise<T>{
  const response=await request(user,path,signal,init);
  const result=await response.json() as T;
  assertIdentity(user,signal);
  return result;
}
export function json(method:string,data:unknown):RequestInit{return {method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)};}
export function query(values:Record<string,string|undefined>){const params=new URLSearchParams();Object.entries(values).forEach(([key,value])=>{if(value)params.set(key,value);});return '?'+params.toString();}
export function importDocument<T>(user:User,kind:'nc'|'ne',file:File,signal:AbortSignal,updated=false,beneficiaryUg?:string){
  return api<Preview<T>>(user,'/importacao'+query({updated:updated?'1':undefined,beneficiaryUg}),signal,{method:'POST',headers:{'x-credit-document-kind':kind},body:file});
}
export async function download(user:User,path:string,filename:string,signal:AbortSignal){
  const response=await request(user,path,signal);
  const blob=await response.blob();
  assertIdentity(user,signal);
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);
  link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export function localDate(value:string|null|undefined){return value?(/^\d{4}-\d{2}-\d{2}$/.test(value)?value.split('-').reverse().join('/'):value):'Não informado';}
export function isoDate(value:string){return /^\d{2}\/\d{2}\/\d{4}$/.test(value)?value.split('/').reverse().join('-'):value;}
export const currentYear=()=>new Intl.DateTimeFormat('pt-BR',{year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date());
export function cents(value:string){if(!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim()))throw new Error('Informe um valor válido, com até duas casas decimais.');const [whole,fraction='']=value.trim().replace(',','.').split('.');const n=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n<=0)throw new Error('O valor deve ser positivo.');return n;}
export function cells(credit:Pick<Credit,'sequences'|'cells'>){if(credit.cells)return credit.cells;return credit.sequences.flatMap(s=>s.destination.map((cell,index)=>({...cell,cellId:cell.cellId??s.sequence+':'+index})));}
