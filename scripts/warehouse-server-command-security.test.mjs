#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const route = file('app/api/central-depositos/operations/route.ts');
const archive = file('lib/server/warehouseLedgerAndArchive.ts');
const health = file('app/api/central-depositos/health/route.ts');

test('LEDGER_MOVEMENT genérico nunca consegue disparar uma transação', () => {
  assert.match(route, /case 'LEDGER_MOVEMENT':\s*[\s\S]*?return reject\('WAREHOUSE_LEDGER_DIRECT_COMMAND_DISABLED',403\)/);
  assert.doesNotMatch(route, /warehouseLedgerMovementServer/);
  assert.match(archive, /export async function warehouseLedgerMovementServer/);
  assert.match(archive, /v\.type!=='INITIAL_BALANCE'/);
  assert.match(archive, /WAREHOUSE_SISCOFIS_LEDGER_ONLY/);
  assert.match(archive, /siscofis:marco-zero:/);
});

test('motores especializados continuam disponíveis', () => {
  for (const operation of ['TRANSFER', 'MATERIAL_SAVE', 'EXPRESS_OUTBOUND',
    'STOCK_RETURN', 'INVENTORY_ADJUST', 'INVENTORY_START']) {
    assert.match(route, new RegExp("case '" + operation + "':"));
  }
  assert.match(archive, /export async function warehouseStructureArchiveServer/);
});

test('preflight de hospedagem é autenticado, read-only e não vaza chaves', () => {
  assert.match(health, /await verifyWarehouseFounderRequest/);
  assert.match(health, /await getGoogleAccessToken/);
  assert.match(health, /await warehouseAdminTransaction/);
  assert.match(health, /writes:\s*\[\]/);
  assert.match(health, /'cache-control': 'no-store'/);
  assert.doesNotMatch(health, /return.*(accessToken|private_key|FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON)/);
});
