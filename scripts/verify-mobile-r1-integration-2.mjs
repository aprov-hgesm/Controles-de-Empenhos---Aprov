#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

for (const path of [
  'app/central-mobile/alocar/page.tsx',
  'app/central-mobile/transferir/page.tsx',
  'app/central-mobile/consultar-localizacao/page.tsx',
  'features/warehouse/mobile/WarehouseMobilePhysicalQueryResult.tsx',
  'features/warehouse/mobile/WarehouseMobileTransfer.tsx',
  'lib/warehouse/mobileIntakeAllocation.ts',
  'lib/warehouse/mobilePhysicalQueryModel.ts',
  'lib/warehouse/mobileTransfer.ts',
  'lib/warehouse/mobileTransferLotRepository.ts',
]) {
  assert.equal(existsSync(resolve(root, path)), true, 'Integração 2 ausente: ' + path);
}

const transfer = read('lib/warehouse/mobileTransfer.ts');
assert.match(transfer, /classifyWarehouseMobileProductScan/);
assert.match(
  transfer,
  /return classifyWarehouseMobileProductScan\(value\)/,
  'MOBILE-D deve delegar ao classificador canônico da MOBILE-C'
);
assert.match(transfer, /WAREHOUSE_TRANSFER_MAX_ACTIVE_LOTS/);
assert.match(transfer, /planWarehouseTransferLots/);
assert.match(transfer, /prepareWarehousePhysicalTransfer/);
assert.match(transfer, /isWarehousePhysicalStockPosition/);
assert.doesNotMatch(
  transfer,
  /PARTIAL_WITH_ACTIVE_LOTS_UNSUPPORTED/,
  'Transferência parcial com lote reconciliado não deve ser bloqueada'
);

const criticalLots = read('lib/warehouse/mobileTransferLotRepository.ts');
assert.match(criticalLots, /WAREHOUSE_MOBILE_TRANSFER_CRITICAL_LOT_FETCH_LIMIT/);
assert.match(criticalLots, /WAREHOUSE_MOBILE_TRANSFER_LOTS_SATURATED/);
assert.match(criticalLots, /WAREHOUSE_MOBILE_TRANSFER_LOTS_READ_FAILED/);
assert.doesNotMatch(
  criticalLots,
  /catch[\s\S]{0,900}return\s*\[\]/,
  'reader crítico da transferência não pode converter erro em []'
);

const physical = read('features/warehouse/mobile/WarehouseMobilePhysicalQueryResult.tsx');
for (const forbidden of ['setDoc(', 'updateDoc(', 'runTransaction(']) {
  assert.equal(
    physical.includes(forbidden),
    false,
    'MOBILE-E deve permanecer read-only: ' + forbidden
  );
}

const home = read('features/warehouse/mobile/WarehouseMobileHome.tsx');
assert.match(home, /href: '\/central-mobile\/alocar'/);
assert.match(home, /href: '\/central-mobile\/transferir'/);
assert.match(home, /href: '\/central-mobile\/consultar-localizacao'/);
assert.doesNotMatch(home, /WarehouseMobileLocationFoundationCheck/);

const allocationPage = read('features/warehouse/mobile/WarehouseMobileIntakeAllocation.tsx');
assert.match(allocationPage, /allocateWarehousePendingItemFast/);
assert.doesNotMatch(allocationPage, /\bsetDoc\s*\(/);
assert.doesNotMatch(allocationPage, /\bupdateDoc\s*\(/);

const transferPage = read('features/warehouse/mobile/WarehouseMobileTransfer.tsx');
assert.match(transferPage, /transferWarehouseStock/);
assert.doesNotMatch(transferPage, /listWarehouseMobileTransferLotsCritical/);
assert.doesNotMatch(transferPage, /lotAllocations\s*:/);
assert.doesNotMatch(transferPage, /relocateLotIds\s*:/);
assert.doesNotMatch(transferPage, /\bsetDoc\s*\(/);
assert.doesNotMatch(transferPage, /\bupdateDoc\s*\(/);
assert.doesNotMatch(transferPage, /\bOUTBOUND\b/);

const locationRepository = read('lib/warehouse/locationRepository.ts');
assert.match(locationRepository, /createWarehouseTransferSplitLotId/);
assert.match(locationRepository, /WAREHOUSE_TRANSFER_LOT_SPLIT_INVALID/);
assert.match(locationRepository, /validateWarehouseLot/);
assert.match(locationRepository, /WAREHOUSE_TRANSFER_REQUIRES_PHYSICAL_POSITION/);
assert.match(locationRepository, /buildCanonicalWarehouseTransferLotPlan/);
assert.doesNotMatch(locationRepository, /UNASSIGNED flows keep the legacy explicit/);

const pkg = JSON.parse(read('package.json'));
assert.equal(
  pkg.scripts['test:mobile-r1-integration-2'],
  'node --test scripts/mobile-r1-integration-2.test.mjs'
);
assert.equal(
  pkg.scripts['verify:mobile-r1-integration-2'],
  'node scripts/verify-mobile-r1-integration-2.mjs'
);

const workflow = read('.github/workflows/application-ci.yml');
assert.match(workflow, /Central Móvel R1 Integration 2 domain tests/);
assert.match(workflow, /Central Móvel R1 Integration 2 guard/);

console.log('MOBILE-R1 INTEGRATION 2: PASS');
console.log('- alocação, consulta de localização e transferência compartilham posições e autoridades canônicas');
console.log('- transferência preserva total físico e classificação de produto única');
console.log('- lotes críticos permanecem fail-closed');
console.log('- consulta física permanece read-only');
