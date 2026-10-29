import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../features/dashboard/domain/dashboardRowsProjection.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { projectDashboardRows } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

const records = Array.from({ length: 1000 }, (_, i) => ({
  id: '2026NE' + String(i + 1).padStart(5, '0'),
  classification: i % 2 ? 'QR' : 'QS',
  pregao: i % 3 ? 'A' : 'B',
  supplier: i % 5 ? 'Fornecedor Alfa' : 'Fornecedor Beta',
  description: i % 7 ? 'Material' : 'Alimentação',
  amount: { committed: i + 0.25, received: i * 0.47 },
}));

test('Painel Essencial: 60 linhas apenas no DOM; 100% dos totais/contagem preservados', () => {
  const predicate = x => x.classification === 'QR' && x.pregao === 'A';
  const original = records.filter(predicate);
  const projected = projectDashboardRows(records, predicate, x => x.amount, 60);
  assert.equal(projected.matchedCount, original.length);
  assert.deepEqual(projected.visibleRows, original.slice(0, 60));
  assert.equal(projected.committed, original.reduce((sum, x) => sum + x.amount.committed, 0));
  assert.equal(projected.received, original.reduce((sum, x) => sum + x.amount.received, 0));
  assert.equal(projected.visibleRows.length, 60);
  assert.equal(records.length, 1000);
});

test('Normal mantém todas as linhas, mesmos valores e ordem', () => {
  const matches = x => x.supplier.toLowerCase().includes('alfa');
  const original = records.filter(matches);
  const projected = projectDashboardRows(records, matches, x => x.amount, Infinity);
  assert.equal(projected.visibleRows.length, original.length);
  assert.deepEqual(projected.visibleRows, original);
  assert.equal(projected.matchedCount, original.length);
});

test('Mostrar mais: ampliar 60 → 120 não altera filtro ou totais', () => {
  const matches = x => x.classification === 'QS';
  const sixty = projectDashboardRows(records, matches, x => x.amount, 60);
  const hundredTwenty = projectDashboardRows(records, matches, x => x.amount, 120);
  assert.equal(sixty.matchedCount, hundredTwenty.matchedCount);
  assert.equal(sixty.committed, hundredTwenty.committed);
  assert.equal(sixty.received, hundredTwenty.received);
  assert.deepEqual(hundredTwenty.visibleRows.slice(0, 60), sixty.visibleRows);
  assert.equal(hundredTwenty.visibleRows.length, 120);
});

test('Sem resultados, limite zero, limite maior que lista e valores ausentes', () => {
  const empty = projectDashboardRows(records, () => false, x => x.amount, 60);
  assert.deepEqual(empty, { visibleRows: [], matchedCount: 0, committed: 0, received: 0 });
  const zero = projectDashboardRows(records, () => true, () => undefined, 0);
  assert.equal(zero.visibleRows.length, 0);
  assert.equal(zero.matchedCount, records.length);
  assert.equal(zero.committed, 0);
  const long = projectDashboardRows(records, () => true, x => x.amount, 2000);
  assert.equal(long.visibleRows.length, records.length);
});

test('Projeção é somente leitura: objetos originais e filtros não são modificados', () => {
  const input = Object.freeze([Object.freeze({ id: '2026NE1', amount: Object.freeze({ committed: 50, received: 30 }) })]);
  const before = JSON.stringify(input);
  const result = projectDashboardRows(input, () => true, x => x.amount, 1);
  assert.equal(JSON.stringify(input), before);
  assert.equal(result.visibleRows[0], input[0]);
});

test('Integração visual usa limite Essencial e mantém Normal ilimitado', async () => {
  const component = await readFile(new URL('../features/dashboard/components/DashboardView.tsx', import.meta.url), 'utf8');
  assert.match(component, /projectDashboardRows\(/);
  assert.match(component, /mode === 'essencial' \? \(visibleRowsByClass\[cls\.key\] \?\? 60\) : Number\.POSITIVE_INFINITY/);
  assert.match(component, /matchedCount: filteredClassCount/);
  assert.doesNotMatch(component, /filteredClassEmpenhos\.slice/);
});
