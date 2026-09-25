#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const namespace = read('lib/warehouse/namespace.ts');
const barcode = read('lib/warehouse/barcode.ts');
const barcodeRepository = read('lib/warehouse/barcodeRepository.ts');
const outbound = read('lib/warehouse/outbound.ts');
const outboundRepository = read('lib/warehouse/outboundRepository.ts');
const movement = read('lib/warehouse/movement.ts');
const ledgerRepository = read('lib/warehouse/ledgerRepository.ts');
const stock = read('features/warehouse/components/WarehouseStockOperational.tsx');
const expressUi = read('features/warehouse/components/WarehouseExpressOutbound.tsx');
const withdrawalUi = read('features/warehouse/components/WarehouseMaterialWithdrawal.tsx');
const control = read('features/warehouse/components/WarehouseItemControlOperational.tsx');
const navigation = read('features/warehouse/navigation.ts');
const sectionContent = read('features/warehouse/components/WarehouseSectionContent.tsx');
const protectedSurface = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
const route = read('app/adm-deposito/saida-expressa/page.tsx');
const rules = read('firestore.rules');
const security = read('scripts/firestore-multitenancy-security.test.mjs');
const e2e = read('tests/e2e/warehouse-phase-8.spec.mjs');
const externalE2e = read('tests/e2e/operator-critical-flow.spec.mjs');
const decisions = read('docs/adm-deposito/DECISIONS.md');
const phaseDoc = read('docs/adm-deposito/PHASE_8_BARCODE_SCANNER_EXPRESS_OUTBOUND.md');
const roadmap = read('docs/adm-deposito/ROADMAP.md');
const packageJson = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/application-ci.yml');

assert.match(namespace, /barcodes: 'barcodes'/);
assert.match(barcode, /warehouse_barcode_v1/);
assert.match(barcode, /createWarehouseBarcodeId/);
assert.match(barcode, /barcodeAssociationMatchesMaterial/);
assert.match(barcode, /convertWarehouseBarcodeQuantityToBase/);
assert.match(barcodeRepository, /saveWarehouseBarcodeAssociation/);
assert.match(barcodeRepository, /WAREHOUSE_BARCODE_ALREADY_LINKED/);
assert.match(outbound, /prepareWarehouseExpressOutbound/);
assert.match(outbound, /WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK/);
assert.match(outboundRepository, /runTransaction/);
assert.match(outboundRepository, /createWarehouseMovementId/);
assert.match(outboundRepository, /WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK/);
assert.match(outboundRepository, /transaction\.set\(movementRef/);
assert.match(outboundRepository, /transaction\.set\(balanceRef/);
assert.match(outboundRepository, /transaction\.set\(locationBalanceRef/);
assert.match(outboundRepository, /transaction\.update\(lotRef/);
assert.match(movement, /EXPRESS_OUTBOUND/);
assert.match(movement, /BARCODE_SCANNER/);
assert.match(movement, /outbound_quantity_mismatch/);
assert.match(ledgerRepository, /candidate\.type === 'OUTBOUND'/);
assert.match(ledgerRepository, /WAREHOUSE_OUTBOUND_INSUFFICIENT_STOCK/);

assert.match(expressUi, /WarehouseMaterialWithdrawal/);
assert.match(withdrawalUi, /warehouse-scanner-input/);
assert.match(withdrawalUi, /SCAN → quantidade → TAB/);
assert.match(withdrawalUi, /Código não cadastrado/);
assert.match(withdrawalUi, /saveWarehouseBarcodeAssociation/);
assert.match(withdrawalUi, /selectWarehouseFefoLot/);
assert.match(withdrawalUi, /FEFO recomendado/);
assert.match(withdrawalUi, /warehouse-material-withdrawal/);
assert.match(withdrawalUi, /scannerRef\.current\?\.focus\(\)/);
assert.match(stock, /listWarehouseBarcodes/);
assert.match(stock, /warehouse-material-barcodes/);
assert.match(stock, /\.\.\.summary\.barcodes/);
assert.match(navigation, /id: 'control'/);
assert.match(control, /WarehouseExpressOutbound/);
assert.match(control, /id: 'outbound'/);
assert.match(control, /label: 'Saída de Material'/);
assert.match(route, /redirect\('\/adm-deposito\/controle-de-itens\?aba=outbound'\)/);
assert.match(sectionContent, /WarehouseItemControlOperational/);
assert.match(protectedSurface, /canAccessWarehouseModule/);

assert.match(rules, /validWarehouseBarcodeDocument/);
assert.match(rules, /warehouse_barcode_v1/);
assert.match(rules, /match \/barcodes\/\{barcodeId\}/);
assert.match(rules, /warehouseExpressOutboundHasMatchingLocationBalanceAfter/);
assert.match(rules, /warehouseExpressOutboundBarcodeMatches/);
assert.match(rules, /warehouseExpressOutboundLotMatchesAfter/);
assert.match(
  rules,
  /validWarehouseExpressOutboundBalanceUpdate[\s\S]*request\.resource\.data\.quantity >= 0/
);
assert.match(
  rules,
  /match \/inventories\/\{(?:document=\*\*|inventoryId)\}/
);
assert.doesNotMatch(
  rules,
  /match \/inventories\/\{document=\*\*\}[\s\S]{0,160}allow read, write/
);
assert.doesNotMatch(rules, /match \/\{domain\}\/\{document=\*\*\}/);
assert.match(rules, /warehouseMovementCreateAllowed/);
assert.match(rules, /warehouseBalanceWriteAllowed/);
assert.match(rules, /warehouseLocationBalanceWriteAllowed/);
assert.match(rules, /canAccessWarehouseModule\(workspaceId\)/);

assert.match(security, /FASE 8 — Código de barras \/ Scanner \/ Saída Expressa/);
assert.match(security, /não pode produzir saldo negativo/);
assert.match(security, /Setor externo não lê códigos de barras da FASE 8/);
assert.match(e2e, /warehouse-scanner-input/);
assert.match(e2e, /warehouse-barcode-association-panel/);
assert.match(e2e, /warehouse-outbound-cart/);
assert.match(e2e, /warehouse-outbound-cart-line/);
assert.match(e2e, /page\.reload\(\)/);
assert.match(e2e, /UNKNOWN_BARCODE/);
assert.match(e2e, /warehouse-movements-operational/);
assert.match(externalE2e, /\/adm-deposito\/saida-expressa/);

assert.match(decisions, /D-042 — Barcode é identificador auxiliar/);
assert.match(decisions, /D-043 — Saída expressa é OUTBOUND atômico/);
assert.match(decisions, /D-044 — Scanner HID compartilha o fluxo manual/);
assert.match(phaseDoc, /warehouse_barcode_v1/);
assert.match(phaseDoc, /nenhum croqui/i);
assert.match(roadmap, /## FASE 8 — Código de Barras, Scanner e Saída Expressa/);
assert.match(roadmap, /## FASE 9 — Visão do Depósito, Editor e Persistência/);

assert.equal(
  packageJson.scripts['test:adm-deposito-barcode-outbound'],
  'node --test scripts/warehouse-barcode-outbound.test.mjs'
);
assert.equal(
  packageJson.scripts['verify:adm-deposito-phase-8'],
  'node scripts/verify-adm-deposito-phase-8.mjs'
);
assert.match(workflow, /ADM Depósito Phase 8 barcode and outbound domain tests/);
assert.match(workflow, /ADM Depósito Phase 8 permanent guard/);

console.log('ADM Depósito FASE 8 guard: PASS');
