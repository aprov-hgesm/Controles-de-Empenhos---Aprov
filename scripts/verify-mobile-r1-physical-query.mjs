#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

for (const path of [
  'lib/warehouse/mobilePhysicalQuery.ts',
  'lib/warehouse/mobilePhysicalQueryModel.ts',
  'features/warehouse/mobile/WarehouseMobilePhysicalQueryResult.tsx',
  'features/warehouse/mobile/WarehouseMobileLocationFoundationCheck.tsx',
]) {
  assert.equal(
    existsSync(resolve(root, path)),
    true,
    'Arquivo MOBILE-E ausente: ' + path
  );
}

const adapter = read('lib/warehouse/mobilePhysicalQuery.ts');
assert.match(adapter, /warehouseDomainPath\(scope\.workspaceId, 'locationBalances'\)/);
assert.match(adapter, /where\(plan\.field, '==', plan\.value\)/);
assert.match(adapter, /where\('position\.kind', '==', plan\.kind\)/);
assert.match(adapter, /WAREHOUSE_MOBILE_PHYSICAL_BALANCE_LIMIT \+ 1/);
assert.match(adapter, /WAREHOUSE_MOBILE_PHYSICAL_LOT_LIMIT \+ 1/);
assert.match(adapter, /getCurrentOperationalScope/);
assert.match(adapter, /recordWarehouseDocumentReads/);
assert.match(adapter, /listeners: 0/);
assert.match(adapter, /cache: 'none'/);
assert.doesNotMatch(adapter, /onSnapshot/);
assert.doesNotMatch(adapter, /listWarehouseLocationBalances/);

for (const forbidden of [
  'setDoc(',
  'updateDoc(',
  'addDoc(',
  'deleteDoc(',
  'runTransaction(',
  'writeBatch(',
]) {
  assert.equal(
    adapter.includes(forbidden),
    false,
    'MOBILE-E deve permanecer read-only: ' + forbidden
  );
}

const component = read('features/warehouse/mobile/WarehouseMobileLocationFoundationCheck.tsx');
assert.match(component, /expectation="EXPECT_LOCATION"/);
assert.match(component, /classifyWarehouseMobileLocationScan/);
assert.match(component, /resolveWarehouseStockPositionBarcode/);
assert.match(component, /loadWarehouseMobilePhysicalPositionContents/);
assert.match(component, /LER POSIÇÃO/);
assert.match(component, /Nenhum saldo ou movimento é alterado/);
assert.match(component, /Falha ao consultar o conteúdo esperado/);

const result = read('features/warehouse/mobile/WarehouseMobilePhysicalQueryResult.tsx');
assert.match(result, /O que deveria estar aqui\?/);
assert.match(result, /Nenhum material registrado nesta posição\./);
assert.match(result, /warehouseLotOriginLabel/);
assert.match(result, /lot\.expiresOn/);
assert.doesNotMatch(result, /button/i);

const model = read('lib/warehouse/mobilePhysicalQueryModel.ts');
assert.match(model, /position\.locationId/);
assert.match(model, /position\.subpositionId/);
assert.match(model, /WORKSPACE_MISMATCH/);
assert.match(model, /UG_MISMATCH/);
assert.match(model, /DUPLICATE_BALANCE/);

console.log('MOBILE-E PHYSICAL QUERY: PASS');
console.log('- consulta sob demanda por posição; sem listener contínuo');
console.log('- distribuição física oficial warehouse_location_balance_v1 preservada');
console.log('- material/lote/validade canônicos; nenhum campo inventado');
console.log('- fail-closed para escopo e inconsistência');
console.log('- nenhuma escrita de estoque, saldo ou ledger');
