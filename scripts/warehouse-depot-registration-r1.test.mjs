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
const temporary = mkdtempSync(resolve(tmpdir(), 'emprovex-depot-reg-'));
execFileSync(process.execPath, [
  resolve(root, 'node_modules/typescript/bin/tsc'),
  resolve(root, 'lib/warehouse/depotRegistration.ts'),
  '--outDir', temporary, '--module', 'commonjs',
  '--target', 'ES2020', '--moduleResolution', 'node', '--skipLibCheck',
], { cwd: root, stdio: 'pipe' });
const require = createRequire(import.meta.url);
const p = require(resolve(temporary, 'depotRegistration.js'));
test.after(() => rmSync(temporary, { recursive: true, force: true }));
function draft(units) {
  return { code: 'DEP-001', name: 'Depósito Principal', description: '',
    lengthCm: 1000, widthCm: 620, units };
}
test('cinco famílias canônicas com códigos compatíveis com as etiquetas', () => {
  assert.deepEqual(p.DEPOT_KINDS.map((model) => model.prefix), ['EST','GEL','FRZ','PAL','MES']);
  assert.deepEqual(p.DEPOT_KINDS.map((model) => model.kind), ['SHELF','REFRIGERATOR','FREEZER','PALLET','BENCH']);
});
test('cada estante mantém medidas próprias, altura e prateleiras próprias', () => {
  const a = { ...p.defaultDepotUnit('SHELF'), widthCm: 180, depthCm: 50, heightCm: 210, shelfCount: 2 };
  const b = { ...p.defaultDepotUnit('SHELF'), widthCm: 240, depthCm: 60, heightCm: 250, shelfCount: 5 };
  const result = p.planDepotDraft(draft([a,b]));
  assert.equal(result[0].code, 'EST-01');
  assert.equal(result[1].code, 'EST-02');
  assert.deepEqual(result.map((x) => [x.widthCm, x.depthCm, x.heightCm, x.shelfCount]), [[180,50,210,2],[240,60,250,5]]);
  assert.match(result[1].description, /altura: 250 cm/);
  assert.notEqual(result[0].x, result[1].x);
});
test('cinco tipos preservam suas dimensões unitárias em centímetros e sequência independente', () => {
  const units = p.DEPOT_KINDS.map((item, i) => ({ ...p.defaultDepotUnit(item.kind), heightCm: 77+i }));
  const planned = p.planDepotDraft(draft(units));
  assert.deepEqual(planned.map((x) => x.code), ['EST-01','GEL-01','FRZ-01','PAL-01','MES-01']);
  assert.deepEqual(planned.map((x) => x.heightCm), [77,78,79,80,81]);
});
test('quantidade por tipo conserva customizações existentes ao aumentar ou reduzir', () => {
  const a = { ...p.defaultDepotUnit('SHELF'), widthCm: 330 };
  const two = p.setDepotUnitCount([a], 'SHELF', 2);
  assert.equal(two[0].widthCm, 330);
  assert.equal(two[1].widthCm, 180);
  assert.equal(p.setDepotUnitCount(two,'SHELF',1).length, 1);
});
test('bloqueia dimensões inválidas e prateleiras fora de estantes', () => {
  assert.throws(() => p.planDepotDraft(draft([{ ...p.defaultDepotUnit('SHELF'), heightCm: 0 }])), /dimensões individuais/);
  assert.throws(() => p.planDepotDraft(draft([{ ...p.defaultDepotUnit('PALLET'), shelfCount: 2 }])), /Apenas estantes/);
  assert.throws(() => p.planDepotDraft(draft([{ ...p.defaultDepotUnit('SHELF'), shelfCount: 31 }])), /0 a 30/);
});
test('navegação remove atalhos de criação de Estrutura; croqui não altera cadastro', () => {
  const ui = readFileSync(resolve(root, 'features/warehouse/components/WarehouseLocationsR1Operational.tsx'), 'utf8');
  const form = readFileSync(resolve(root, 'features/warehouse/components/WarehouseDepotRegistrationR1.tsx'), 'utf8');
  const croqui = readFileSync(resolve(root, 'features/warehouse/components/WarehouseCroquisR1Operational.tsx'), 'utf8');
  assert.match(ui, /Cadastramento de Depósito/);
  assert.doesNotMatch(ui, /onClick=\{\(\) => openPanel\('depot'\)\}/);
  assert.doesNotMatch(ui, /onClick=\{\(\) => openPanel\('location'\)\}/);
  assert.doesNotMatch(ui, /onClick=\{\(\) => openPanel\('subposition'\)\}/);
  assert.match(form, /\['widthCm', 'Largura \(cm\)'\]/);
  assert.match(form, /\['depthCm', 'Profundidade \(cm\)'\]/);
  assert.match(form, /\['heightCm', 'Altura \(cm\)'\]/);
  assert.doesNotMatch(croqui, /await createWarehouseLocation\(workspaceId/);
  assert.doesNotMatch(croqui, /updateWarehouseLocation\(workspaceId, .*status: 'inactive'/);
});
test('rotina de inativação é protegida e códigos cadastrados não podem ser modificados', () => {
  const source = readFileSync(resolve(root, 'lib/warehouse/locationRepository.ts'), 'utf8');
  assert.match(source, /WAREHOUSE_ARCHIVE_OCCUPIED/);
  assert.match(source, /WAREHOUSE_ARCHIVE_ACTIVE_LOT/);
  assert.match(source, /writeBatch\(db\)/);
  assert.match(source, /WAREHOUSE_DEPOT_CODE_IMMUTABLE/);
  assert.match(source, /WAREHOUSE_LOCATION_CODE_IMMUTABLE/);
});

test('rota de demonstração localhost é restrita a desenvolvimento e não executa gravações', () => {
  const route = readFileSync(resolve(root, 'app/visual-lab/cadastro-deposito/page.tsx'), 'utf8');
  const preview = readFileSync(resolve(root, 'features/warehouse/components/WarehouseDepotRegistrationPreviewLocal.tsx'), 'utf8');
  const form = readFileSync(resolve(root, 'features/warehouse/components/WarehouseDepotRegistrationR1.tsx'), 'utf8');
  assert.match(route, /process\.env\.NODE_ENV !== 'development'/);
  assert.match(route, /notFound\(\)/);
  assert.match(preview, /previewOnly/);
  assert.match(form, /if \(previewOnly\) \{/);
  assert.match(form, /Nenhuma informação foi enviada ao Firestore/);
});
