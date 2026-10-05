#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

for (const path of [
  'lib/warehouse/transfer.ts',
  'lib/warehouse/locationRepository.ts',
  'lib/warehouse/mobileTransfer.ts',
  'lib/warehouse/intakeState.ts',
  'lib/warehouse/intakeAllocationRepository.ts',
  'features/warehouse/mobile/WarehouseMobileTransfer.tsx',
  'features/warehouse/mobile/WarehouseMobileItemQuery.tsx',
  'features/warehouse/mobile/WarehouseMobileOutbound.tsx',
  'features/warehouse/components/warehouseIntakePresentation.ts',
  'features/warehouse/components/WarehouseLocationsOperational.tsx',
  'features/warehouse/components/WarehouseSiscofisPendingAllocation.tsx',
  'lib/warehouse/pendingPhysicalAllocationRepository.ts',
]) {
  assert.equal(existsSync(resolve(root, path)), true, 'MOBILE-K ausente: ' + path);
}

const transfer = read('lib/warehouse/transfer.ts');
assert.match(transfer, /isWarehousePhysicalStockPosition/);
assert.match(transfer, /prepareWarehousePhysicalTransfer/);
assert.match(transfer, /NON_PHYSICAL_POSITION/);

const repository = read('lib/warehouse/locationRepository.ts');
assert.match(repository, /WAREHOUSE_TRANSFER_REQUIRES_PHYSICAL_POSITION/);
assert.match(repository, /buildCanonicalWarehouseTransferLotPlan/);
assert.match(repository, /isWarehousePhysicalStockPosition\(from\)/);
assert.match(repository, /isWarehousePhysicalStockPosition\(to\)/);
assert.doesNotMatch(repository, /from\.kind !== 'UNASSIGNED'/);
assert.doesNotMatch(repository, /UNASSIGNED flows keep the legacy explicit/);
assert.doesNotMatch(repository, /fromInitial = from\.kind === 'UNASSIGNED'/);

const adapter = read('lib/warehouse/mobileTransfer.ts');
assert.match(adapter, /planWarehouseTransferLots/);
assert.match(adapter, /prepareWarehousePhysicalTransfer/);
assert.match(adapter, /Compatibility adapter/);

const transferUi = read('features/warehouse/mobile/WarehouseMobileTransfer.tsx');
assert.match(transferUi, /transferWarehouseStock/);
assert.doesNotMatch(transferUi, /listWarehouseMobileTransferLotsCritical/);
assert.doesNotMatch(transferUi, /lotAllocations\s*:/);
assert.doesNotMatch(transferUi, /relocateLotIds\s*:/);

const outboundUi = read('features/warehouse/mobile/WarehouseMobileOutbound.tsx');
assert.match(outboundUi, /finalizeWarehouseMaterialWithdrawal/);
assert.match(outboundUi, /createWarehouseWithdrawalId/);
assert.match(outboundUi, /createWarehouseWithdrawalLineId/);
assert.match(outboundUi, /listWarehouseDestinationsCached/);
assert.match(outboundUi, /createWarehouseDestination/);
assert.match(outboundUi, /destinationId/);
assert.doesNotMatch(outboundUi, /WAREHOUSE_MOBILE_OUTBOUND_DESTINATION_AMBIGUOUS/);
assert.doesNotMatch(outboundUi, /applyWarehouseExpressOutbound\s*\(/);

const itemQuery = read('features/warehouse/mobile/WarehouseMobileItemQuery.tsx');
assert.match(itemQuery, /Estoque físico localizado:/);
assert.match(itemQuery, /Pendências de alocação pertencem ao intake/);
assert.match(itemQuery, /Reconciliação necessária:/);
assert.doesNotMatch(itemQuery, /Saldo sem localização:/);

const intakePresentation = read(
  'features/warehouse/components/warehouseIntakePresentation.ts'
);
assert.doesNotMatch(intakePresentation, /quantidade disponível em Sem localização/);

const desktopLocations = read(
  'features/warehouse/components/WarehouseLocationsOperational.tsx'
);
assert.doesNotMatch(desktopLocations, /deriveUnassignedQuantity\(/);
assert.match(desktopLocations, /row\.position\.kind !== 'UNASSIGNED'/);
assert.match(desktopLocations, /Legado em reconciliação/);
assert.doesNotMatch(desktopLocations, />Sem localização</);

const legacySiscofis = read(
  'lib/warehouse/pendingPhysicalAllocationRepository.ts'
);
assert.match(
  legacySiscofis,
  /WAREHOUSE_PENDING_ALLOCATION_RECONCILIATION_REQUIRED/
);
assert.doesNotMatch(legacySiscofis, /transferWarehouseStock\s*\(/);
assert.doesNotMatch(legacySiscofis, /from:\s*\{ kind: 'UNASSIGNED' \}/);

const legacySiscofisUi = read(
  'features/warehouse/components/WarehouseSiscofisPendingAllocation.tsx'
);
assert.match(legacySiscofisUi, /reconciliação legada/);
assert.match(legacySiscofisUi, /Revisar reconciliação/);
assert.doesNotMatch(legacySiscofisUi, /Saldo sem localização/);

const intakeState = read('lib/warehouse/intakeState.ts');
for (const marker of [
  'pendingQuantity',
  "'PENDING'",
  "'PARTIALLY_PROCESSED'",
  "'PROCESSED'",
  "'RECONCILIATION_REQUIRED'",
]) {
  assert.equal(intakeState.includes(marker), true, 'intake v2 perdeu contrato: ' + marker);
}

const intakeAllocation = read('lib/warehouse/intakeAllocationRepository.ts');
assert.match(intakeAllocation, /const from: WarehouseStockPosition = \{ kind: 'UNASSIGNED' \}/);
assert.match(intakeAllocation, /position\.kind === 'UNASSIGNED'/);
assert.match(intakeAllocation, /WAREHOUSE_INTAKE_LOCATION_REQUIRED/);

const outboundRepository = read('lib/warehouse/outboundRepository.ts');
assert.match(outboundRepository, /WAREHOUSE_OUTBOUND_REQUIRES_PHYSICAL_POSITION/);

const pkg = JSON.parse(read('package.json'));
assert.equal(
  pkg.scripts['test:mobile-k-canonical-ops'],
  'node --test scripts/mobile-k-canonical-ops.test.mjs'
);
assert.equal(
  pkg.scripts['verify:mobile-k-canonical-ops'],
  'node scripts/verify-mobile-k-canonical-ops.mjs'
);

const workflow = read('.github/workflows/application-ci.yml');
assert.match(workflow, /MOBILE-K canonical ops domain tests/);
assert.match(workflow, /MOBILE-K canonical ops permanent guard/);

console.log('MOBILE-K canonical ops guard: PASS');
console.log('- UNASSIGNED ficou fora de Transferência e Saída operacionais');
console.log('- Mobile delega lotes ao motor canônico e retirada ao withdrawal canônico');
console.log('- intake v2 continua autoridade de pendingQuantity');
console.log('- legado UNASSIGNED permanece isolado na ponte técnica do intake');
