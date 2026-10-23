#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const src=readFileSync(resolve('scripts/dev-warehouse-isolated.mjs'),'utf8');
const config=JSON.parse(readFileSync(resolve('firebase.warehouse-server-only-browser-test.json'),'utf8'));
const pkg=JSON.parse(readFileSync(resolve('package.json'),'utf8'));

test('o runner interativo tem sintaxe Node válida e comando npm acessível',()=>{
  const parsed=spawnSync(process.execPath,['--check','scripts/dev-warehouse-isolated.mjs'],{
    encoding:'utf8',timeout:10000,
  });
  assert.equal(parsed.status,0,parsed.stderr);
  assert.equal(pkg.scripts['dev:warehouse:isolated'],'node scripts/dev-warehouse-isolated.mjs');
});

test('modo operacional usa somente projeto demo e emuladores em portas locais',()=>{
  assert.match(src,/PROJECT = 'demo-emprovex-security'/);
  assert.match(src,/NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS:'1'/);
  assert.match(src,/NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID:PROJECT/);
  assert.match(src,/EMPROVEX_WAREHOUSE_ADMIN_EMULATOR:'1'/);
  assert.match(src,/FIREBASE_AUTH_EMULATOR_HOST:'127\.0\.0\.1:9099'/);
  assert.match(src,/FIRESTORE_EMULATOR_HOST:'127\.0\.0\.1:8080'/);
  assert.match(src,/EMPROVEX_E2E_WAREHOUSE_FIRESTORE_PORT:'8081'/);
  assert.match(src,/delete demoEnv\.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON/);
  assert.match(src,/delete demoEnv\.GOOGLE_APPLICATION_CREDENTIALS/);
  assert.match(src,/await runSeed\('scripts\/firestore-multitenancy-security\.test\.mjs'/);
  assert.match(src,/await runSeed\('scripts\/warehouse-e2e-fixture\.mjs'/);
  assert.match(src,/for\(const port of \[8080,8081,9099,3100\]\)/);
});

test('Warehouse Emulator não tem endpoint público nem Rule de escrita do cliente',()=>{
  assert.equal(config.firestore[0].database,'emprovex-warehouse');
  assert.equal(config.firestore[0].rules,'firestore.warehouse.server-only.rules');
  assert.equal(config.emulators.firestore.host,'127.0.0.1');
  assert.equal(config.emulators.firestore.port,8081);
  assert.equal(config.emulators.ui.enabled,false);
});
