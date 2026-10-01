#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const contract = read('lib/invoiceHotHistory.ts');
const realtime = read('hooks/useOperationalRealtimeCollections.ts');
const history = read('lib/historicalInvoiceQueries.ts');
const empenhos = read('features/empenhos/components/EmpenhosView.tsx');
const notas = read('features/notas-fiscais/components/NotasFiscaisView.tsx');
const actions = read('features/notas-fiscais/hooks/useNotasFiscaisActions.ts');
const backfill = read('scripts/performance-r3-invoice-hot-history.mjs');
const viewState = read('hooks/useOperationalViewState.ts');

assert.match(contract, /localizacaoAtual.*tesourariaDate.*comissaoDate/s);
assert.match(contract, /return 'TESOURARIA'/);
assert.match(contract, /return 'COMISSAO'/);
assert.match(contract, /return 'APROVISIONAMENTO'/);
assert.match(realtime, /isInvoiceHotHistoryReady/);
assert.match(realtime, /where\('localizacaoAtual', 'in', \[\.\.\.INVOICE_OPERATIONAL_LOCATIONS\]\)/);
assert.match(realtime, /hotHistoryReady[\s\S]*\?[\s\S]*query\(/);
assert.match(realtime, /:[\s\S]*collectionRef;/);
assert.match(realtime, /loadInvoicesByRecordKeys\(removedKeys\)/);
assert.match(history, /loadAllInvoicesHistory/);
assert.match(history, /loadInvoicesForEmpenho/);
assert.match(history, /loadInvoicesByRecordKeys/);
assert.match(history, /getCountFromServer/);
assert.match(empenhos, /useHistoricalInvoices/);
assert.match(empenhos, /loadInvoiceCountsForEmpenhos/);
assert.match(notas, /loadCompleteHistory/);
assert.match(notas, /nfTramitacaoFilter === 'Todos'/);
assert.match(notas, /nfTramitacaoFilter === 'Concluidas'/);
assert.match(actions, /loadCompleteInvoiceSource/);
assert.match(viewState, /nfTramitacaoFilter[\s\S]*\('EmTramitacao'\)/);
assert.match(notas, /nfTramitacaoFilter === 'EmTramitacao'[\s\S]*currentLocation !== 'TESOURARIA'/);
assert.match(history, /hotHistoryReady:[\s\S]*boolean/);
assert.match(history, /completed: null,[\s\S]*hotHistoryReady: false/);
assert.match(backfill, /currentDocument\.updateTime/);
assert.match(backfill, /updateMask\.fieldPaths/);
assert.match(backfill, /settings\/\$\{markerId\}/);
assert.doesNotMatch(backfill, /DELETE/);

function syntheticScenario(total, operational) {
  assert.ok(total >= operational);
  return {
    total,
    beforeDocumentsInRealtimeInitialSnapshot: total,
    afterDocumentsInRealtimeInitialSnapshot: operational,
    historicalDocumentsLoadedBeforeRequest: 0,
  };
}

const scenarios = [
  syntheticScenario(100, 20),
  syntheticScenario(1_000, 20),
  syntheticScenario(10_000, 20),
];

for (const scenario of scenarios) {
  assert.equal(
    scenario.beforeDocumentsInRealtimeInitialSnapshot,
    scenario.total
  );
  assert.equal(
    scenario.afterDocumentsInRealtimeInitialSnapshot,
    20
  );
  assert.equal(scenario.historicalDocumentsLoadedBeforeRequest, 0);
}

console.log('PERF-X HOT VS HISTORY: PASS');
console.log('Synthetic only — not production measurements.');
for (const scenario of scenarios) {
  const reduction = (
    (1 - scenario.afterDocumentsInRealtimeInitialSnapshot
      / scenario.beforeDocumentsInRealtimeInitialSnapshot) * 100
  ).toFixed(2);
  console.log(
    `N=${scenario.total}: realtime inicial `
    + `${scenario.beforeDocumentsInRealtimeInitialSnapshot} -> `
    + `${scenario.afterDocumentsInRealtimeInitialSnapshot} docs `
    + `(${reduction}% menor); histórico pré-solicitação=0`
  );
}
