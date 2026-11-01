/**
 * W5 integration QA: synthetic W2 -> trusted W3 -> A4 W4; never calls a real
 * warehouse server or SISCOFIS. Runtime module imports are explicit mocks.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
import * as zlib from 'node:zlib';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { jsPDF } from 'jspdf';

const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const location={
  normalizeWarehouseLocationQuantity(v){
    if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e9)return null;
    const n=Math.round(v*1e6)/1e6;return Math.abs(v-n)>1e-9?null:n;
  },
  warehouseStockPositionKey(p){return p.kind==='UNASSIGNED'?'UNASSIGNED':
    p.kind+':'+p.depotId+':'+p.locationId+(p.kind==='SUBPOSITION'?':'+p.subpositionId:'');},
};
const bulk={
  bulkMaterialDescriptionKey:v=>v.toLowerCase().trim().replace(/\s+/g,' '),
  bulkMaterialUnitKey:v=>{
    const x=String(v).toUpperCase().trim();
    return ['UN','UND','UNIDADE','UNIT'].includes(x)?'unit':x==='KG'?'kg':x;
  },
};
const contracts={ALMOX_REQUEST_SCHEMA_VERSION:'almox_request_v1',
  ALMOX_PLAN_SCHEMA_VERSION:'almox_separation_plan_v1',
  ALMOX_SHEET_SCHEMA_VERSION:'almox_separation_sheet_v1'};
const cache=new Map();
function load(path){
  if(cache.has(path))return cache.get(path);
  const exports={};cache.set(path,exports);
  const compiled=ts.transpileModule(read(path),{compilerOptions:{
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true,
  },reportDiagnostics:true});
  assert.equal(compiled.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
  const require=id=>{
    const modules={
      'node:crypto':crypto,'node:zlib':zlib,'pdf-lib':{PDFDocument},
      './contracts':contracts,'../warehouse/location':location,
      '../warehouse/bulkStockMaterialMatcher':bulk,
      '../../../lib/pdfToolkit':{loadJsPdf:async()=>jsPDF},
      '../../../lib/almoxarifado/contracts':contracts,
    };
    if(id in modules)return modules[id];
    const same={'./siscofisRequestTxt':'siscofisRequestTxt',
      './siscofisRequestPdf':'siscofisRequestPdf',
      './siscofisRequestParser':'siscofisRequestParser',
      './materialMatch':'materialMatch','./positionPlanner':'positionPlanner'};
    if(id in same)return load('lib/almoxarifado/'+same[id]+'.ts');
    throw new Error('unexpected W5 dependency '+path+': '+id);
  };
  runInNewContext(compiled.outputText,{exports,require,Buffer,Uint8Array,TextDecoder,Date,
    Map,Set,Number,Object,Array,JSON},{filename:path});
  return exports;
}
const w5=load('lib/almoxarifado/integration.ts');
const w3=load('lib/almoxarifado/positionPlanner.ts');
const w4=load('features/almoxarifado/pdf/SeparationSheet.ts');
const ws='almox-qa',ug='160416',uid='uid-almox';
const matId='mat_'+'a'.repeat(32),depId='dep_'+'b'.repeat(32);
const locId='loc_'+'c'.repeat(32),loc2='loc_'+'d'.repeat(32);
const p1={kind:'LOCATION',depotId:depId,locationId:locId,subpositionId:null};
const p2={kind:'LOCATION',depotId:depId,locationId:loc2,subpositionId:null};
const access={uid,workspaceId:ws,ug,sectorType:'almoxarifado'};
const material={schemaVersion:'warehouse_material_v1',id:matId,workspaceId:ws,ug,
  description:'PAPEL A4',aliases:[],unit:{code:'unit',label:null},status:'active',conversions:[]};
const depot={schemaVersion:'warehouse_depot_v1',id:depId,workspaceId:ws,ug,
  code:'DEP-01',name:'Depósito 01',status:'active'};
const local=(id,code)=>({schemaVersion:'warehouse_location_v1',id,workspaceId:ws,ug,
  depotId:depId,kind:'LOCAL',parentLocationId:null,status:'active',code,name:code});
const balance=(position,quantity=10,revision=1)=>({workspaceId:ws,ug,
  id:'locbal_qa',materialId:matId,position,quantity,revision});
const map={workspaceId:ws,sourceItemCode:'ABC-1',sourceUnit:'UN',materialId:matId,
  factorToBaseUnit:1,revision:1,approvedByUid:'uid-approver',approvedAt:'2026-10-31'};
const fixture='SISCOFIS|PEDIDO_DE_MATERIAL|EMPROVEX_FIXTURE_R1\n'
  +'Pedido: QA-2026-001\nSolicitante: OM TESTE\nData: 31/10/2026\n'
  +'Item|Codigo|Descricao|Qtd Solicitada|Unidade\n1|ABC-1|PAPEL A4|8|UN\nFIM_ITENS\n';
const bytes=text=>new Uint8Array(Buffer.from(text,'utf8'));
const snapshot=(overrides={})=>({
  materials:[material],depots:[depot],locations:[local(locId,'EST-01'),local(loc2,'EST-02')],
  balances:[balance(p1)],correspondences:[map],previousImports:[],...overrides,
});
const preview=(overrides={})=>w5.previewAlmoxSyntheticRequest({access,
  source:bytes(fixture),format:'TXT',filename:'synthetic.txt',organizationName:'OM TESTE',
  snapshot:snapshot(),...overrides});
async function syntheticPdf(){
  const document=await PDFDocument.create();const page=document.addPage([595,842]);
  const font=await document.embedFont(StandardFonts.Helvetica);
  fixture.trimEnd().split('\n').forEach((line,i)=>page.drawText(line,{x:30,y:800-i*21,size:10,font}));
  return new Uint8Array(await document.save({useObjectStreams:false}));
}
test('W2 TXT -> W3 vinculo autorizado -> W4 PDF A4 sem mutacao',async()=>{
  const stock=snapshot(),before=JSON.stringify(stock);
  const r=await preview({snapshot:stock});assert.equal(r.ok,true);
  assert.equal(r.request.rows[0].matchStatus,'CONFIRMED');
  assert.equal(r.plan.status,'PLANNED');assert.equal(r.plan.rows[0].plannedBaseQuantity,8);
  assert.equal(r.sheet.auxiliaryDocumentNotice, 'Documento auxiliar: NÃO substitui registro ou autorização no SISCOFIS.');
  const document=await w4.createSeparationSheetPdf({sheet:r.sheet,request:r.request,
    depots:r.depots,locations:r.locations});
  const pdf=await PDFDocument.load(new Uint8Array(document.doc.output('arraybuffer')));
  assert.ok(pdf.getPageCount()>0);
  assert.equal(JSON.stringify(stock),before);
  assert.equal(r.outboundEnabled,false);
});
test('PDF textual W2 -> W3 -> PDF W4; sem habilitar arquivos reais',async()=>{
  const r=await preview({source:await syntheticPdf(),format:'PDF',filename:'synthetic.pdf'});
  assert.equal(r.ok,true);assert.equal(r.request.source.format,'PDF');
  assert.equal(r.plan.status,'PLANNED');assert.ok(r.sheet);
});
test('duas posicoes exigem escolhas humanas explicitas',async()=>{
  const s=snapshot({balances:[balance(p1,10),balance(p2,10)]});
  const pending=await preview({snapshot:s});
  assert.equal(pending.ok,true);assert.equal(pending.plan.status,'NEEDS_REVIEW');assert.equal(pending.sheet,null);
  const id=pending.request.rows[0].sourceRowId;
  const r=await preview({snapshot:s,choices:{[id]:{allowPartial:false,allocations:[
    {position:p1,balanceRevision:1,plannedBaseQuantity:5},
    {position:p2,balanceRevision:1,plannedBaseQuantity:3},
  ]}}});
  assert.equal(r.plan.status,'PLANNED');assert.equal(r.plan.rows[0].allocations.length,2);
  assert.ok(r.sheet);
});
test('parcial com aceite explicito, falta visivel, sem reserva',async()=>{
  const s=snapshot({balances:[balance(p1,3)]});
  const pending=await preview({snapshot:s});
  assert.equal(pending.plan.status,'NEEDS_REVIEW');
  const id=pending.request.rows[0].sourceRowId;
  const partial=await preview({snapshot:s,choices:{[id]:{allowPartial:true,allocations:[
    {position:p1,balanceRevision:1,plannedBaseQuantity:3},
  ]}}});
  assert.equal(partial.plan.status,'PARTIAL');
  assert.ok(partial.plan.issues.some(i=>i.code==='INSUFFICIENT_STOCK'));
  assert.ok(partial.sheet);
});
test('duplicidade hash e mesmo numero com arquivo alterado bloqueados',async()=>{
  const original=await preview();assert.equal(original.ok,true);
  const previous=[original.request];
  const duplicate=await preview({snapshot:snapshot({previousImports:previous})});
  assert.equal(duplicate.ok,false);assert.equal(duplicate.issue.code,'DUPLICATE_REQUEST');
  const revised=await preview({source:bytes(fixture.replace('PAPEL A4','PAPEL NOVO')),
    snapshot:snapshot({previousImports:previous})});
  assert.equal(revised.ok,false);assert.equal(revised.issue.code,'IDEMPOTENCY_CONFLICT');
});
test('saldo mudou apos planejamento; W3 requer replanejamento',async()=>{
  const first=await preview();assert.equal(first.plan.status,'PLANNED');
  const issues=w3.revalidatePhysicalSeparation(first.plan,{
    workspaceId:ws,depots:[depot],locations:snapshot().locations,
    balances:[balance(p1,1,2)]});
  assert.ok(issues.some(i=>i.code==='STOCK_CHANGED'));
});
test('mesma UG em workspace diferente nao autoriza acesso',async()=>{
  await assert.rejects(()=>preview({snapshot:snapshot({
    balances:[{...balance(p1),workspaceId:'almox-outro'}],
  })}),/ALMOX_CROSS_WORKSPACE_SNAPSHOT/);
  await assert.rejects(()=>preview({access:{...access,sectorType:'aprovisionamento'}}),/ALMOX_IDENTITY_DENIED/);
});
test('cliente nao estabelece CONFIRMED; mapa ausente bloqueia ficha',async()=>{
  const r=await preview({snapshot:snapshot({correspondences:[]})});
  assert.equal(r.ok,true);assert.equal(r.plan.status,'NEEDS_REVIEW');assert.equal(r.sheet,null);
});
test('layout desconhecido e quantidade ambigua nao seguem para plano',async()=>{
  const bad=await preview({source:bytes(fixture.replace('EMPROVEX_FIXTURE_R1','REAL_LAYOUT'))});
  assert.equal(bad.ok,false);assert.equal(bad.issue.code,'UNSUPPORTED_LAYOUT');
  const invalid=await preview({source:bytes(fixture.replace('|8|UN','|1.234|UN'))});
  assert.equal(invalid.ok,false);assert.equal(invalid.issue.code,'INVALID_QUANTITY');
});
test('replay e concorrencia nao podem causar saldo negativo: execucao real fechada',async()=>{
  for(let i=0;i<4;i++)assert.throws(()=>w5.confirmAlmoxPhysicalWithdrawal({
    workspaceId:ws,requestId:'QA-2026-001',idempotencyKey:'replay-same',quantity:1000,
  }),/ALMOX_OUTBOUND_DISABLED_PENDING_OPERATIONAL_APPROVAL/);
  assert.equal(w5.ALMOX_OUTBOUND_ENABLED,false);
});
test('PDF longo multipagina W4 sem escrita (regressao documental)',async()=>{
  // W4 dedicated suite validates multi-page A4 and footer with 65 synthetic lines.
  const source=read('features/almoxarifado/pdf/SeparationSheet.ts');
  assert.match(source,/printFooters/);
  assert.doesNotMatch(source,/runTransaction\(|setDoc\(|updateDoc\(/);
});
