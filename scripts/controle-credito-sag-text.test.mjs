import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../lib/controle-credito/sagCreditText.ts',import.meta.url),'utf8');
const output = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2017}}).outputText;
const { parseSagCreditText: parse } = await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
// Synthetic fixture. No real operational document or data committed.
const sample = [
  'NOTA DE CRÉDITO ORÇAMENTÁRIO','2026NC000001',
  'NÚMERO NC 123456000012026NC000001 VALOR TOTAL 10.000,01',
  'UG EMITENTE 123456 DESCENTRALIZAÇÃO PROVISÃO',
  'DATA EMISSÃO 04/11/2026','SISTEMA ORIGEM SIAFI-STN QTDE. UGS FAV. 1',
  'DESCRIÇÃO','CRÉDITO TESTE. PRAZO DE EMPENHO 30 NOV 26.',
  'DETALHAMENTO POR UG FAVORECIDA','654321 — UG TESTE','Sequencial 1 R$ 10.000,01',
  'ORIGEM DO CRÉDITO','UG FAV ITEM NUM ESF PTRES FONTE ND UGR PI VALOR',
  '654321 1 1 1 123456 1000000000 339000 123456 - R$ 10.000,01',
  'DESTINO DO CRÉDITO','UG FAV ITEM NUM ESF PTRES FONTE ND UGR PI VALOR',
  '654321 1 1 1 123456 1000000000 339030 123456 TESTE123456 R$ 10.000,01'
].join('\n');
test('destination is not added to origin; explicit deadline recognized',()=>{
  const r=parse(sample,'654321');
  assert.equal(r.totalCents,1000001); assert.equal(r.destination.nd,'339030');
  assert.equal(r.origin.nd,'339000'); assert.equal(r.deadline,'2026-11-30');
  assert.equal(r.requiresReview,true); assert.deepEqual(r.warnings,[]);
});
test('ambiguous OCR source is not guessed',()=>{
  const r=parse(sample.replaceAll('1000000000','1eeee0eeee'),'654321');
  assert.equal(r.destination.fonte,null); assert.equal(r.warnings.length,2);
});
test('no deadline is not replaced by issue date or print date',()=>{
  assert.equal(parse(sample.replace('PRAZO DE EMPENHO 30 NOV 26.',''),'654321').deadline,null);
});
test('reject inconsistent monetary values and mismatched UG',()=>{
  assert.throws(()=>parse(sample.replace('VALOR TOTAL 10.000,01','VALOR TOTAL 10.000,02'),'654321'));
  assert.throws(()=>parse(sample,'654322'));
});
test('reject unsupported multi-UG and multi-sequential documents',()=>{
  assert.throws(()=>parse(sample.replace('UGS FAV. 1','UGS FAV. 2'),'654321'));
  assert.throws(()=>parse(sample+'\nSequencial 2','654321'));
});
