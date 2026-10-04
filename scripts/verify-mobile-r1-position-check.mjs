#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

for (const path of [
  'app/central-mobile/conferir/page.tsx',
  'features/warehouse/mobile/WarehouseMobilePositionCheck.tsx',
  'lib/warehouse/mobilePositionCheck.ts',
  'lib/warehouse/mobilePositionCheckModel.ts',
  'scripts/mobile-r1-position-check.test.mjs',
]) {
  assert.equal(
    existsSync(resolve(root, path)),
    true,
    'Arquivo MOBILE-H ausente: ' + path
  );
}

const adapter = read('lib/warehouse/mobilePositionCheck.ts');
assert.match(adapter, /loadWarehouseMobilePhysicalPositionContents/);
assert.match(adapter, /warehouseDomainPath\(scope\.workspaceId, 'locationBalances'\)/);
assert.match(adapter, /where\('materialId', '==', materialId\)/);
assert.match(adapter, /WAREHOUSE_MOBILE_POSITION_CHECK_BALANCE_LIMIT \+ 1/);
assert.match(adapter, /resolveWarehouseStockPositionBarcode/);
assert.match(adapter, /validateWarehouseLocationBalance/);
assert.match(adapter, /getCurrentOperationalScope/);
assert.match(adapter, /recordWarehouseDocumentReads/);
assert.match(adapter, /listeners: 0/);
assert.match(adapter, /cache: 'none'/);
assert.doesNotMatch(adapter, /onSnapshot/);
assert.doesNotMatch(adapter, /listWarehousePositiveLocationBalances/);
assert.doesNotMatch(adapter, /listWarehouseLocationBalances/);

for (const forbidden of [
  'setDoc(',
  'updateDoc(',
  'addDoc(',
  'deleteDoc(',
  'runTransaction(',
  'writeBatch(',
  'transferWarehouseStock(',
  'allocateWarehousePendingItem',
  'EXPRESS_OUTBOUND',
  "type: 'TRANSFER'",
  "type: 'OUTBOUND'",
]) {
  assert.equal(
    adapter.includes(forbidden),
    false,
    'MOBILE-H deve permanecer read-only: ' + forbidden
  );
}

const model = read('lib/warehouse/mobilePositionCheckModel.ts');
assert.match(model, /status: 'CORRECT'/);
assert.match(model, /status: 'INCORRECT'/);
assert.match(model, /CONCURRENT_POSITION_CHANGE/);
assert.match(model, /WORKSPACE_MISMATCH/);
assert.match(model, /UG_MISMATCH/);
assert.match(model, /position\.kind === 'UNASSIGNED'/);

const component = read('features/warehouse/mobile/WarehouseMobilePositionCheck.tsx');
assert.match(component, /expectation="EXPECT_LOCATION"/);
assert.match(component, /expectation="EXPECT_PRODUCT"/);
assert.match(component, /classifyWarehouseMobileLocationScan/);
assert.match(component, /classifyWarehouseMobileProductScan/);
assert.match(component, /resolveWarehouseStockPositionBarcode/);
assert.match(component, /checkWarehouseMobileMaterialAtPosition/);
assert.match(component, />CORRETO</);
assert.match(component, /Material registrado nesta posição\./);
assert.match(component, />INCORRETO</);
assert.match(component, /Material não registrado nesta posição\./);
assert.match(component, /pathname: '\/central-mobile\/transferir'/);
assert.match(component, /Transferir material/);
assert.match(component, /Conferência detecta; Transferência corrige/);
assert.match(component, /data-check-writes="0"/);
assert.doesNotMatch(component, /\btransferWarehouseStock\b/);
assert.doesNotMatch(component, /\ballocateWarehousePendingItem/);
assert.doesNotMatch(component, /\bsetDoc\s*\(/);
assert.doesNotMatch(component, /\bupdateDoc\s*\(/);
assert.doesNotMatch(component, /\brunTransaction\s*\(/);

const home = read('features/warehouse/mobile/WarehouseMobileHome.tsx');
assert.match(home, /href: '\/central-mobile\/conferir'/);

const pkg = JSON.parse(read('package.json'));
assert.equal(
  pkg.scripts['test:mobile-r1-position-check'],
  'node --test scripts/mobile-r1-position-check.test.mjs'
);
assert.equal(
  pkg.scripts['verify:mobile-r1-position-check'],
  'node scripts/verify-mobile-r1-position-check.mjs'
);

const workflow = read('.github/workflows/application-ci.yml');
assert.match(workflow, /Central Móvel R1 MOBILE-H position check domain tests/);
assert.match(workflow, /Central Móvel R1 MOBILE-H position check guard/);

console.log('MOBILE-H POSITION CHECK: PASS');
console.log('- posição → material → projeção oficial → CORRETO/INCORRETO');
console.log('- alternativas limitadas por materialId e revalidadas pelo resolver EPX1');
console.log('- 0 listener contínuo; sem cache crítico; nenhuma escrita/ledger/TRANSFER');
console.log('- navegação para MOBILE-D sem mutação');
