import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const location = {
  normalizeWarehouseLocationQuantity(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e9) return null;
    const n = Math.round(value * 1e6) / 1e6;
    return Math.abs(n - value) > 1e-9 ? null : n;
  },
  warehouseStockPositionKey(p) {
    return p.kind === 'UNASSIGNED' ? 'UNASSIGNED' : `${p.kind}:${p.depotId}:${p.locationId}` +
      (p.kind === 'SUBPOSITION' ? ':' + p.subpositionId : '');
  },
};
const bulk = {
  bulkMaterialDescriptionKey(s) { return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g,' '); },
  bulkMaterialUnitKey(s) {
    const k = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g,'');
    if (['und','un','unid','unidade','unidades','unit'].includes(k)) return 'unit';
    if (['kg','quilo','quilograma'].includes(k)) return 'kg';
    if (['cx','caixa','box'].includes(k)) return 'box';
    return k;
  },
};
function load(path, deps) {
  const compiled = ts.transpileModule(source(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0,0);
  const exports = {};
  runInNewContext(compiled.outputText, { exports, require: name => {
    if (!(name in deps)) throw Error('Unexpected W3 dependency: ' + name);
    return deps[name];
  }});
  return exports;
}
const match = load('lib/almoxarifado/materialMatch.ts', {
  '../warehouse/bulkStockMaterialMatcher': bulk, '../warehouse/location': location,
});
const planner = load('lib/almoxarifado/positionPlanner.ts', {
  './contracts': { ALMOX_PLAN_SCHEMA_VERSION: 'almox_separation_plan_v1' },
  './materialMatch': match, '../warehouse/location': location,
});
const w = 'qa-almox', foreign = 'qa-foreign', ug = '160416';
const materialId = 'mat_' + 'a'.repeat(32);
const depotId = 'dep_' + 'b'.repeat(32);
const localId = 'loc_' + 'c'.repeat(32);
const subId = 'sub_' + 'd'.repeat(32);
const secondLocal = 'loc_' + 'e'.repeat(32);
const position = { kind:'LOCATION', depotId, locationId:localId, subpositionId:null };
const shelf = { kind:'SUBPOSITION', depotId, locationId:localId, subpositionId:subId };
const second = { kind:'LOCATION', depotId, locationId:secondLocal, subpositionId:null };
const mat = (overrides={}) => ({ id:materialId, workspaceId:w, ug, status:'active',
  description:'Papel A4',aliases:['Papel branco'],unit:{code:'unit',label:null},conversions:[],...overrides });
const dep = (overrides={}) => ({id:depotId,workspaceId:w,ug,status:'active',...overrides});
const loc = (overrides={}) => ({id:localId,workspaceId:w,ug,depotId,kind:'LOCAL',parentLocationId:null,status:'active',code:'EST-01',...overrides});
const correspondence = (overrides={}) => ({workspaceId:w,sourceItemCode:'ABC-1',sourceUnit:'UN',
  materialId,factorToBaseUnit:1,revision:1,approvedByUid:'uid-user',approvedAt:'2026-10-31',...overrides});
const row = (overrides={}) => ({sourceRowId:'r1', sourceText:'ABC-1 Papel A4',sourceItemCode:'ABC-1',
  description:'Papel A4',sourceQuantity:8,quantityMeaning:'REQUESTED',sourceUnit:'UN',
  canonicalMaterialId:null,factorToBaseUnit:null,canonicalQuantity:null,matchStatus:'UNRESOLVED',...overrides});
const bal = (p,quantity,overrides={}) => ({ id:'locbal_x',workspaceId:w,ug,materialId,
  position:p,quantity,revision:1,lastMovementId:'mov_x',...overrides });
const defaultLocations = [loc(),loc({id:subId,kind:'SUBPOSITION',parentLocationId:localId,code:'PRT-01'}),loc({id:secondLocal,code:'EST-02'})];
function input(overrides={}) { return {
  planId:'p1',requestId:'req1',workspaceId:w,revision:1,createdByUid:'uid-user',createdAt:'2026-10-31',
  lines:[row()],materials:[mat()],correspondences:[correspondence()],depots:[dep()],locations:defaultLocations,
  balances:[bal(position,10)],...overrides,
}; }
const plan = value => planner.planPhysicalSeparation(input(value)).plan;
const codes = p => p.issues.map(i=>i.code);

test('posição única: pré-seleção automática, vínculo aprovado e plano sem baixa', () => {
  const args=input(), p=planner.planPhysicalSeparation(args).plan;
  assert.equal(p.status,'PLANNED'); assert.equal(p.rows[0].plannedBaseQuantity,8);
  assert.equal(p.rows[0].allocations[0].position.balanceRevision,1);
  assert.deepEqual(args.balances[0].quantity,10);
  assert.equal(planner.revalidatePhysicalSeparation(p,args).length,0);
});
test('duas posições exige seleção humana mesmo quando uma tem saldo suficiente',()=>{
  const b=[bal(position,10),bal(second,3)];
  const p=plan({balances:b});
  assert.equal(p.status,'NEEDS_REVIEW'); assert.ok(codes(p).includes('MULTIPLE_POSITIONS'));
  assert.equal(p.rows[0].allocations.length,0);
});
test('divisão manual completa entre posições/subposição mantém somatório e posição completa',()=>{
  const p=plan({balances:[bal(position,4),bal(shelf,4)],choices:{r1:{allowPartial:false,allocations:[
    {position,balanceRevision:1,plannedBaseQuantity:4},{position:shelf,balanceRevision:1,plannedBaseQuantity:4},
  ]}}});
  assert.equal(p.status,'PLANNED'); assert.equal(p.rows[0].allocations.length,2);
  assert.equal(p.rows[0].allocations[1].position.position.subpositionId,subId);
  assert.equal(p.rows[0].allocations.reduce((s,x)=>s+x.plannedBaseQuantity,0),8);
});
test('saldo insuficiente não preenche ficticiamente: parcial requer aceite',()=>{
  const stock=[bal(position,3)];
  assert.equal(plan({balances:stock}).status,'NEEDS_REVIEW');
  const p=plan({balances:stock,choices:{r1:{allowPartial:true,allocations:[
    {position,balanceRevision:1,plannedBaseQuantity:3},
  ]}}});
  assert.equal(p.status,'PARTIAL'); assert.equal(p.rows[0].plannedBaseQuantity,3);
  assert.ok(codes(p).includes('INSUFFICIENT_STOCK'));
});
test('saldo não atribuído e posições inativas não entram no planejamento',()=>{
  const p=plan({balances:[bal({kind:'UNASSIGNED'},20),bal(position,10)],locations:defaultLocations.map(l=>({...l,status:'inactive'}))});
  assert.equal(p.status,'NEEDS_REVIEW'); assert.ok(codes(p).includes('UNASSIGNED_STOCK'));
  assert.ok(codes(p).includes('INACTIVE_POSITION'));
  assert.equal(p.rows[0].allocations.length,0);
});
test('material desconhecido / somente descrição gera sugestão mas não confirmação',()=>{
  const m=match.matchRequestMaterial({workspaceId:w,line:row({sourceItemCode:'NOT-LINKED'}),materials:[mat()],correspondences:[correspondence()]});
  assert.equal(m.material,null); assert.equal(m.line.canonicalMaterialId,null);
  assert.equal(m.suggestedMaterialIds[0],materialId);
  const p=plan({lines:[row({sourceItemCode:'NOT-LINKED'})]});
  assert.equal(p.rows.length,0); assert.equal(p.status,'NEEDS_REVIEW');
});
test('vínculo ambíguo, factor alterado e unidade incompatível bloqueiam',()=>{
  assert.equal(plan({correspondences:[correspondence(),correspondence({revision:2})]}).rows.length,0);
  assert.ok(codes(plan({correspondences:[correspondence({factorToBaseUnit:12})]})).includes('UNIT_INCOMPATIBLE'));
  assert.ok(codes(plan({lines:[row({sourceUnit:'KG'})]})).includes('MATERIAL_UNRESOLVED'));
  assert.ok(codes(plan({correspondences:[correspondence({sourceUnit:'KG'})],lines:[row({sourceUnit:'KG'})]})).includes('UNIT_INCOMPATIBLE'));
});
test('workspace não é UG: bloqueia snapshot de outro workspace e não mostra detalhes',()=>{
  const p=planner.planPhysicalSeparation(input({balances:[bal(position,10,{workspaceId:foreign})]}));
  assert.equal(p.plan.rows.length,0); assert.equal(p.matches.length,0);
  assert.ok(codes(p.plan).includes('CROSS_WORKSPACE_ACCESS'));
});
test('saldo alterado/revisão stale impede seleção e revalidação posterior',()=>{
  const args=input(); const p=planner.planPhysicalSeparation(args).plan;
  assert.ok(planner.revalidatePhysicalSeparation(p,{...args,balances:[bal(position,8,{revision:2})]}).some(x=>x.code==='STOCK_CHANGED'));
  const bad=plan({choices:{r1:{allowPartial:false,allocations:[{position,balanceRevision:1,plannedBaseQuantity:8}]}},balances:[bal(position,10,{revision:2})]});
  assert.equal(bad.status,'NEEDS_REVIEW'); assert.ok(codes(bad).includes('STOCK_CHANGED'));
});
test('duas linhas do mesmo material não duplicam disponibilidade',()=>{
  const p=plan({lines:[row(),row({sourceRowId:'r2'})],balances:[bal(position,10)]});
  assert.equal(p.status,'NEEDS_REVIEW');
  assert.equal(p.rows[0].plannedBaseQuantity,8);assert.equal(p.rows[1].plannedBaseQuantity,0);
});
test('quantidade inválida ou semântica desconhecida não vira autorizada',()=>{
  assert.ok(codes(plan({lines:[row({sourceQuantity:NaN})]})).includes('INVALID_QUANTITY'));
  assert.ok(codes(plan({lines:[row({quantityMeaning:'UNKNOWN'})]})).includes('UNKNOWN_QUANTITY_MEANING'));
});
test('saldos duplicados na mesma posição são bloqueados',()=>{
  const p=plan({balances:[bal(position,5),bal(position,5,{revision:2})]});
  assert.equal(p.status,'NEEDS_REVIEW');assert.ok(codes(p).includes('STOCK_CHANGED'));
});
test('revalidação de múltiplas linhas detecta consumo agregado acima do saldo',()=>{
  const args=input({lines:[row({sourceQuantity:4}),row({sourceRowId:'r2',sourceQuantity:4})]});
  const p=planner.planPhysicalSeparation(args).plan;
  assert.equal(p.status,'PLANNED');
  assert.equal(planner.revalidatePhysicalSeparation(p,args).length,0);
  assert.ok(planner.revalidatePhysicalSeparation(p,{...args,balances:[bal(position,5)]}).length>0);
});
