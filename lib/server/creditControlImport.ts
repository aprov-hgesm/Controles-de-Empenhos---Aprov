import { NextResponse } from 'next/server';
import { inflateSync } from 'node:zlib';
import { CreditAccessError, type CreditMember } from './creditControlAuth';
import { FounderAuthError } from './firebaseFounderAuth';
import { CreditStoreError } from './creditControlFirestore';
import { parseSagCreditHtml } from '@/lib/controle-credito/sagCreditHtml.mjs';
import { parseSagCommitmentHtml } from '@/lib/controle-credito/sagCommitmentHtml.mjs';
import { parseEmpenhoPdfBytes } from './empenhoPdfParser';
import type { CreateCreditInput, CreateCommitmentInput } from '@/lib/controle-credito/contracts';
import type { SagHtmlCreditDraft } from '@/lib/controle-credito/sagCreditHtml.mjs';

export class CreditImportError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function invalid(message: string, code = 'INVALID_INPUT'): never {
  throw new CreditImportError(422, code, message);
}
export function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export function failure(error: unknown) {
  if (error instanceof CreditImportError || error instanceof CreditStoreError) return response({ error: error.message, code: error.code }, error.status);
  if (error instanceof CreditAccessError || error instanceof FounderAuthError) {
    return response({ error: error.message, code: error.status === 401 ? 'AUTH_REQUIRED' : error.status === 403 ? 'ACCESS_DENIED' : 'ACCESS_UNAVAILABLE' }, error.status);
  }
  // Store errors follow the shared HTTP contract. Do not expose arbitrary messages.
  const status = (error as {status?: unknown} | null)?.status;
  const messages: Record<number, [string,string]> = {
    401: ['AUTH_REQUIRED','Sessão inválida. Entre novamente.'],
    403: ['ACCESS_DENIED','Perfil não autorizado para esta operação.'],
    404: ['NOT_FOUND','Registro não localizado ou não acessível.'],
    409: ['FINANCE_CONFLICT','Conflito financeiro ou de revisão. Atualize os dados e confira saldo, vínculo e duplicidade.'],
    422: ['FINANCE_INVALID','Dados financeiros incompatíveis. Confira os campos e os vínculos.'],
    503: ['UNAVAILABLE','Serviço temporariamente indisponível.'],
  };
  const safe = typeof status === 'number' ? messages[status] : undefined;
  return response({error:safe?.[1] ?? 'Não foi possível concluir a operação.', code:safe?.[0] ?? 'UNAVAILABLE'}, safe ? Number(status) : 503);
}
export const NC_MAX = 1_000_000;
export const NE_MAX = 10 * 1024 * 1024;
export async function readBounded(request: Request, max: number): Promise<Uint8Array> {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > max)) throw new CreditImportError(413,'FILE_TOO_LARGE','Arquivo excede o limite permitido.');
  if (!request.body) invalid('Conteúdo não informado.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel();
        throw new CreditImportError(413,'FILE_TOO_LARGE','Arquivo excede o limite permitido.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!total) invalid('Conteúdo vazio.');
  return Buffer.concat(chunks,total);
}
export type Input = Record<string, unknown>;
export function object(value: unknown): Input {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid('Dados inválidos.');
  return value as Input;
}
export async function json(request: Request, max = 64 * 1024): Promise<Input> {
  const bytes = await readBounded(request,max);
  try { return object(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))); }
  catch { return invalid('JSON inválido.'); }
}
export function string(value: unknown, label: string, max = 2000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) invalid(label+' inválido.');
  return value.trim();
}
export function pattern(value: unknown, label: string, re: RegExp): string {
  const result = string(value,label,128);
  if (!re.test(result)) invalid(label+' inválido.');
  return result;
}
export function integer(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) invalid(label+' inválido.');
  return value;
}
export function optionalRevision(value: unknown) {
  return value === undefined ? undefined : integer(value,'Revisão',0);
}
export function optionalAck(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') invalid('Confirmação de déficit inválida.');
  return value;
}
export function id(value: unknown) {
  return pattern(value,'Identificador',/^[A-Za-z0-9_-]{1,128}$/);
}
export function date(value: unknown, label: string): string {
  const iso = pattern(value,label,/^20\d{2}-\d{2}-\d{2}$/);
  const time = Date.parse(iso+'T00:00:00Z');
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0,10)!==iso) invalid(label+' inválida.');
  return iso;
}
export function deadline(value: unknown, issueDate?: string) {
  if (value === null) return null;
  const d = date(value,'Prazo');
  if (issueDate && d < issueDate) invalid('Prazo anterior à emissão.');
  return d;
}
export function allocations(value: unknown) {
  if (!Array.isArray(value) || value.length > 100) invalid('Rateio inválido.');
  const seen = new Set<string>(); let sum = 0;
  return value.map(raw => {
    const a = object(raw), centerId = pattern(a.centerId,'Centro de custos',/^[A-Za-z0-9_-]{1,64}$/);
    const basisPoints = integer(a.basisPoints,'Percentual em pontos-base',0,10000);
    sum += basisPoints;
    if (seen.has(centerId) || sum > 10000) invalid('Rateio duplicado ou superior a 100%.');
    seen.add(centerId);
    return {centerId,basisPoints};
  });
}
export function fileFromDraft(draft: Input, max: number): Uint8Array {
  const value = draft.fileBase64;
  if (typeof value !== 'string' || value.length > 4*Math.ceil(max/3) || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) invalid('Reenvie o arquivo original para confirmar a importação.','ORIGINAL_REQUIRED');
  const bytes = Buffer.from(value,'base64');
  if (!bytes.length || bytes.length > max || bytes.toString('base64') !== value) invalid('Arquivo original inválido.','ORIGINAL_INVALID');
  return bytes;
}
export function parseNc(bytes: Uint8Array, member: CreditMember): SagHtmlCreditDraft {
  try {
    const result = parseSagCreditHtml(new TextDecoder('utf-8',{fatal:true}).decode(bytes),member.ug);
    if (result.issueDate.slice(0,4) !== result.number.slice(0,4)) invalid('Exercício da NC incompatível com emissão.');
    return result;
  } catch {
    return invalid('HTML SAG inválido, divergente, não destinado à UG ou operação não suportada. Confira o original.','NC_IMPORT_INVALID');
  }
}
// Preflight matches the stream/object extraction used by the existing parser.
// Bound inflation before allocation; reject incomplete/unsupported streams rather than silently skipping them.
function checkPdf(bytes: Uint8Array,updated=false) {
  const binary = Buffer.from(bytes).toString('latin1');
  if (!binary.startsWith('%PDF-') || /\/Encrypt\b/.test(binary)) invalid('Selecione uma NE SIAFI em PDF não criptografado.','NE_FORMAT');
  let total = 0, count = 0, summaries = 0;
  for (const match of binary.matchAll(/(\d+)\s+0\s+obj\b([\s\S]*?)\bendobj\b/g)) {
    if (++count > 10000) invalid('PDF com estrutura excessiva.','NE_LIMIT');
    const body = match[2], marker = body.indexOf('stream'), end = body.lastIndexOf('endstream');
    if (marker < 0 || end <= marker) continue;
    const dictionary = body.slice(0,marker);
    if (/\/Subtype\s*\/Image\b|\/FontFile[23]?\b|\/Type\s*\/(?:ObjStm|XRef)\b/.test(dictionary)) continue;
    let start = marker+6, stop = end;
    if (body.slice(start,start+2)==='\r\n') start+=2; else if (/[\r\n]/.test(body[start]||'')) start++;
    if (body.slice(stop-2,stop)==='\r\n') stop-=2; else if (/[\r\n]/.test(body[stop-1]||'')) stop--;
    let decoded = Buffer.from(body.slice(start,stop),'latin1');
    if (/\/Filter\b/.test(dictionary)) {
      if (!/\/Filter\s*\/FlateDecode\b/.test(dictionary)) invalid('Compressão PDF não suportada.','NE_FORMAT');
      try { decoded = inflateSync(decoded,{maxOutputLength:4*1024*1024}); }
      catch { invalid('Conteúdo PDF inválido ou acima do limite de descompressão.','NE_LIMIT'); }
    }
    total += decoded.length;
    if (decoded.length > 4*1024*1024 || total > 24*1024*1024) invalid('Conteúdo PDF excede o limite seguro.','NE_LIMIT');
    const text = decoded.toString('latin1');
    if (!text.includes('BT') || (!text.includes('Tj') && !text.includes('TJ'))) continue;
    // The shared parser scans literal strings and arrays. Ensure they terminate,
    // and cap individual arrays to bound its repeated string conversion.
    let literal = 0, array = -1;
    for (let i=0;i<text.length;i++) {
      const c=text[i];
      if (literal) {
        if (c==='\\') i++;
        else if (c==='(') literal++;
        else if (c===')') literal--;
      } else if (c==='(') literal=1;
      else if (c==='[') {
        if (array>=0) invalid('Estrutura de texto PDF não suportada.','NE_FORMAT');
        array=i;
      } else if (c===']') array=-1;
      if (array>=0 && i-array>65536) invalid('Texto PDF excede o limite seguro.','NE_LIMIT');
    }
    const compact=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
    if(compact.includes('notadeempenho') && compact.includes('celulaorcamentaria') && !compact.includes('listadeitens') && ++summaries>1) invalid('PDF contém múltiplas notas ou células; concilie antes de registrar.','NE_MULTIPLE_SUMMARIES');
    if (literal || array>=0) invalid('Texto PDF incompleto.','NE_FORMAT');
    if (!updated && /\b(?:anula[cç][aã]o|refor[cç]o|cancelamento)\b/i.test(text.normalize('NFD').replace(/[\u0300-\u036f]/g,''))) {
      invalid('PDF contém indicação de ajuste. Use a conciliação de movimentações.','NE_MOVEMENT_REQUIRED');
    }
  }
}
function decimalCents(value: number): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) invalid('Valor da NE não representa centavos inteiros.','NE_AMOUNT');
  return integer(Number(match[1]+(match[2]??'').padEnd(2,'0')),'Valor da NE',1);
}
export function parseNe(bytes: Uint8Array, member: CreditMember, updated=false) {
  if(!Buffer.from(bytes.subarray(0,5)).equals(Buffer.from('%PDF-'))){
    if(updated) invalid('Use a impressão PDF consolidada para substituir uma NE existente.','NE_FORMAT');
    if(bytes.length>NC_MAX) invalid('HTML excede o limite permitido.','NE_LIMIT');
    try{return parseSagCommitmentHtml(new TextDecoder('utf-8',{fatal:true}).decode(bytes),member.ug);}
    catch{return invalid('HTML de NE SAG inválido, UG incompatível, valores divergentes ou operação não suportada. Confira o original.','NE_IMPORT_INVALID');}
  }
  checkPdf(bytes,updated);
  let result: ReturnType<typeof parseEmpenhoPdfBytes>;
  try { result = parseEmpenhoPdfBytes(bytes); }
  catch { return invalid('NE SIAFI não reconhecida. Utilize a impressão completa.','NE_IMPORT_INVALID'); }
  if (result.ug !== member.ug) invalid('UG da NE incompatível com a sessão.','NE_UG');
  const match = /^(20\d{2})NE(\d{1,6})$/.exec(result.id);
  const d = /^(\d{2})\/(\d{2})\/(20\d{2})$/.exec(result.date);
  if (!match || !d || match[1]!==d[3]) invalid('Número, exercício ou data da NE inválidos.','NE_IDENTITY');
  const issueDate = date(d[3]+'-'+d[2]+'-'+d[1],'Emissão');
  const type = result.tipoEmpenho.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  if (!/^(ORDINARIO|ESTIMATIVO|GLOBAL)$/.test(type)) invalid('Tipo de NE não reconhecido como emissão original. Utilize a conciliação.','NE_MOVEMENT_REQUIRED');
  const netCents = decimalCents(result.valorTotal);
  const warnings = result.warnings.filter(w=>!/(unidade de fornecimento|número da contratação não identificado|classe do empenho não foi inferida)/i.test(w));
  for (const [label,value,re] of [
    ['ND',result.naturezaDespesa,/^\d{6}$/],
    ['PTRES',result.ptres,/^\d{6}$/],
    ['Fonte',result.fonteRecurso,/^\d{10}$/],
    ['UGR',result.ugr,/^\d{6}$/],
    ['PI',result.planoInterno,/^[A-Z0-9]{1,20}$/],
  ] as const) if (!value || !re.test(value)) warnings.push(label+' ausente ou inválido; confirme no original.');
  return {...result, number:match[1]+'NE'+match[2].padStart(6,'0'),issueDate,netCents,warnings,requiresReview:true as const};
}
function cell(raw: unknown, member: CreditMember) {
  const c=object(raw);
  if (c.ug!==undefined && c.ug!==member.ug) invalid('UG da célula incompatível.');
  return {
    ug:member.ug,item:pattern(c.item,'Item',/^\d{1,20}$/),num:pattern(c.num,'Número',/^\d{1,20}$/),
    esfera:pattern(c.esfera,'Esfera',/^\d{1,3}$/),ptres:pattern(c.ptres,'PTRES',/^\d{6}$/),
    fonte:pattern(c.fonte,'Fonte',/^\d{10}$/),nd:pattern(c.nd,'ND',/^\d{6}$/),
    ugr:pattern(c.ugr,'UGR',/^\d{6}$/),pi:pattern(c.pi,'PI',/^[A-Z0-9]{1,20}$/),
    cents:integer(c.cents,'Valor da célula',1),
  };
}
function sum(values: number[]) {
  return values.reduce((a,b)=>integer(a+b,'Total',1),0);
}
export function manualNc(draft: Input, member: CreditMember): SagHtmlCreditDraft {
  const number=pattern(draft.number,'Número da NC',/^20\d{2}NC\d{6}$/);
  const issuingUg=pattern(draft.issuingUg,'UG emitente',/^\d{6}$/);
  const fullNumber=pattern(draft.fullNumber,'Número completo da NC',/^\d+20\d{2}NC\d{6}$/);
  if (!fullNumber.startsWith(issuingUg)||!fullNumber.endsWith(number)) invalid('Identificadores da NC divergentes.');
  if (draft.beneficiaryUg!==undefined && draft.beneficiaryUg!==member.ug) invalid('UG favorecida incompatível.');
  const issueDate=date(draft.issueDate,'Emissão');
  if(issueDate.slice(0,4)!==number.slice(0,4)) invalid('Exercício incompatível com emissão.');
  if (!Array.isArray(draft.sequences)||!draft.sequences.length||draft.sequences.length>100) invalid('Informe os sequenciais da NC.');
  const seen=new Set<string>();
  const sequences=draft.sequences.map(raw=>{
    const s=object(raw),sequence=pattern(s.sequence,'Sequencial',/^\d{1,20}$/);
    if(seen.has(sequence)) invalid('Sequencial duplicado.');
    seen.add(sequence);
    if (!Array.isArray(s.destination)||!s.destination.length||s.destination.length>100||
        !Array.isArray(s.origin)||!s.origin.length||s.origin.length>100) invalid('Informe células de origem e destino.');
    const origin=s.origin.map(c=>cell(c,member)),destination=s.destination.map(c=>cell(c,member));
    const totalCents=sum(destination.map(c=>c.cents));
    if(sum(origin.map(c=>c.cents))!==totalCents) invalid('Origem e destino têm valores divergentes.');
    return {sequence,totalCents,origin,destination};
  });
  const totalCents=sum(sequences.map(s=>s.totalCents));
  const documentTotalCents=integer(draft.documentTotalCents,'Total do documento',totalCents);
  if(draft.totalCents!==undefined&&draft.totalCents!==totalCents) invalid('Total das células divergente.');
  if(draft.operation!=='DESCENTRALIZACAO'||draft.decentralization!=='PROVISAO') invalid('Ajustes de crédito exigem movimentação separada.');
  return {number,fullNumber,issuingUg,beneficiaryUg:member.ug,issueDate,
    operation:'DESCENTRALIZACAO',decentralization:'PROVISAO',sourceSystem:'MANUAL',
    description:string(draft.description,'Descrição'),deadline:deadline(draft.deadline,issueDate),
    documentTotalCents,totalCents,sequences,warnings:[],requiresReview:true};
}
export function confirmNc(body: Input, member: CreditMember): CreateCreditInput {
  const draft=object(body.draft);
  const source=body.source;
  if(source!=='html'&&source!=='manual') invalid('Origem da NC inválida.');
  const parsed=source==='html'?parseNc(fileFromDraft(draft,NC_MAX),member):manualNc(draft,member);
  // Imported amounts/identity are immutable. Resolve only missing PI, by explicit
  // sequence and row index; never accept arbitrary replacement of parsed rows.
  if(source==='html' && draft.piCorrections!==undefined) {
    if(!Array.isArray(draft.piCorrections)||draft.piCorrections.length>100) invalid('Correções de PI inválidas.');
    for(const raw of draft.piCorrections) {
      const c=object(raw),s=parsed.sequences.find(s=>s.sequence===c.sequence);
      const row=integer(c.row,'Linha',0,10000);
      const target=s?.destination[row];
      if(!target||target.pi) invalid('Correção permitida somente para PI ausente.');
      target.pi=pattern(c.pi,'PI',/^[A-Z0-9]{1,20}$/);
    }
  }
  if(parsed.sequences.some(s=>s.destination.some(c=>!c.pi))) invalid('Confirme os PIs de destino ausentes.','NC_PI_REQUIRED');
  const description=body.description===undefined?string(parsed.description,'Descrição'):string(body.description,'Descrição');
  const due=body.deadline===undefined?parsed.deadline:deadline(body.deadline,parsed.issueDate);
  const adminDeadline=body.adminDeadline===undefined?null:deadline(body.adminDeadline,parsed.issueDate);
  if(adminDeadline&&due&&adminDeadline>=due)invalid('Prazo administrativo deve anteceder o prazo da NC.');
  const {warnings: _warnings, requiresReview: _review, ...record}=parsed;
  return {source,draft:{...record,description,deadline:due},allocations:allocations(body.allocations),deadline:due,adminDeadline,description,expectedRevision:optionalRevision(body.expectedRevision)};
}
export function confirmNe(body: Input, member: CreditMember): CreateCommitmentInput {
  const draft=object(body.draft);
  if(body.source==='manual'){
    const number=pattern(draft.number,'Número da NE',/^20\d{2}NE\d{6}$/);
    const issueDate=date(draft.issueDate,'Emissão');
    const supplierCnpj=string(draft.supplierCnpj,'CNPJ/CPF').replace(/[.\/-]/g,'');
    if(!/^(?:\d{11}|\d{14})$/.test(supplierCnpj))invalid('Informe o CPF ou CNPJ do favorecido.');
    return {draft:{number,ug:member.ug,issueDate,description:string(draft.description,'Finalidade'),supplier:string(draft.supplier,'Fornecedor'),supplierCnpj,netCents:integer(draft.netCents,'Valor líquido',1),nd:pattern(draft.nd,'ND',/^\d{6}$/),ptres:pattern(draft.ptres,'PTRES',/^\d{6}$/),fonte:pattern(draft.fonte,'Fonte',/^\d{10}$/),ugr:pattern(draft.ugr,'UGR',/^\d{6}$/),pi:pattern(draft.pi,'PI',/^[A-Z0-9]{1,20}$/)},creditId:id(body.creditId),centerId:pattern(body.centerId,'Centro',/^[A-Za-z0-9_-]{1,64}$/),cellId:id(body.cellId),acknowledgeDeficit:optionalAck(body.acknowledgeDeficit),acknowledgeBudgetDifference:body.acknowledgeBudgetDifference===true,expectedCreditRevision:optionalRevision(body.expectedCreditRevision)};
  }
  const parsed=parseNe(fileFromDraft(draft,NE_MAX),member);
  const confirmed= draft.budget === undefined ? {} : object(draft.budget);
  function field(extracted: string|null, key: string, label: string, re: RegExp) {
    if(extracted&&re.test(extracted)) {
      if(confirmed[key]!==undefined && confirmed[key]!==extracted) invalid(label+' divergente do PDF.');
      return extracted;
    }
    return pattern(confirmed[key],label,re);
  }
  const nd=field(parsed.naturezaDespesa,'nd','ND',/^\d{6}$/),
    ptres=field(parsed.ptres,'ptres','PTRES',/^\d{6}$/),
    fonte=field(parsed.fonteRecurso,'fonte','Fonte',/^\d{10}$/),
    ugr=field(parsed.ugr,'ugr','UGR',/^\d{6}$/),
    pi=field(parsed.planoInterno,'pi','PI',/^[A-Z0-9]{1,20}$/);
  // Reconcile ambiguous amounts before registration; never let a supplied amount override PDF.
  if(parsed.warnings.some(w=>/diverge|divergência/i.test(w))) invalid('Valores do PDF divergentes. Concilie antes de registrar.','NE_AMOUNT_CONFLICT');
  return {
    draft:{number:parsed.number,ug:member.ug,issueDate:parsed.issueDate,description:string(parsed.description,'Descrição'),
      supplier:string(parsed.supplier,'Fornecedor'),supplierCnpj:pattern(parsed.supplierCnpj,'CNPJ',/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/),
      netCents:parsed.netCents,nd,ptres,fonte,ugr,pi},
    creditId:id(body.creditId),centerId:pattern(body.centerId,'Centro',/^[A-Za-z0-9_-]{1,64}$/),
    cellId:id(body.cellId),acknowledgeDeficit:optionalAck(body.acknowledgeDeficit),acknowledgeBudgetDifference:body.acknowledgeBudgetDifference===true,
    expectedCreditRevision:optionalRevision(body.expectedCreditRevision),
  };
}
