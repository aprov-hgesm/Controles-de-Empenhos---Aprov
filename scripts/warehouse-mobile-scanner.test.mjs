#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-mobile-scanner-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/mobileScanner.ts'),
    '--outDir',
    outDir,
    '--module',
    'commonjs',
    '--target',
    'ES2020',
    '--moduleResolution',
    'node',
    '--skipLibCheck',
    '--esModuleInterop',
  ],
  { cwd: root, stdio: 'pipe' }
);

const require = createRequire(import.meta.url);
const scanner = require(resolve(outDir, 'mobileScanner.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

test('normaliza leitura sem aceitar vazio, controle ou payload excessivo', () => {
  assert.equal(scanner.normalizeWarehouseMobileScanValue(' 7891234567890 '), '7891234567890');
  assert.equal(scanner.normalizeWarehouseMobileScanValue(''), null);
  assert.equal(scanner.normalizeWarehouseMobileScanValue('ABC\n123'), null);
  assert.equal(scanner.normalizeWarehouseMobileScanValue('x'.repeat(257)), null);
});

test('EXPECT_PRODUCT aceita apenas PRODUCT', () => {
  assert.equal(scanner.expectedWarehouseMobileScanKind('EXPECT_PRODUCT'), 'PRODUCT');
  assert.equal(scanner.isWarehouseMobileScanKindAccepted('EXPECT_PRODUCT', 'PRODUCT'), true);
  assert.equal(scanner.isWarehouseMobileScanKindAccepted('EXPECT_PRODUCT', 'LOCATION'), false);
  assert.equal(scanner.isWarehouseMobileScanKindAccepted('EXPECT_PRODUCT', 'UNKNOWN'), false);
});

test('estados de posição aceitam apenas LOCATION', () => {
  for (const expectation of [
    'EXPECT_LOCATION',
    'EXPECT_SOURCE_LOCATION',
    'EXPECT_DESTINATION_LOCATION',
  ]) {
    assert.equal(scanner.expectedWarehouseMobileScanKind(expectation), 'LOCATION');
    assert.equal(scanner.isWarehouseMobileScanKindAccepted(expectation, 'LOCATION'), true);
    assert.equal(scanner.isWarehouseMobileScanKindAccepted(expectation, 'PRODUCT'), false);
  }
});

test('evento mantém origem e recusa tipo incompatível sem mutação de domínio', () => {
  const event = scanner.buildWarehouseMobileScanEvent({
    value: 'LOC-A-01',
    kind: 'LOCATION',
    expectation: 'EXPECT_PRODUCT',
    source: 'MANUAL',
    scannedAt: '2026-10-02T12:00:00.000Z',
  });
  assert.equal(event.accepted, false);
  assert.equal(event.rejectionReason, 'TYPE_MISMATCH');
  assert.equal(event.source, 'MANUAL');
});

test('cooldown bloqueia double scan e libera após janela', () => {
  const guard = scanner.createWarehouseMobileCooldownGuard(900);
  assert.equal(guard.shouldAccept('ABC', 1000), true);
  assert.equal(guard.shouldAccept('ABC', 1200), false);
  assert.equal(guard.shouldAccept('ABC', 1900), true);
});

test('cooldown não bloqueia código diferente', () => {
  const guard = scanner.createWarehouseMobileCooldownGuard(900);
  assert.equal(guard.shouldAccept('ABC', 1000), true);
  assert.equal(guard.shouldAccept('DEF', 1050), true);
  guard.reset();
  assert.equal(guard.shouldAccept('DEF', 1100), true);
});
