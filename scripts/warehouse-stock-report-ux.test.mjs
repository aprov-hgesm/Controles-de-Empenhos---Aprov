import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

test('Estoque: clique abre a ficha visível como diálogo acessível, sem depender de rolar 108 itens', () => {
  const stock = read('features/warehouse/components/WarehouseStockOperational.tsx');
  assert.match(stock, /data-testid="warehouse-material-dialog"/);
  assert.match(stock, /role="dialog" aria-modal="true"/);
  assert.match(stock, /aria-labelledby="warehouse-material-sheet-title"/);
  assert.match(stock, /data-testid="warehouse-material-close"/);
  assert.match(stock, /event\.key === 'Escape'/);
  assert.match(stock, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(stock, /setSelectedMaterialId\(summary\.material\.id\)/);
  assert.match(stock, /data-testid="warehouse-material-sheet"/);
  assert.match(stock, /data-testid="warehouse-item-relocation"/);
  assert.match(stock, /data-testid="warehouse-barcode-editor"/);
  assert.match(stock, /data-testid="warehouse-lot-list"/);
});

test('Estoque: cards compactos, busca, validade e paginação em memória preservam dados oficiais', () => {
  const stock = read('features/warehouse/components/WarehouseStockOperational.tsx');
  assert.match(stock, /filtered\.slice\(0, visibleCount\)/);
  assert.match(stock, /setVisibleCount\(\(count\) => count \+ 25\)/);
  assert.match(stock, /Detalhes <ChevronRight/);
  assert.match(stock, /data-testid="warehouse-stock-search"/);
  assert.match(stock, /matchesWarehouseExpiryState\(/);
  assert.match(stock, /\.sort\(compareWarehouseStockAvailability\)/);
  assert.match(stock, /listWarehousePositiveBalances\(workspaceId, 250\)/);
  assert.match(stock, /listWarehouseMovementsForMaterial\(workspaceId, selectedMaterialId, 50\)/);
  assert.doesNotMatch(stock, /(?:setDoc|updateDoc|deleteDoc|runTransaction)\(/);
});

test('Relatórios: categorias simples e detalhe expansível sem multiplicar leituras', () => {
  const reports = read('features/warehouse/components/WarehouseLogisticsReports.tsx');
  assert.match(reports, /data-testid="warehouse-logistics-reports"/);
  assert.match(reports, /aria-label="Tipo de relatório"/);
  assert.match(reports, /data-testid="warehouse-movement-report-list"/);
  assert.match(reports, /<details key=\{item\.movement\.id\}/);
  assert.match(reports, /filtered\.slice\(0, visibleCount\)/);
  assert.match(reports, /data-testid="warehouse-movement-show-more"/);
  assert.match(reports, /const exportCsv = \(\) =>/);
  assert.match(reports, /listWarehouseMovementsInPeriod\(workspaceId, startAt, endAt, 500\)/);
  assert.match(reports, /\{tab === 'stock' && <WarehouseStockOperational/);
  assert.doesNotMatch(reports, /(?:setDoc|updateDoc|deleteDoc|runTransaction)\(/);
});
