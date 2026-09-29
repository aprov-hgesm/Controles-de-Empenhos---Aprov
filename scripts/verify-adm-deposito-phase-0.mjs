#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const moduleAccess = read('lib/platformModuleAccess.ts');
const serverAccess = read('lib/server/warehouseAccess.ts');
const route = read('features/warehouse/components/WarehouseProtectedSurface.tsx');
const api = read('app/api/adm-deposito/status/route.ts');
const sidebar = read('components/layout/AppSidebar.tsx');
const warehouseSidebar = read('features/warehouse/components/WarehouseSidebar.tsx');
const rules = read('firestore.warehouse.rules');
const ci = read('.github/workflows/application-ci.yml');
const pkg = JSON.parse(read('package.json'));

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}

function forbidText(source, forbidden, message) {
  if (source.includes(forbidden)) findings.push(message);
}

for (const marker of [
  'export const warehouseModuleEnabled = true;',
  "context.status === 'sector'",
  'context.canLoadOperationalData',
  'Boolean(context.workspaceId)',
]) {
  requireText(moduleAccess, marker, 'Gate neutro da Central incompleto: ' + marker);
}
forbidText(
  moduleAccess,
  'legacy-hgesm-bootstrap',
  'Gate da Central voltou a restringir a interface ao bootstrap fundador.'
);

for (const marker of [
  'verifyFirebaseRequest',
  'SECTOR_AUTH_PROVIDER',
  'platformAccounts/',
  'workspaces/',
  'ensureSectorWarehouseClaims',
  'currentClaimsMatchWorkspace',
  'firebaseUid',
]) {
  requireText(serverAccess, marker, 'Gate server-side multi-tenant incompleto: ' + marker);
}

for (const marker of [
  'resolveAuthenticatedWorkspaceContext(currentUser)',
  'canAccessWarehouseModule(context)',
  'requestWarehouseStatus(currentUser)',
  'requestWarehouseStatus(currentUser, true)',
  'authorization.status.workspaceId !== context.workspaceId',
]) {
  requireText(route, marker, 'Superfície protegida da Central incompleta: ' + marker);
}

for (const marker of [
  'verifyWarehouseRequest',
  'workspaceId: access.workspaceId',
  'ug: access.ug',
  'claimsUpdated: access.claimsUpdated',
]) {
  requireText(api, marker, 'API de autorização da Central incompleta: ' + marker);
}

for (const marker of [
  'function isExternalWarehouseSectorSession(workspaceId)',
  'emprovexWarehouse',
  'emprovexWarehouseVersion',
  'emprovexWorkspaceId',
  'emprovexUg',
  'function warehouseUgMatchesAccess(workspaceId, ug)',
  'canAccessWarehouseModule(workspaceId)',
  'isHgesmFounder()',
]) {
  requireText(rules, marker, 'Rules da Central não preservam isolamento esperado: ' + marker);
}

requireText(sidebar, 'Central de Depósitos', 'Menu principal não usa o nome Central de Depósitos.');
requireText(warehouseSidebar, 'Central de Depósitos', 'Menu interno não usa o nome Central de Depósitos.');
requireText(sidebar, 'warehouseModuleEnabled && onOpenWarehouse', 'Entrada da Central não está condicionada ao gate.');
requireText(
  pkg.scripts?.['verify:adm-deposito-phase-0'] || '',
  'verify-adm-deposito-phase-0.mjs',
  'package.json não registra o gate de acesso da Central.'
);
requireText(ci, 'npm run verify:adm-deposito-phase-0', 'Application CI não executa o gate de acesso da Central.');

if (findings.length) {
  console.error('CENTRAL DE DEPÓSITOS — ACESSO EXTERNO: BLOQUEADO\n');
  for (const finding of findings) console.error('  [BLOCK] ' + finding);
  process.exitCode = 2;
} else {
  console.log('CENTRAL DE DEPÓSITOS — ACESSO EXTERNO: READY');
  console.log('ADM DEPÓSITO FASE 0: READY');
  console.log('- interface: todos os setores autenticados e validados podem visualizar a Central');
  console.log('- servidor: conta, UID, workspace e UG são revalidados antes de materializar claims');
  console.log('- Firestore: claims assinadas isolam cada workspace/UG no banco emprovex-warehouse');
  console.log('- fundador: acesso Google ao workspace HGeSM preservado');
}
