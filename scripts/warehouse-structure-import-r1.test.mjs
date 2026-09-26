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
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-structure-import-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/structureImport.ts'),
    resolve(root, 'lib/warehouse/location.ts'),
    resolve(root, 'lib/platformIdentity.ts'),
    resolve(root, 'lib/warehouse/material.ts'),
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
const structureImport = require(resolve(outDir, 'warehouse/structureImport.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

test('prompt inclui contrato oficial e texto informal do usuário', () => {
  const prompt = structureImport.buildWarehouseStructureAiPrompt(
    'Meu depósito tem 2 estantes com 3 prateleiras cada e 1 freezer.'
  );
  assert.match(prompt, /emprovex_warehouse_import_v1/);
  assert.match(prompt, /2 estantes com 3 prateleiras/);
  assert.match(prompt, /kind="LOCAL"/);
  assert.match(prompt, /kind="SUBPOSITION"/);
  assert.match(prompt, /não inclua IDs internos/i);
});

test('JSON válido é normalizado e resumido', () => {
  const parsed = structureImport.parseWarehouseStructureImport(JSON.stringify({
    version: 'emprovex_warehouse_import_v1',
    depot: {
      code: ' dep-01 ',
      name: ' Gêneros Secos ',
      description: null,
    },
    locations: [
      {
        code: ' est-01 ',
        name: 'Estante 01',
        kind: 'LOCAL',
        description: null,
        children: [
          {
            code: ' prat-01 ',
            name: 'Prateleira 01',
            kind: 'SUBPOSITION',
            description: null,
          },
          {
            code: 'prat-02',
            name: 'Prateleira 02',
            kind: 'SUBPOSITION',
            description: null,
          },
        ],
      },
      {
        code: 'frz-01',
        name: 'Freezer 01',
        kind: 'LOCAL',
        description: null,
        children: [],
      },
    ],
  }));

  assert.equal(parsed.depot.code, 'DEP-01');
  assert.equal(parsed.locations[0].code, 'EST-01');
  assert.equal(parsed.locations[0].children[0].code, 'PRAT-01');

  const summary = structureImport.summarizeWarehouseStructureImport(parsed);
  assert.deepEqual(summary, {
    localCount: 2,
    subpositionCount: 2,
    totalCount: 4,
  });
});

test('rejeita versão errada, código duplicado e subposição solta', () => {
  assert.throws(
    () => structureImport.parseWarehouseStructureImport(JSON.stringify({
      version: 'outra-versao',
      depot: { code: 'DEP-01', name: 'Depósito', description: null },
      locations: [],
    })),
    /Versão de importação incompatível/
  );

  assert.throws(
    () => structureImport.parseWarehouseStructureImport(JSON.stringify({
      version: 'emprovex_warehouse_import_v1',
      depot: { code: 'DEP-01', name: 'Depósito', description: null },
      locations: [
        { code: 'EST-01', name: 'A', kind: 'LOCAL', description: null, children: [] },
        { code: 'EST-01', name: 'B', kind: 'LOCAL', description: null, children: [] },
      ],
    })),
    /Código de Local duplicado/
  );

  assert.throws(
    () => structureImport.parseWarehouseStructureImport(JSON.stringify({
      version: 'emprovex_warehouse_import_v1',
      depot: { code: 'DEP-01', name: 'Depósito', description: null },
      locations: [
        { code: 'PRAT-01', name: 'Prateleira', kind: 'SUBPOSITION', description: null, children: [] },
      ],
    })),
    /kind=LOCAL/
  );
});

test('rejeita importação vazia', () => {
  assert.throws(
    () => structureImport.parseWarehouseStructureImport(JSON.stringify({
      version: 'emprovex_warehouse_import_v1',
      depot: { code: 'DEP-01', name: 'Depósito', description: null },
      locations: [],
    })),
    /nenhuma localização/
  );
});
