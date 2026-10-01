#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];

const realtime = read('hooks/useOperationalRealtimeCollections.ts');
const history = read('lib/historicalInvoiceQueries.ts');
const empenhos = read('features/empenhos/components/EmpenhosView.tsx');
const notas = read('features/notas-fiscais/components/NotasFiscaisView.tsx');
const backfill = read('scripts/performance-r3-invoice-hot-history.mjs');

const requireText = (source, marker, message) => {
  if (!source.includes(marker)) failures.push(message);
};

requireText(
  realtime,
  "where('localizacaoAtual', 'in', [...INVOICE_OPERATIONAL_LOCATIONS])",
  'Listener de invoices perdeu o recorte operacional.'
);
requireText(
  realtime,
  'isInvoiceHotHistoryReady',
  'Listener seletivo perdeu o gate de backfill legado.'
);
requireText(
  realtime,
  'loadInvoicesByRecordKeys(removedKeys)',
  'Transição operacional -> histórico perdeu revalidação pontual.'
);
requireText(
  history,
  'loadAllInvoicesHistory',
  'Histórico completo sob demanda ausente.'
);
requireText(
  history,
  'loadInvoicesForEmpenho',
  'Detalhe seletivo por empenho ausente.'
);
requireText(
  empenhos,
  'useHistoricalInvoices',
  'Empenhos voltou a depender apenas do array realtime para o detalhe.'
);
requireText(
  notas,
  'loadCompleteHistory',
  'Nova NF perdeu carregamento histórico explícito.'
);
requireText(
  backfill,
  'BACKFILL_INVOICE_HOT_HISTORY:',
  'Backfill não exige confirmação explícita.'
);

if (failures.length) {
  console.error('PERF-X HOT VS HISTORY GUARD: FAIL');
  failures.forEach((failure) => console.error('  ' + failure));
  process.exit(2);
}

console.log('PERF-X HOT VS HISTORY GUARD: READY');
console.log('Invoices realtime: somente operacionais após backfill certificado');
console.log('Histórico: seletivo/sob demanda');
console.log('Legado: fallback seguro até marcador READY');
