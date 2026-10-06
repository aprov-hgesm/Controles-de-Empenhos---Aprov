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
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-mobile-integration-1-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/mobileLocationScan.ts'),
    resolve(root, 'lib/warehouse/locationBarcode.ts'),
    resolve(root, 'lib/warehouse/mobileScanner.ts'),
    resolve(root, 'lib/warehouse/location.ts'),
    resolve(root, 'lib/warehouse/material.ts'),
    resolve(root, 'lib/platformIdentity.ts'),
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
const scan = require(resolve(outDir, 'warehouse/mobileLocationScan.js'));
const locationBarcode = require(resolve(outDir, 'warehouse/locationBarcode.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

test('EPX1 válido é classificado exclusivamente como LOCATION', () => {
  const code = locationBarcode.encodeWarehouseLocationBarcode({
    kind: 'LOCAL',
    entityId: 'loc_' + '1'.repeat(32),
  });
  assert.equal(scan.classifyWarehouseMobileLocationScan(code), 'LOCATION');
});

test('barcode comercial não é aceito como posição', () => {
  assert.equal(
    scan.classifyWarehouseMobileLocationScan('7891234567890'),
    'UNKNOWN'
  );
});

test('EPX1 malformado falha fechado', () => {
  assert.equal(
    scan.classifyWarehouseMobileLocationScan('EPX12INVALIDO'),
    'UNKNOWN'
  );
});
