#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const requiredPaths = [
  'app/central-mobile/layout.tsx',
  'app/central-mobile/page.tsx',
  'app/central-mobile/alocar/page.tsx',
  'app/central-mobile/transferir/page.tsx',
  'app/central-mobile/inventario/page.tsx',
  'app/central-mobile/saida/page.tsx',
  'app/central-mobile/conferir/page.tsx',
  'features/warehouse/mobile/WarehouseMobileHome.tsx',
  'features/warehouse/mobile/WarehouseMobileShell.tsx',
  'features/warehouse/mobile/WarehouseMobileProtectedLayout.tsx',
  'features/warehouse/mobile/WarehouseMobileScanner.tsx',
  'features/warehouse/mobile/WarehouseMobileLocationFoundationCheck.tsx',
  'features/warehouse/mobile/WarehouseMobileIntakeAllocation.tsx',
  'features/warehouse/mobile/WarehouseMobileTransfer.tsx',
  'features/warehouse/mobile/WarehouseMobileInventory.tsx',
  'features/warehouse/mobile/WarehouseMobileOutbound.tsx',
  'features/warehouse/mobile/WarehouseMobilePositionCheck.tsx',
  'lib/warehouse/mobileScanner.ts',
  'lib/warehouse/locationBarcode.ts',
  'lib/warehouse/locationBarcodeResolver.ts',
  'lib/warehouse/mobileLocationScan.ts',
  'lib/warehouse/inventoryRepository.ts',
  'lib/warehouse/outboundRepository.ts',
];

for (const path of requiredPaths) {
  assert.equal(
    existsSync(resolve(root, path)),
    true,
    'MOBILE-I integração A–H ausente: ' + path
  );
}

const home = read('features/warehouse/mobile/WarehouseMobileHome.tsx');
for (const target of [
  '/central-mobile/alocar',
  '/central-mobile/transferir',
  '#consulta-localizacao',
  '/central-mobile/inventario',
  '/central-mobile/saida',
  '/central-mobile/conferir',
]) {
  assert.equal(
    home.includes(target),
    true,
    'Home deve expor a jornada integrada: ' + target
  );
}
assert.match(home, /id="consulta-localizacao"/);
assert.doesNotMatch(home, /href:\s*null/);

const shell = read('features/warehouse/mobile/WarehouseMobileShell.tsx');
assert.match(shell, /href="\/central-mobile"/);
assert.match(shell, /href="\/adm-deposito"/);

const mobileLayout = read('features/warehouse/mobile/WarehouseMobileProtectedLayout.tsx');
assert.match(mobileLayout, /WarehouseAccessBoundary/);

const warehouseBoundary = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
for (const contract of [
  'LegalAcceptanceGate',
  'resolveAuthenticatedWorkspaceContext',
  'startWorkspaceSessionControl',
  'canAccessWarehouseModule',
]) {
  assert.equal(
    warehouseBoundary.includes(contract),
    true,
    'Boundary móvel deve preservar contrato compartilhado: ' + contract
  );
}

const operations = new Map([
  ['features/warehouse/mobile/WarehouseMobileLocationFoundationCheck.tsx', [
    'WarehouseMobileScanner',
    'classifyWarehouseMobileLocationScan',
    'resolveWarehouseStockPositionBarcode',
    'loadWarehouseMobilePhysicalPositionContents',
  ]],
  ['features/warehouse/mobile/WarehouseMobileIntakeAllocation.tsx', [
    'WarehouseMobileScanner',
    'allocateWarehousePendingItemFast',
  ]],
  ['features/warehouse/mobile/WarehouseMobileTransfer.tsx', [
    'WarehouseMobileScanner',
    'transferWarehouseStock',
  ]],
  ['features/warehouse/mobile/WarehouseMobileInventory.tsx', [
    'WarehouseMobileScanner',
    'saveWarehouseInventoryCount',
    'confirmWarehouseInventory',
  ]],
  ['features/warehouse/mobile/WarehouseMobileOutbound.tsx', [
    'WarehouseMobileScanner',
    'applyWarehouseExpressOutbound',
    'createWarehouseOutboundIdempotencyKey',
  ]],
  ['features/warehouse/mobile/WarehouseMobilePositionCheck.tsx', [
    'WarehouseMobileScanner',
  ]],
]);

