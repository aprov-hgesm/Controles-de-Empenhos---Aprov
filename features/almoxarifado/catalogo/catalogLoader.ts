'use client';

/**
 * Leitura autorizada pelo gate já existente (WarehouseAccessBoundary).
 * Nenhuma API nova, Rules novas, gravação de estoque ou sincronização SISCOFIS.
 */
import type { User } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { getCurrentOperationalScope } from '../../../lib/operationalPaths';
import { getResolvedWorkspaceContextForSession } from '../../../lib/workspaceContext';
import { getEmpenhos, getSupplierContacts } from '../../../lib/firebaseSync';
import { getGlobalSupplierDirectory } from '../../../lib/supplierDirectory';
import { listWarehouseMaterials } from '../../../lib/warehouse/materialRepository';
import {
  listWarehouseDepotsStrict, listWarehouseLocationsStrict,
  listWarehousePositiveLocationBalances,
} from '../../../lib/warehouse/locationRepository';
import { buildAlmoxCatalog, type AlmoxCatalogProjection } from './catalogModel';

const MATERIAL_LIMIT = 1000;
const BALANCE_LIMIT = 500;
const LOCATION_LIMIT = 500;
const DEPOT_LIMIT = 250;

export function assertAlmoxCatalogAccess(user: User, expectedWorkspaceId: string, expectedUg: string): void {
  if (!auth.currentUser || auth.currentUser.uid !== user.uid) {
    throw new Error('ALMOX_W7_SESSION_CHANGED');
  }
  const context = getResolvedWorkspaceContextForSession(user.uid, user.email);
  if (
    !context || context.sectorType !== 'almoxarifado'
    || context.workspaceId !== expectedWorkspaceId || context.ug !== expectedUg
    || !context.canLoadOperationalData || context.legacyDataMode
  ) {
    throw new Error('ALMOX_W7_ACCESS_DENIED');
  }
  const scope = getCurrentOperationalScope(user.uid);
  if (scope.workspaceId !== expectedWorkspaceId || scope.ug !== expectedUg || scope.legacyDataMode) {
    throw new Error('ALMOX_W7_SCOPE_CHANGED');
  }
}

/**
 * Chamado somente após autenticação, cobrança e autorização do Warehouse.
 * Os saldos por posição são um retrato parcial caso algum limite seja atingido.
 */
export async function loadAlmoxCatalog(
  user: User,
  expectedWorkspaceId: string,
  expectedUg: string,
): Promise<{ projection: AlmoxCatalogProjection; empenhos: Awaited<ReturnType<typeof getEmpenhos>> }> {
  assertAlmoxCatalogAccess(user, expectedWorkspaceId, expectedUg);
  const [empenhos, contacts, directory, materials, depots, locations, balances] = await Promise.all([
    getEmpenhos(user.uid),
    getSupplierContacts(user.uid),
    getGlobalSupplierDirectory(user.uid),
    listWarehouseMaterials(expectedWorkspaceId, MATERIAL_LIMIT),
    listWarehouseDepotsStrict(expectedWorkspaceId, DEPOT_LIMIT),
    listWarehouseLocationsStrict(expectedWorkspaceId, LOCATION_LIMIT),
    listWarehousePositiveLocationBalances(expectedWorkspaceId, BALANCE_LIMIT),
  ]);
  // Evita mostrar resultado carregado após troca de sessão ou workspace.
  assertAlmoxCatalogAccess(user, expectedWorkspaceId, expectedUg);
  const projection = buildAlmoxCatalog({
    workspaceId: expectedWorkspaceId,
    ug: expectedUg,
    empenhos, contacts, directory, materials,
    depots: depots.map(({ depot }) => depot),
    locations: locations.map(({ location }) => location),
    balances: balances.map(({ balance }) => balance),
    coverageComplete: materials.length < MATERIAL_LIMIT && depots.length < DEPOT_LIMIT
      && locations.length < LOCATION_LIMIT && balances.length < BALANCE_LIMIT,
  });
  return { projection, empenhos };
}
