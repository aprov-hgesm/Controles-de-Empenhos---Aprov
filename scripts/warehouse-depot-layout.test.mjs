#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-phase9-domain-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/layout.ts'),
    resolve(root, 'lib/warehouse/structureLibrary.ts'),
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
const source = require(resolve(outDir, 'warehouse/layout.js'));
const structureLibrary = require(resolve(outDir, 'warehouse/structureLibrary.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const WORKSPACE = 'hgesm-aprov';
const UG = '160416';
const DEPOT = 'dep_' + '1'.repeat(32);
const LOCATION = 'loc_' + '2'.repeat(32);

function object(overrides = {}) {
  return {
    id: 'obj_' + '3'.repeat(32),
    kind: 'SHELF',
    label: 'Estante A',
    x: 20,
    y: 30,
    width: 140,
    height: 70,
    rotation: 0,
    layer: 1,
    elevation: 1,
    visualVariant: 'solid',
    warehouseLocationId: LOCATION,
    ...overrides,
  };
}

function layout(overrides = {}) {
  return {
    schemaVersion: 'warehouse_depot_layout_v1',
    id: 'lay_' + '4'.repeat(32),
    workspaceId: WORKSPACE,
    ug: UG,
    name: 'Croqui principal',
    depotId: DEPOT,
    logicalWidth: 1000,
    logicalHeight: 620,
    objects: [object()],
    version: 1,
    status: 'active',
    previousVersionId: null,
    createdBy: 'founder',
    updatedBy: 'founder',
    ...overrides,
  };
}

test('aceita layout válido e objeto vinculado a warehouseLocationId', () => {
  const result = source.validateWarehouseDepotLayout(layout(), {
    expectedWorkspaceId: WORKSPACE,
    expectedUg: UG,
  });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.data.objects[0].warehouseLocationId, LOCATION);
});

test('aceita objeto estrutural sem localização', () => {
  const result = source.validateWarehouseDepotLayout(
    layout({ objects: [object({ kind: 'WALL', warehouseLocationId: null })] })
  );
  assert.equal(result.ok, true);
});

test('rejeita workspace e UG divergentes', () => {
  assert.equal(source.validateWarehouseDepotLayout(layout(), { expectedWorkspaceId: 'workspace-x' }).ok, false);
  assert.equal(source.validateWarehouseDepotLayout(layout(), { expectedUg: '160417' }).ok, false);
});

test('rejeita adulteração de warehouseLocationId', () => {
  const result = source.validateWarehouseDepotLayout(
    layout({ objects: [object({ warehouseLocationId: 'loc_forjado' })] })
  );
  assert.equal(result.ok, false);
  assert.match(result.issues.map((item) => item.code).join(','), /invalid_warehouse_location_id/);
});

test('versionamento exige previousVersionId depois da primeira versão', () => {
  const invalid = source.validateWarehouseDepotLayout(layout({ version: 2 }));
  assert.equal(invalid.ok, false);
  const valid = source.validateWarehouseDepotLayout(
    layout({
      id: 'lay_' + '5'.repeat(32),
      version: 2,
      previousVersionId: 'lay_' + '4'.repeat(32),
    })
  );
  assert.equal(valid.ok, true);
});

test('posição real converte para o ID visual correto sem mover saldo', () => {
  assert.equal(source.warehouseLocationIdForPosition({ kind: 'UNASSIGNED' }), null);
  assert.equal(source.warehouseLocationIdForPosition({
    kind: 'LOCATION',
    depotId: DEPOT,
    locationId: LOCATION,
    subpositionId: null,
  }), LOCATION);
  const sub = 'sub_' + '6'.repeat(32);
  assert.equal(source.warehouseLocationIdForPosition({
    kind: 'SUBPOSITION',
    depotId: DEPOT,
    locationId: LOCATION,
    subpositionId: sub,
  }), sub);
});

test('SVG é derivado do layout e não contém quantidade/saldo', () => {
  const result = source.validateWarehouseDepotLayout(layout());
  assert.equal(result.ok, true);
  const svg = source.renderWarehouseDepotLayoutSvg(result.data);
  assert.match(svg, /<svg/);
  assert.match(svg, /Estante A/);
  assert.doesNotMatch(svg, /quantity|balance|saldo/i);
});


test('biblioteca física cobre os tipos obrigatórios sem novo schema de layout', () => {
  const required = [
    'Estante',
    'Rack',
    'Armário',
    'Freezer',
    'Geladeira',
    'Câmara',
    'Palete',
    'Área de Paletes',
    'Bancada',
    'Corredor',
    'Área Livre',
    'Outra estrutura',
  ];
  const names = new Set(
    structureLibrary.WAREHOUSE_STRUCTURE_LIBRARY.map((definition) => definition.name)
  );
  for (const name of required) assert.equal(names.has(name), true, name);

  for (const definition of structureLibrary.WAREHOUSE_STRUCTURE_LIBRARY) {
    assert.equal(source.WAREHOUSE_DEPOT_LAYOUT_OBJECT_KINDS.includes(definition.kind), true);
    assert.equal(Number.isFinite(definition.defaultWidth) && definition.defaultWidth >= 12, true);
    assert.equal(Number.isFinite(definition.defaultHeight) && definition.defaultHeight >= 12, true);
    assert.equal(Number.isFinite(definition.defaultRotation), true);
  }
});


test('editor visual mantém edição local, 2D/2.5D e sem persistência paralela', () => {
  const editor = readFileSync(
    resolve(root, 'features/warehouse/components/WarehouseDepotLayoutEditor.tsx'),
    'utf8'
  );
  const operational = readFileSync(
    resolve(root, 'features/warehouse/components/WarehouseDepotViewOperational.tsx'),
    'utf8'
  );

  assert.match(editor, /Vista superior/);
  assert.match(editor, /Prévia 2\.5D/);
  assert.match(editor, /Snap/);
  assert.match(editor, /Undo2/);
  assert.match(editor, /Redo2/);
  assert.match(editor, /Duplicar/);
  assert.match(editor, /Trazer para frente/);
  assert.match(editor, /Enviar para trás/);
  assert.match(editor, /nenhum movimento grava no Firestore/);
  assert.doesNotMatch(editor, /saveWarehouseDepotLayoutVersion|firebase\/firestore|warehouse_balance_v1/);

  assert.match(operational, /WAREHOUSE_STRUCTURE_LIBRARY\.map/);
  assert.match(operational, /WarehouseDepotLayoutEditor/);
  assert.match(operational, /saveWarehouseDepotLayoutVersion/);
  assert.match(operational, /warehouseLocationId/);
});

test('croqui v2 preserva integridade logística e vínculos inequívocos nas novas edições', () => {
  const editor = readFileSync(
    resolve(root, 'features/warehouse/components/WarehouseDepotLayoutEditor.tsx'),
    'utf8'
  );
  const operational = readFileSync(
    resolve(root, 'features/warehouse/components/WarehouseDepotViewOperational.tsx'),
    'utf8'
  );
  const repository = readFileSync(
    resolve(root, 'lib/warehouse/layoutRepository.ts'),
    'utf8'
  );

  const clearedLinks = editor.match(/warehouseLocationId:\s*null/g) || [];
  assert.ok(clearedLinks.length >= 2, 'duplicar e colar devem nascer sem vínculo logístico');
  assert.match(operational, /já está representada por/);
  assert.match(operational, /duplicateWarehouseLocationIds/);
  assert.match(repository, /WAREHOUSE_LAYOUT_DUPLICATE_LOCATION_REFERENCE/);
  assert.match(repository, /assertUniqueLayoutLocationReferences/);
  assert.match(repository, /getActiveWarehouseDepotLayoutStrict/);
  assert.match(repository, /const active = await getActiveWarehouseDepotLayoutStrict/);
  assert.doesNotMatch(repository, /warehouse_balance_v1|warehouse_location_balance_v1|warehouse_movement_v1|warehouse_lot_v1/);
});

test('croqui v2 usa um único histórico local para canvas e painel de propriedades', () => {
  const editor = readFileSync(
    resolve(root, 'features/warehouse/components/WarehouseDepotLayoutEditor.tsx'),
    'utf8'
  );
  const operational = readFileSync(
    resolve(root, 'features/warehouse/components/WarehouseDepotViewOperational.tsx'),
    'utf8'
  );

  assert.match(editor, /onHistoryCheckpoint/);
  assert.match(editor, /canUndo/);
  assert.match(editor, /onUndo/);
  assert.doesNotMatch(editor, /setHistory\(/);
  assert.match(operational, /draftHistory/);
  assert.match(operational, /commitDraftObjects/);
  assert.match(operational, /resetDraftHistory/);
  assert.match(operational, /onHistoryCheckpoint=\{checkpointDraft\}/);
});

test('croqui v2 possui estrutura responsiva sem sobreposição artificial', () => {
  const editor = readFileSync(
    resolve(root, 'features/warehouse/components/WarehouseDepotLayoutEditor.tsx'),
    'utf8'
  );
  const operational = readFileSync(
    resolve(root, 'features/warehouse/components/WarehouseDepotViewOperational.tsx'),
    'utf8'
  );
  const structure = readFileSync(
    resolve(root, 'features/warehouse/components/WarehouseDepotCroquis.tsx'),
    'utf8'
  );

  assert.match(editor, /warehouse-croqui-editor-toolbar/);
  assert.match(editor, /warehouse-croqui-editor-viewport/);
  assert.match(editor, /flex-wrap/);
  assert.match(editor, /max-w-full/);
  assert.match(operational, /2xl:grid-cols-\[minmax\(0,1fr\)_330px\]/);
  assert.match(operational, /warehouse-croqui-properties-panel/);
  assert.match(operational, /2xl:overflow-y-auto/);
  assert.match(structure, /min-w-0/);
  assert.doesNotMatch(structure, /position:\s*(absolute|fixed)|z-index:\s*\d{3,}/);
});

test('cancelamento e restauração histórica preservam persistência explícita', () => {
  const operational = readFileSync(
    resolve(root, 'features/warehouse/components/WarehouseDepotViewOperational.tsx'),
    'utf8'
  );

  assert.match(operational, /setMode\('view'\)/);
  assert.match(operational, /Usar como base/);
  assert.match(operational, /Salve para criar uma nova versão ativa/);
  assert.match(operational, /expectedVersion:/);
  assert.match(operational, /baseLayoutId:/);
  assert.match(operational, /WAREHOUSE_LAYOUT_DEPOT_CONTEXT_CHANGED/);
});

test('Início consome somente layout ativo e mantém croqui como consulta do estoque', () => {
  const home = readFileSync(
    resolve(root, 'features/warehouse/components/WarehouseHomeOperational.tsx'),
    'utf8'
  );

  assert.match(home, /getActiveWarehouseDepotLayout/);
  assert.doesNotMatch(home, /listWarehouseDepotLayouts/);
  assert.match(home, /listWarehouseLocationBalances/);
  assert.match(home, /listWarehouseBalances/);
  assert.match(home, /selectWarehouseFefoLot/);
  assert.match(home, /Ainda não representada no croqui/);
  assert.match(home, /Prioridade FEFO/);
  assert.match(home, /selectedStructureRows/);
  assert.doesNotMatch(home, /saveWarehouseDepotLayoutVersion/);
  assert.doesNotMatch(home, /warehouse_visual_balance|warehouse_map_balance|warehouse_stock_map/);
});