for (const [path, requiredContracts] of operations) {
  const source = read(path);
  for (const contract of requiredContracts) {
    assert.equal(
      source.includes(contract),
      true,
      path + ' deve reutilizar contrato canônico: ' + contract
    );
  }
  for (const forbidden of [
    /\bsetDoc\s*\(/,
    /\bupdateDoc\s*\(/,
    /\brunTransaction\s*\(/,
    /\bwriteBatch\s*\(/,
  ]) {
    assert.doesNotMatch(
      source,
      forbidden,
      path + ' não pode criar mutação Firestore paralela'
    );
  }
}

const positionCheck = read('lib/warehouse/mobilePositionCheck.ts');
for (const forbidden of [
  'setDoc(',
  'updateDoc(',
  'runTransaction(',
  'writeBatch(',
  'transferWarehouseStock(',
  'applyWarehouseExpressOutbound(',
]) {
  assert.equal(
    positionCheck.includes(forbidden),
    false,
    'MOBILE-H deve permanecer read-only: ' + forbidden
  );
}

const nextConfig = read('next.config.ts');
assert.match(
  nextConfig,
  /camera=\(self\), microphone=\(\), geolocation=\(\)/,
  'CT-01 deve permanecer preservada na MOBILE-I'
);

const pkg = JSON.parse(read('package.json'));
for (const name of [
  'test:mobile-r1-scanner',
  'verify:mobile-r1-platform-scanner',
  'test:mobile-r1-integration-1',
  'verify:mobile-r1-integration-1',
  'test:mobile-r1-physical-query',
  'verify:mobile-r1-physical-query',
  'test:mobile-r1-intake-allocation',
  'verify:mobile-r1-intake-allocation',
  'test:mobile-r1-integration-2',
  'verify:mobile-r1-integration-2',
  'test:mobile-r1-inventory',
  'verify:mobile-r1-inventory',
  'test:mobile-r1-outbound',
  'verify:mobile-r1-outbound',
  'test:mobile-r1-position-check',
  'verify:mobile-r1-position-check',
  'test:mobile-r1-integration-3',
  'verify:mobile-r1-integration-3',
  'verify:mobile-r1-integration-final',
]) {
  assert.equal(typeof pkg.scripts[name], 'string', 'script Mobile ausente: ' + name);
}

const workflow = read('.github/workflows/application-ci.yml');
for (const marker of [
  'Central Móvel R1 scanner contract tests',
  'Central Móvel R1 Integration 1 domain tests',
  'Central Móvel R1 physical query domain tests',
  'Central Móvel R1 MOBILE-C intake allocation domain tests',
  'Central Móvel R1 Integration 2 domain tests',
  'Central Móvel R1 MOBILE-F inventory domain tests',
  'Central Móvel R1 MOBILE-G outbound domain tests',
  'Central Móvel R1 MOBILE-H position check domain tests',
  'Central Móvel R1 Integration 3 domain tests',
  'Central Móvel R1 MOBILE-I integrated product guard',
]) {
  assert.equal(
    workflow.includes(marker),
    true,
    'Application CI deve preservar gate: ' + marker
  );
}

console.log('MOBILE-R1 MOBILE-I INTEGRATED PRODUCT: PASS');
console.log('- Home expõe A–H, incluindo consulta física já disponível');
console.log('- navegação Home/Central permanece única e compartilhada');
console.log('- Auth/workspace/sessão/legal/warehouseAccess continuam no boundary canônico');
console.log('- scanner e resolver EPX1 permanecem compartilhados nas jornadas físicas');
console.log('- ALLOCATE/TRANSFER/INVENTORY/OUTBOUND reutilizam autoridades canônicas');
console.log('- consulta e conferência permanecem read-only');
console.log('- CT-01 permanece preservada para o futuro Release Candidate');
