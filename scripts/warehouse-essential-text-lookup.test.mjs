import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(file, 'utf8');

test('Início e Meus Depósitos usam chunk separado sem carregar 3D no Essencial', () => {
  const content = read('features/warehouse/components/WarehouseSectionContent.tsx');
  assert.match(content, /useVisualMode/);
  assert.match(content, /mode === 'essencial' && \(section === 'home' \|\| section === 'overview'\)/);
  assert.match(content, /return <WarehouseEssentialLocationLookup workspaceId=\{workspaceId\} section=\{section\} \/>/);
  assert.match(content, /import\('\.\/WarehouseEssentialLocationLookup'\)/);
  assert.match(content, /import\('\.\/WarehouseHomeOperational'\)/);
  assert.match(content, /import\('\.\/WarehouseLandingOperational'\)/);
  assert.doesNotMatch(content, /import \{ WarehouseIsometricPreview \}|import \{ WarehouseLandingOperational \}|import \{ WarehouseHomeOperational \}/);
});

test('Consulta Essencial não importa renderizadores ou faz leituras ao montar a aba', () => {
  const lookup = read('features/warehouse/components/WarehouseEssentialLocationLookup.tsx');
  for (const forbidden of [
    'WarehouseIsometricPreview', 'WarehouseLandingOperational', 'WarehouseHomeOperational',
    'WarehouseDepotLayoutEditor', 'getActiveWarehouseDepotLayout',
    'listWarehouseLots(', 'listWarehouseVisualExpiryLots(', 'useEffect(() => { void readSnapshot',
  ]) assert.equal(lookup.includes(forbidden), false, 'Dependência pesada indevida: ' + forbidden);
  assert.match(lookup, /void readSnapshot\(value\)/);
  assert.match(lookup, /onSubmit=\{onSearch\}/);
  assert.match(lookup, /listWarehouseLocationBalances\(workspaceId, BALANCE_LIMIT_PER_MATERIAL, item\.id\)/);
  assert.match(lookup, /candidates\.slice\(0, MAX_MATCHED_MATERIALS\)/);
  assert.match(lookup, /setSubmittedQuery\(searchTerm\)/);
  assert.match(lookup, /normalize\(\[item\.id, item\.description, \.\.\.item\.aliases\]/);
  assert.doesNotMatch(lookup, /listWarehousePositiveLocationBalances\(/);
  assert.match(lookup, /listWarehouseMaterials\(workspaceId, MATERIAL_LIMIT\)/);
  assert.match(lookup, /listWarehouseDepotsCached\(workspaceId, DEPOT_LIMIT\)/);
  assert.match(lookup, /listWarehouseLocationsCached\(workspaceId, LOCATION_LIMIT\)/);
  assert.doesNotMatch(lookup, /setDoc\(|updateDoc\(|deleteDoc\(|runTransaction\(|onSnapshot\(/);
});

test('Resultado textual informa depósito, local, subposição e saldo com alerta de truncamento', () => {
  const lookup = read('features/warehouse/components/WarehouseEssentialLocationLookup.tsx');
  const search = read('lib/warehouse/globalMaterialSearch.ts');
  assert.match(lookup, /findWarehouseMaterialsAcrossDepots\(/);
  assert.match(lookup, /position\.depotCode/);
  assert.match(lookup, /position\.locationCode/);
  assert.match(lookup, /position\.subpositionCode/);
  assert.match(lookup, /position\.quantity\.toLocaleString/);
  assert.match(lookup, /data\.partial \|\| data\.matchedMaterialLimit/);
  assert.match(lookup, /setVisiblePositionCount\(\(count\) => count \+ INITIAL_POSITION_COUNT\)/);
  assert.match(lookup, /requestId !== requestRef\.current/);
  assert.match(lookup, /data\?\.workspaceId === workspaceId/);
  assert.match(lookup, /data\.workspaceId !== workspaceId/);
  assert.match(lookup, /section === 'overview'/);
  assert.match(search, /location\.kind !== 'LOCAL'/);
  assert.match(search, /position\.kind === 'SUBPOSITION'/);
});

test('Navegação local libera Início no Essencial e preserva 3D no Premium', () => {
  const shell = read('features/warehouse/components/WarehouseModuleShell.tsx');
  const sidebar = read('features/warehouse/components/WarehouseSidebar.tsx');
  assert.doesNotMatch(shell, /redirectHome|effectiveSectionId/);
  assert.match(shell, /const target = requestedTarget/);
  assert.match(shell, /setActiveSectionId\(target\.id\)/);
  assert.match(shell, /window\.history\.pushState\(/);
  assert.match(shell, /mode === 'premium' && \(section === 'home' \|\| section === 'overview'\)/);
  assert.match(sidebar, /\{WAREHOUSE_SECTIONS\.map\(/);
  assert.doesNotMatch(sidebar, /item\.id !== 'home'/);
  const landing = read('features/warehouse/components/WarehouseLandingOperational.tsx');
  const home = read('features/warehouse/components/WarehouseHomeOperational.tsx');
  assert.match(landing, /WarehouseIsometricPreview/);
  assert.match(home, /WarehouseIsometricPreview/);
});
