#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

for (const path of [
  'app/central-mobile/layout.tsx',
  'app/central-mobile/page.tsx',
  'features/warehouse/mobile/WarehouseMobileProtectedLayout.tsx',
  'features/warehouse/mobile/WarehouseMobileShell.tsx',
  'features/warehouse/mobile/WarehouseMobileHome.tsx',
  'features/warehouse/mobile/WarehouseMobileScanner.tsx',
  'features/warehouse/mobile/scannerDecoder.ts',
  'lib/warehouse/mobileScanner.ts',
]) {
  assert.equal(existsSync(resolve(root, path)), true, 'Arquivo MOBILE-A ausente: ' + path);
}

const nextConfig = read('next.config.ts');
assert.match(nextConfig, /reactStrictMode:\s*true/);
assert.match(
  nextConfig,
  /camera=\(self\),\s*microphone=\(\),\s*geolocation=\(\)/
);
assert.equal(
  /camera=\(\)/.test(nextConfig),
  false,
  'Permissions-Policy voltou a bloquear a câmera da própria origem.'
);

const protectedSurface = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
assert.match(protectedSurface, /export function WarehouseAccessBoundary/);
assert.match(protectedSurface, /onAuthStateChanged/);
assert.match(protectedSurface, /requestWarehouseStatus/);
assert.match(protectedSurface, /startWorkspaceSessionControl/);
assert.match(protectedSurface, /LegalAcceptanceGate/);
assert.match(protectedSurface, /WarehouseWorkspaceProvider/);
assert.match(protectedSurface, /<WarehouseModuleShell workspaceContext=\{workspaceContext\}>/);

const mobileProtected = read('features/warehouse/mobile/WarehouseMobileProtectedLayout.tsx');
assert.match(mobileProtected, /WarehouseAccessBoundary/);
assert.match(mobileProtected, /WarehouseMobileShell/);

const scanner = read('features/warehouse/mobile/WarehouseMobileScanner.tsx');
assert.match(scanner, /import\('\.\/scannerDecoder'\)/);
assert.match(scanner, /navigator\.mediaDevices/);
assert.match(scanner, /playsInline/);
assert.match(scanner, /MANUAL/);
assert.match(scanner, /stopRef\.current\?\.\(\)/);

const lifecycleEffectStart = scanner.indexOf('useEffect(() => {');
const mountedSetup = scanner.indexOf('mountedRef.current = true;', lifecycleEffectStart);
const mountedCleanup = scanner.indexOf('mountedRef.current = false;', mountedSetup);
const teardownStop = scanner.indexOf('stopRef.current?.();', mountedCleanup);
const teardownNull = scanner.indexOf('stopRef.current = null;', teardownStop);
const lifecycleEffectEnd = scanner.indexOf('}, []);', teardownNull);

assert.ok(lifecycleEffectStart >= 0, 'Effect de lifecycle do scanner ausente.');
assert.ok(
  mountedSetup > lifecycleEffectStart,
  'Strict Mode exige restaurar mountedRef.current = true no setup.'
);
assert.ok(
  mountedCleanup > mountedSetup,
  'Cleanup deve marcar mountedRef.current = false depois do setup.'
);
assert.ok(
  teardownStop > mountedCleanup,
  'Cleanup deve continuar encerrando a câmera.'
);
assert.ok(
  teardownNull > teardownStop,
  'Cleanup deve continuar anulando stopRef após encerrar a câmera.'
);
assert.ok(
  lifecycleEffectEnd > teardownNull,
  'Setup/cleanup do lifecycle deve permanecer no mesmo effect sem dependências.'
);

const decoder = read('features/warehouse/mobile/scannerDecoder.ts');
assert.match(decoder, /@zxing\/browser/);
assert.match(decoder, /@zxing\/library/);
assert.match(decoder, /facingMode:\s*\{ ideal: 'environment' \}/);
assert.match(decoder, /controls\.stop\(\)/);

for (const desktopPath of [
  'features/warehouse/components/WarehouseModuleShell.tsx',
  'features/warehouse/components/WarehouseSectionContent.tsx',
  'app/adm-deposito/layout.tsx',
]) {
  const content = read(desktopPath);
  assert.equal(content.includes('@zxing/'), false, 'Decoder vazou para shell desktop: ' + desktopPath);
  assert.equal(content.includes('scannerDecoder'), false, 'Decoder vazou para shell desktop: ' + desktopPath);
}

const mobileDomain = read('lib/warehouse/mobileScanner.ts');
for (const state of [
  'EXPECT_PRODUCT',
  'EXPECT_LOCATION',
  'EXPECT_SOURCE_LOCATION',
  'EXPECT_DESTINATION_LOCATION',
]) {
  assert.match(mobileDomain, new RegExp(state));
}
for (const kind of ['PRODUCT', 'LOCATION', 'UNKNOWN']) {
  assert.match(mobileDomain, new RegExp(kind));
}

for (const forbidden of [
  'ledgerRepository',
  'intakeAllocationRepository',
  'outboundRepository',
  'inventoryRepository',
  'locationRepository',
  'barcodeRepository',
]) {
  assert.equal(scanner.includes(forbidden), false, 'Scanner importou domínio mutável: ' + forbidden);
  assert.equal(decoder.includes(forbidden), false, 'Decoder importou domínio mutável: ' + forbidden);
}

const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.dependencies['@zxing/browser'], '^0.1.5');
assert.equal(pkg.dependencies['@zxing/library'], '^0.21.3');
assert.equal(pkg.scripts['test:mobile-r1-scanner'], 'node --test scripts/warehouse-mobile-scanner.test.mjs');
assert.equal(pkg.scripts['verify:mobile-r1-platform-scanner'], 'node scripts/verify-mobile-r1-platform-scanner.mjs');

console.log('MOBILE-A PLATFORM/SCANNER: PASS');
console.log('- rota /central-mobile usa o gate existente de Auth/workspace/UG/sessão/legal');
console.log('- shell móvel é independente do shell desktop');
console.log('- decoder ZXing fica atrás de import() e só carrega ao ativar câmera');
console.log('- scanner não importa repositories mutáveis de estoque');
console.log('- fallback manual e teardown explícito permanecem presentes');
console.log('- Permissions-Policy permite camera same-origin e mantém microphone/geolocation bloqueados');
console.log('- lifecycle mountedRef é resiliente ao setup→cleanup→setup do React Strict Mode');
