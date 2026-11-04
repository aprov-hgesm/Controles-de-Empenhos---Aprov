import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(path, 'utf8');

test('Modo Essencial limita apenas cartões de NF, sem reduzir dados ou ações', () => {
  const nf = source('features/notas-fiscais/components/NotasFiscaisView.tsx');
  assert.match(nf, /const filteredInvoices = React\.useMemo/);
  assert.match(nf, /mode === 'essencial'\s*\? filteredInvoices\.slice\(0, visibleInvoiceCount\)\s*: filteredInvoices/);
  assert.match(nf, /visibleInvoices\.map\(\(inv\) =>/);
  assert.match(nf, /setVisibleInvoiceCount\(\(count\) => count \+ 24\)/);
  assert.match(nf, /historyRequired && historyLoading/);
  assert.match(nf, /handleDownloadLiquidacaoConsolidada\(inv\)/);
  assert.match(nf, /<InvoiceDocumentActions/);
  assert.match(nf, /<InvoiceMirrorDocumentActions/);
  // Consulta à NE preservada no cabeçalho, sem reintroduzir cartão pesado.
  assert.match(nf, /<EmpenhoDocumentMenu/);
  const menu = source('components/EmpenhoDocumentMenu.tsx');
  assert.match(menu, /runEmpenhoPdfAction/);
  for (const action of ["'view'", "'print'", "'download'"]) {
    assert.ok(menu.includes(action), 'Ação da NE ausente: ' + action);
  }
});

test('Histórico de tela é cache curto, isolado e sem afetar consultas completas', () => {
  const queries = source('lib/historicalInvoiceQueries.ts');
  const nf = source('features/notas-fiscais/components/NotasFiscaisView.tsx');
  assert.match(queries, /ESSENTIAL_INVOICE_HISTORY_TTL_MS = 30_000/);
  assert.match(queries, /\[uid, scope\.workspaceId, scope\.ug \?\? ''\]\.join\('\|'\)/);
  assert.match(queries, /export function loadAllInvoicesHistoryForDisplay/);
  assert.match(queries, /export async function loadAllInvoicesHistory\(/);
  assert.match(nf, /mode === 'essencial'\s*\? await loadAllInvoicesHistoryForDisplay\(\)\s*: await loadAllInvoicesHistory\(\)/);
});

test('Painel permanece leve depois de visitas a módulos operacionais', () => {
  const page = source('app/login/page.tsx');
  const dashboard = source('features/dashboard/components/DashboardView.tsx');
  assert.match(page, /activeTab === 'painel' \? \(\s*<OperationalDashboardEntry/);
  assert.doesNotMatch(page, /hasOpenedTransactionalSurface/);
  assert.match(dashboard, /visibleRowsByClass\[cls\.key\] \?\? 24/);
  assert.match(dashboard, /const aggregates = useMemo/);
  assert.match(dashboard, /totalRpnpSaldo/);
  assert.match(dashboard, /projectDashboardRows/);
});

test('Snapshots preservam ordem e atualizam objetos somente quando modificados', () => {
  const realtime = source('hooks/useOperationalRealtimeCollections.ts');
  assert.match(realtime, /snapshot\.docChanges\(\)/);
  assert.match(realtime, /mappedDocuments\.set\(change\.doc\.id, mapDocument\(change\.doc\)\)/);
  assert.match(realtime, /mappedDocuments\.delete\(change\.doc\.id\)/);
  assert.match(realtime, /snapshot\.docs\.map\(\(snapshotDoc\)/);
  assert.match(realtime, /where\('localizacaoAtual', 'in'/);
});

test('Estilo Essencial de NF é escopado e não toca Warehouse 3D', () => {
  const css = source('app/visual-mode-essential.css');
  const nf = source('features/notas-fiscais/components/NotasFiscaisView.tsx');
  assert.match(nf, /data-testid="invoices-surface"/);
  assert.match(css, /html\[data-visual-mode='essencial'\] \[data-testid='invoices-surface'\] \.backdrop-blur-md/);
  assert.match(css, /backdrop-filter: none !important/);
});
