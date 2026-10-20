#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'scripts/warehouse-mobile-write-forensics-readonly.mjs'), 'utf8');

function canonicalUnit(v) { return { code: v.code, label: v.label ?? null }; }
function canonicalPosition(v) { return { kind: v.kind, depotId: v.depotId, locationId: v.locationId, subpositionId: v.subpositionId ?? null }; }

test('collector is GET-only and scoped to Production warehouse identity', () => {
  assert.match(source, /method:\s*'GET'/);
  assert.match(source, /gen-lang-client-0982077967/);
  assert.match(source, /emprovex-warehouse/);
  assert.match(source, /hgesm-aprov/);
  for (const pattern of [/method:\s*'POST'/, /method:\s*'PUT'/, /method:\s*'PATCH'/, /method:\s*'DELETE'/, /documents:commit/, /batchWrite/, /runTransaction\s*\(/, /setDoc\s*\(/, /updateDoc\s*\(/, /deleteDoc\s*\(/]) assert.doesNotMatch(source, pattern);
});

test('legacy barcode presentation projection can differ from raw map', () => {
  const raw = { code: 'l' };
  assert.deepEqual(canonicalUnit(raw), { code: 'l', label: null });
  assert.notDeepEqual(canonicalUnit(raw), raw);
});

test('legacy LOCATION projection can add required subpositionId:null', () => {
  const raw = { kind: 'LOCATION', depotId: 'dep_x', locationId: 'loc_x' };
  assert.deepEqual(canonicalPosition(raw), { ...raw, subpositionId: null });
  assert.equal('subpositionId' in raw, false);
});
