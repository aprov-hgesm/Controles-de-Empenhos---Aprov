import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../lib/controle-credito/reports/reportLines.ts',import.meta.url),'utf8').replace("import {money,displayDate,type CreditReportLine} from './creditPdf';","const money=(n)=>'R$ '+(n/100).toFixed(2); const displayDate=(d)=>d||'Não informado';");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {buildCreditReport,REPORT_TITLES}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const balance={creditCents:10000,committedCents:3000,availableCents:7000,unallocatedCents:0,centers:[{centerId:'A',basisPoints:10000,commitmentCount:1,allocatedCents:10000,committedCents:3000,availableCents:7000}]};
const credit=(id,number)=>({id,number,fullNumber:number,issueDate:'2026-01-01',deadline:'2026-02-01',adminDeadline:'2026-01-25',documentTotalCents:10000,sequences:[],description:'Finalidade de teste',balance,cells:[{nd:'339030',pi:'TESTE',ptres:'123456',cents:10000}]});
const note=(id,creditId,centerId,createdAt,netCents)=>({id,number:id,creditId,centerId,createdAt,netCents,description:'Teste',supplier:'Favorecido',issueDate:'2026-01-03'});
const view={member:{role:'gestor',centerId:null},totals:{creditCents:20000,committedCents:4500,availableCents:15500,creditCount:2,commitmentCount:3,noCommitmentsCount:0,unallocatedCents:0},credits:[credit('a','2026NC000001'),credit('b','2026NC000002')],commitments:[note('NE-A','a','A','2026-11-24T01:00:00Z',1000),note('NE-B','a','B','2026-11-24T12:00:00Z',2000),note('NE-C','b','A','2026-11-24T12:00:00Z',1500)],alerts:[{creditId:'a',overdue:true,overdrawnCenterIds:[],overdrawnCellIds:[]}]};
test('five reports and exact São Paulo registration day, NC and center filters',()=>{
  assert.equal(Object.keys(REPORT_TITLES).filter(k=>k!=='ne').length,5);
  const result=buildCreditReport(view,{type:'ne-centro',nc:'2026NC000001',center:'A',from:'2026-11-23',to:'2026-11-23'});
  assert.ok(result.some(r=>r.label==='NE NE-A'));assert.ok(!result.some(r=>r.label==='NE NE-B'||r.label==='NE NE-C'));
  assert.ok(result.some(r=>r.label==='Total líquido selecionado'&&r.value==='R$ 10.00'));
  const summary=buildCreditReport(view,{type:'nc'},'2026-01-27');
  assert.ok(summary.some(r=>r.value.includes('Prazo administração 2026-01-25')));
  assert.ok(summary.some(r=>r.kind==='progress'&&r.value.includes('30%')&&r.value.includes('70%')));
  assert.ok(summary.some(r=>r.label==='Prazo administrativo crítico'&&r.value.includes('R$ 140.00')));
  assert.ok(summary.some(r=>r.label==='Consolidado por centro de custos'&&r.table.rows[0].join('|').includes('200.00|60.00|140.00')));
  assert.ok(!summary.some(r=>r.label.startsWith('NE ')||r.label==='Célula orçamentária'));
  assert.ok(buildCreditReport(view,{type:'nc-detalhe'}).some(r=>r.value.includes('ND 339030')&&r.value.includes('PI TESTE')));
  assert.ok(buildCreditReport(view,{type:'prazos'}).some(r=>r.value.includes('Prazo vencido')));
  assert.ok(buildCreditReport(view,{type:'nc-detalhe',nc:'2026NC000002'}).some(r=>r.label==='NE NE-C'));
  assert.ok(buildCreditReport(view,{type:'saldo'}).some(r=>r.label==='Percentual empenhado'));
});

test('NC summary uses filtered quota only and does not expose other centers',()=>{
  const a=credit('a','2026NC000001');a.balance={...balance,creditCents:20000,committedCents:5000,availableCents:15000,centers:[{...balance.centers[0],basisPoints:5000},{centerId:'B',basisPoints:5000,commitmentCount:1,allocatedCents:10000,committedCents:2000,availableCents:8000}]};
  const scoped={...view,credits:[a]};
  const rows=buildCreditReport(scoped,{type:'nc',center:'A'},'2026-02-03');
  assert.ok(rows.find(r=>r.kind==='fields').fields.some(f=>f.value==='R$ 100.00'));
  assert.ok(rows.some(r=>r.label==='PRAZO OFICIAL VENCIDO'&&r.value.includes('R$ 70.00')));
  assert.ok(rows.filter(r=>r.kind==='table').every(r=>r.table.rows.every(x=>x[0]==='A')));
  assert.ok(rows.filter(r=>r.kind==='progress').every(r=>r.percent===30));
});
test('zero credit and deficit remain truthful without a fabricated percentage',()=>{
  const c=credit('z','2026NC000003');c.balance={...balance,creditCents:0,committedCents:100,availableCents:-100,centers:[{centerId:'A',basisPoints:10000,commitmentCount:1,allocatedCents:0,committedCents:100,availableCents:-100}]};
  const rows=buildCreditReport({...view,credits:[c]},{type:'nc'},'2026-02-03');
  assert.ok(rows.filter(r=>r.kind==='progress').every(r=>r.percent===null));
  assert.ok(rows.some(r=>r.label==='DÉFICIT'));
  assert.ok(rows.some(r=>r.kind==='fields'&&r.fields.some(f=>f.label==='Déficit'&&f.value==='R$ -1.00')));
});
