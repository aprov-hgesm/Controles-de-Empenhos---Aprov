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
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-material-contract-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
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
const material = require(resolve(outDir, 'warehouse/material.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const deterministicId = 'mat_123e4567e89b12d3a456426614174000';

test('cria e normaliza o contrato canônico de material', () => {
  const result = material.createWarehouseMaterial({
    id: deterministicId,
    workspaceId: ' HGESM-APROV ',
    ug: '160.416',
    description: '  Arroz   parboilizado  ',
    aliases: [' Arroz beneficiado ', 'ARROZ BENEFICIADO', ' Arroz '],
    unit: { code: 'KG', label: null },
    conversions: [
      {
        presentation: { code: 'g', label: null },
        factorToBaseUnit: 0.001,
      },
      {
        presentation: { code: 'box', label: '  Caixa 30 kg  ' },
        factorToBaseUnit: 30,
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.id, deterministicId);
  assert.equal(result.data.workspaceId, 'hgesm-aprov');
  assert.equal(result.data.ug, '160416');
  assert.equal(result.data.description, 'Arroz parboilizado');
  assert.deepEqual(result.data.aliases, ['Arroz beneficiado', 'Arroz']);
  assert.equal(result.data.unit.code, 'kg');
  assert.equal(result.data.status, 'active');
  assert.equal(result.data.conversions[1].presentation.label, 'Caixa 30 kg');
});

test('rejeita material fora do contrato explícito', () => {
  const result = material.validateWarehouseMaterial({
    schemaVersion: 'warehouse_material_v1',
    id: 'material-solto',
    workspaceId: 'workspace inválido',
    ug: '16',
    description: '',
    aliases: [],
    unit: { code: 'other', label: null },
    status: 'deleted',
    conversions: [
      {
        presentation: { code: 'box', label: null },
        factorToBaseUnit: 0,
      },
    ],
  });

  assert.equal(result.ok, false);
  const codes = new Set(result.issues.map((item) => item.code));
  for (const expected of [
    'invalid_material_id',
    'invalid_workspace',
    'invalid_ug',
    'invalid_description',
    'invalid_unit',
    'invalid_status',
    'invalid_conversion_factor',
  ]) {
    assert.equal(codes.has(expected), true, `ausente: ${expected}`);
  }
});

test('valida compatibilidade com o workspace esperado', () => {
  const result = material.validateWarehouseMaterial(
    {
      schemaVersion: 'warehouse_material_v1',
      id: deterministicId,
      workspaceId: 'hgesm-aprov',
      ug: '160416',
      description: 'Leite integral',
      aliases: [],
      unit: { code: 'l', label: null },
      status: 'active',
      conversions: [],
    },
    { expectedWorkspaceId: 'workspace-a' }
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.issues.some((item) => item.code === 'workspace_mismatch'),
    true
  );
});

test('suporta unidade, kg, g, L, mL, pacote, caixa, fardo e apresentação livre', () => {
  assert.deepEqual(material.WAREHOUSE_MATERIAL_UNIT_CODES, [
    'unit',
    'kg',
    'g',
    'l',
    'ml',
    'package',
    'box',
    'bundle',
    'other',
  ]);

  assert.deepEqual(
    material.normalizeWarehouseMaterialUnit({ code: 'other', label: 'Bombona 20 L' }),
    { code: 'other', label: 'Bombona 20 L' }
  );
});

test('converte apresentações para a unidade canônica sem criar saldo ou movimento', () => {
  const result = material.createWarehouseMaterial({
    id: deterministicId,
    workspaceId: 'hgesm-aprov',
    ug: '160416',
    description: 'Feijão',
    unit: { code: 'unit', label: null },
    conversions: [
      {
        presentation: { code: 'package', label: 'Pacote 1 kg' },
        factorToBaseUnit: 1,
      },
      {
        presentation: { code: 'box', label: 'Caixa 12 pacotes' },
        factorToBaseUnit: 12,
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(
    material.convertWarehouseMaterialQuantityToBase(
      result.data,
      2,
      { code: 'box', label: 'Caixa 12 pacotes' }
    ),
    24
  );
  assert.equal(
    material.convertWarehouseMaterialQuantityToBase(
      result.data,
      3,
      { code: 'unit', label: null }
    ),
    3
  );
});

test('gera ID interno estável a partir de UUID válido', () => {
  assert.equal(
    material.createWarehouseMaterialId(
      () => '123e4567-e89b-12d3-a456-426614174000'
    ),
    deterministicId
  );
});
