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
  'lib/warehouse/intakeRepository.ts',
  'lib/warehouse/intakeAllocationRepository.ts',
  'lib/warehouse/manualEntryRepository.ts',
  'lib/warehouse/withdrawalRepository.ts',
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
const serverTransfer = read('lib/server/warehouseTransfer.ts');
const operationsRoute = read('app/api/central-depositos/operations/route.ts');
const transferClient = repository.slice(
  repository.indexOf('export async function transferWarehouseStock('),
  repository.indexOf('export function buildWarehousePositionLabel(')
);
// Depois do R2, a UI móvel permanece um cliente fino; a transação e as
// rejeições de posições inválidas pertencem ao motor autenticado no servidor.
assert.match(transferClient, /warehouseServerCommand<TransferWarehouseStockResult>/);
assert.match(transferClient, /'TRANSFER'/);
assert.doesNotMatch(transferClient, /\b(runTransaction|setDoc|updateDoc|writeBatch)\s*\(/);
assert.match(operationsRoute, /verifyWarehouseRequest/);
assert.match(operationsRoute, /transferWarehouseStockServer\(access,body\.input\)/);
assert.match(serverTransfer, /isWarehousePhysicalStockPosition\(fromCandidate\)/);
assert.match(serverTransfer, /isWarehousePhysicalStockPosition\(toCandidate\)/);
assert.match(serverTransfer, /WAREHOUSE_TRANSFER_INVALID_POSITION/);
assert.match(serverTransfer, /warehouseStockPositionsEqual/);
assert.match(serverTransfer, /planWarehouseTransferLots/);
assert.match(serverTransfer, /warehouseAdminTransaction<TransferWarehouseStockResult>/);
assert.match(serverTransfer, /WAREHOUSE_TRANSFER_CLIENT_LOT_PLAN_FORBIDDEN/);
assert.doesNotMatch(serverTransfer, /from\.kind !== 'UNASSIGNED'/);
assert.doesNotMatch(serverTransfer, /UNASSIGNED flows keep the legacy explicit/);
assert.doesNotMatch(serverTransfer, /fromInitial = from\.kind === 'UNASSIGNED'/);

const adapter = read('lib/warehouse/mobileTransfer.ts');
assert.match(adapter, /planWarehouseTransferLots/);
assert.match(adapter, /prepareWarehousePhysicalTransfer/);
assert.match(adapter, /Compatibility adapter/);

const transferUi = read('features/warehouse/mobile/WarehouseMobileTransfer.tsx');
assert.match(transferUi, /transferWarehouseStock/);
assert.match(transferUi, /technicalOperationCode/);
assert.doesNotMatch(transferUi, /listWarehouseMobileTransferLotsCritical/);
assert.doesNotMatch(transferUi, /lotAllocations\s*:/);
assert.doesNotMatch(transferUi, /relocateLotIds\s*:/);

const outboundUi = read('features/warehouse/mobile/WarehouseMobileOutbound.tsx');
assert.match(outboundUi, /finalizeWarehouseMaterialWithdrawal/);
assert.match(outboundUi, /Saída confirmada\. A atualização visual dos saldos falhou/);
assert.match(outboundUi, /Replay idempotente confirmou que a saída já estava finalizada/);
assert.match(outboundUi, /technicalConfirmationCode/);
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

const legacyIntakeV1 = read('lib/warehouse/intakeRepository.ts');
assert.match(
  legacyIntakeV1,
  /WAREHOUSE_LEGACY_INTAKE_RECONCILIATION_REQUIRED/
);
assert.doesNotMatch(legacyIntakeV1, /transferWarehouseStock\s*\(/);
assert.doesNotMatch(
  legacyIntakeV1,
  /from:\s*\{ kind: 'UNASSIGNED' \}/
);

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
const intakeServerRoute = read('app/api/central-depositos/intake-action/route.ts');
assert.match(intakeAllocation, /allocateWarehousePendingItemFast/);
assert.equal(intakeAllocation.includes('runTransaction('), false);
assert.match(intakeServerRoute, /action: 'ALLOCATE'/);
assert.equal(intakeServerRoute.includes("position.kind === 'UNASSIGNED'"), true);
assert.match(intakeServerRoute, /WAREHOUSE_INTAKE_LOCATION_REQUIRED/);
assert.match(intakeAllocation, /position\.kind === 'UNASSIGNED'/);
assert.match(intakeAllocation, /WAREHOUSE_INTAKE_LOCATION_REQUIRED/);

const manualEntry = read('lib/warehouse/manualEntryRepository.ts');
const manualServer = read('lib/server/warehouseManualEntry.ts');
assert.match(manualEntry, /api\/central-depositos\/manual-entry/);
assert.match(manualServer, /validateWarehouseStockPosition/);
assert.match(manualServer, /position\.kind === 'UNASSIGNED'/);
assert.match(manualServer, /WAREHOUSE_MANUAL_ENTRY_POSITION_REQUIRED/);
assert.match(manualServer, /assertPosition\(/);
assert.doesNotMatch(manualEntry, /runTransaction\s*\(/);
assert.doesNotMatch(manualEntry, /allowUnassignedPosition/);
assert.doesNotMatch(manualServer, /transferWarehouseStock\s*\(/);
assert.doesNotMatch(manualServer, /from:\s*\{ kind: 'UNASSIGNED' \}/);

const withdrawalRepository = read('lib/warehouse/withdrawalRepository.ts');
const returnServer = read('lib/server/warehouseReturnWrite.ts');
assert.match(withdrawalRepository, /warehouseServerCommand/);
assert.match(returnServer, /WAREHOUSE_OUTBOUND_RETURN_RECONCILIATION_REQUIRED/);
assert.match(returnServer, /locationBalance/);
assert.doesNotMatch(withdrawalRepository, /allowUnassignedPosition/);

const outboundRepository = read('lib/warehouse/outboundRepository.ts');
const outboundServer = read('lib/server/warehouseOutboundWrite.ts');
assert.match(outboundRepository, /warehouseServerCommand/);
assert.match(outboundServer, /WAREHOUSE_OUTBOUND_REQUIRES_PHYSICAL_POSITION/);

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
console.log('- Mobile delega TRANSFER e lotes ao motor canônico server-only, e retirada ao withdrawal canônico');
console.log('- intake v2 continua autoridade de pendingQuantity');
console.log('- legado UNASSIGNED permanece isolado na ponte técnica do intake');
console.log('- Entrada Avulsa e devolução normal exigem posição física canônica');
