#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

for (const path of [
  'app/central-mobile/saida/page.tsx',
  'features/warehouse/mobile/WarehouseMobileOutbound.tsx',
  'lib/warehouse/mobileOutbound.ts',
  'lib/warehouse/mobileOutboundRepository.ts',
  'scripts/mobile-r1-outbound.test.mjs',
]) {
  assert.equal(existsSync(resolve(root, path)), true, 'MOBILE-G ausente: ' + path);
}

const mobile = read('lib/warehouse/mobileOutbound.ts');
assert.match(mobile, /classifyWarehouseMobileProductScan/);
assert.match(mobile, /prepareWarehouseExpressOutbound/);
assert.match(mobile, /selectWarehouseFefoLot/);
assert.match(mobile, /WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK/);
assert.match(mobile, /warehouseMobileOutboundScannedPositionMatches/);

const reader = read('lib/warehouse/mobileOutboundRepository.ts');
assert.match(reader, /getDoc/);
assert.match(reader, /getDocs/);
assert.match(reader, /validateWarehouseMaterial/);
assert.match(reader, /validateWarehouseBalance/);
assert.match(reader, /validateWarehouseLocationBalance/);
assert.match(reader, /validateWarehouseLot/);
assert.match(reader, /WAREHOUSE_MOBILE_OUTBOUND_LOCATION_LIMIT/);
assert.match(reader, /WAREHOUSE_MOBILE_OUTBOUND_LOT_LIMIT/);
assert.doesNotMatch(reader, /\bsetDoc\s*\(/);
assert.doesNotMatch(reader, /\bupdateDoc\s*\(/);
assert.doesNotMatch(reader, /\brunTransaction\s*\(/);
assert.doesNotMatch(
  reader,
  /catch[\s\S]{0,900}return\s*\[\]/,
  'reader crítico da MOBILE-G não pode converter erro em []'
);

const ui = read('features/warehouse/mobile/WarehouseMobileOutbound.tsx');
assert.match(ui, /WarehouseMobileScanner/);
assert.match(ui, /EXPECT_PRODUCT/);
assert.match(ui, /EXPECT_LOCATION/);
assert.match(ui, /resolveWarehouseStockPositionBarcode/);
assert.match(ui, /createWarehouseOutboundIdempotencyKey/);
assert.match(ui, /applyWarehouseExpressOutbound/);
assert.match(ui, /CONFIRMAR SAÍDA/);
assert.match(ui, /Replay idempotente/);
assert.match(ui, /replay seguro/);
assert.match(ui, /Destino/);
assert.match(ui, /Retirado por/);
assert.match(ui, /FEFO/);
assert.doesNotMatch(ui, /\bsetDoc\s*\(/);
assert.doesNotMatch(ui, /\bupdateDoc\s*\(/);
assert.doesNotMatch(ui, /\brunTransaction\s*\(/);

const canonical = read('lib/warehouse/outboundRepository.ts');
assert.match(canonical, /runTransaction/);
assert.match(canonical, /movementSnapshot\.exists\(\)/);
assert.match(canonical, /applied: false/);
assert.match(canonical, /WAREHOUSE_IDEMPOTENCY_CONFLICT/);
assert.match(canonical, /WAREHOUSE_OUTBOUND_LOCATION_INSUFFICIENT_STOCK/);
assert.match(canonical, /WAREHOUSE_OUTBOUND_NEGATIVE_STOCK/);
assert.match(canonical, /transaction\.set\(movementRef/);
assert.match(canonical, /transaction\.set\(balanceRef/);
assert.match(canonical, /transaction\.set\(locationBalanceRef/);

const routeSource = read('app/central-mobile/saida/page.tsx');
assert.match(routeSource, /WarehouseMobileOutbound/);

const home = read('features/warehouse/mobile/WarehouseMobileHome.tsx');
assert.match(home, /href: '\/central-mobile\/saida'/);

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.scripts['test:mobile-r1-outbound'],
  'node --test scripts/mobile-r1-outbound.test.mjs'
);
assert.equal(
  packageJson.scripts['verify:mobile-r1-outbound'],
  'node scripts/verify-mobile-r1-outbound.mjs'
);

const workflow = read('.github/workflows/application-ci.yml');
assert.match(workflow, /Central Móvel R1 MOBILE-G outbound domain tests/);
assert.match(workflow, /Central Móvel R1 MOBILE-G outbound guard/);

console.log('MOBILE-G outbound guard: PASS');
console.log('- OUTBOUND canônico é a única mutação da jornada móvel');
console.log('- scanner, EPX1/resolver, FEFO, lote, posição e idempotência são reutilizados');
console.log('- reader MOBILE-G é bounded/fail-closed e não possui writes');
console.log('- UI exige confirmação humana e preserva replay seguro');
