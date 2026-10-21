#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

for (const path of [
  'app/operador-movel/alocar/page.tsx',
  'app/operador-movel/transferir/page.tsx',
  'app/operador-movel/consultar-localizacao/page.tsx',
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
assert.match(home, /href: '\/operador-movel\/alocar'/);
assert.match(home, /href: '\/operador-movel\/transferir'/);
assert.match(home, /href: '\/operador-movel\/consultar-localizacao'/);
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

// O MOTOR CANÔNICO de TRANSFER foi migrado para o backend confiável no R2.
const locationRepository = read('lib/warehouse/locationRepository.ts');
const serverTransfer = read('lib/server/warehouseTransfer.ts');
const operationsRoute = read('app/api/central-depositos/operations/route.ts');
const commandClient = read('lib/warehouse/serverCommandClient.ts');
const transport = locationRepository.slice(
  locationRepository.indexOf('export async function transferWarehouseStock('),
  locationRepository.indexOf('export function buildWarehousePositionLabel(')
);

assert.match(transport, /warehouseServerCommand<TransferWarehouseStockResult>/);
assert.match(transport, /'TRANSFER'/);
assert.doesNotMatch(transport, /\b(runTransaction|setDoc|updateDoc|writeBatch)\s*\(/,
  'MOBILE-D não pode gravar diretamente no Firestore');
assert.match(commandClient, /getIdToken\(\)/);
assert.match(commandClient, /\/api\/central-depositos\/operations/);
assert.match(operationsRoute, /verifyWarehouseRequest/);
assert.match(operationsRoute, /transferWarehouseStockServer\(access,body\.input\)/);

assert.match(serverTransfer, /warehouseAdminTransaction<TransferWarehouseStockResult>/);
assert.match(serverTransfer, /planWarehouseTransferLots/);
assert.match(serverTransfer, /isWarehousePhysicalStockPosition/);
assert.match(serverTransfer, /warehouseStockPositionsEqual/);
assert.match(serverTransfer, /warehouseMovementMatchesReplay/);
assert.match(serverTransfer, /WAREHOUSE_IDEMPOTENCY_CONFLICT/);
assert.match(serverTransfer, /WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK/);
assert.match(serverTransfer, /WAREHOUSE_TRANSFER_SPLIT_INVALID/);
assert.match(serverTransfer, /WAREHOUSE_TRANSFER_SPLIT_LOT_INVALID/);
assert.match(serverTransfer, /WAREHOUSE_TRANSFER_SPLIT_LOT_CONFLICT/);
assert.match(serverTransfer, /validateWarehouseLot/);
assert.match(serverTransfer, /createHash\('sha256'\)/);
assert.match(serverTransfer, /WAREHOUSE_TRANSFER_CLIENT_LOT_PLAN_FORBIDDEN/);
assert.match(serverTransfer, /quantityDelta:0/);
assert.doesNotMatch(serverTransfer, /UNASSIGNED flows keep the legacy explicit/);

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
console.log('- MOBILE-D usa TRANSFER server-only com FEFO, split, idempotência e saldo físico conservado');
console.log('- lotes críticos permanecem fail-closed');
console.log('- consulta física permanece read-only');
