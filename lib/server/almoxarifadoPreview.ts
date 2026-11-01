/**
 * Server-only workspace-scoped warehouse reads for W5. This adapter never writes.
 * Material mapping is accepted only from server-read, previously approved records.
 */
import 'server-only';
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import { warehouseAdminListCollection, warehouseAdminReadScopedQuery,
  WarehouseStoreError, type WarehouseAdminDocument } from './warehouseFirestoreTransaction';
import { validateWarehouseMaterial } from '../warehouse/material';
import { validateWarehouseDepot, validateWarehouseLocation,
  validateWarehouseLocationBalance } from '../warehouse/location';
import type { MaterialCorrespondenceV1, ImportedRequestV1 } from '../almoxarifado/contracts';
import { requireAlmoxAccess, checkAlmoxSnapshot, type AlmoxSnapshotV1 } from '../almoxarifado/integration';

function verifyDocScope(row: WarehouseAdminDocument, access: VerifiedWarehouseRequest): void {
  if (row.data.workspaceId !== access.workspaceId || row.data.ug !== access.ug) {
    throw new WarehouseStoreError('ALMOX_SNAPSHOT_SCOPE_MISMATCH', 403);
  }
}
function fail(): never { throw new WarehouseStoreError('ALMOX_SNAPSHOT_INVALID', 409); }
export async function readTrustedAlmoxSnapshot(access: VerifiedWarehouseRequest): Promise<AlmoxSnapshotV1> {
  requireAlmoxAccess(access);
  const token = process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR === '1'
    ? 'emulator' : await getGoogleAccessToken();
  const [mats, deps, locs, bals, maps, imported] = await Promise.all([
    warehouseAdminListCollection(token, access.workspaceId, 'materials', 500),
    warehouseAdminListCollection(token, access.workspaceId, 'depots', 500),
    warehouseAdminListCollection(token, access.workspaceId, 'locations', 500),
    warehouseAdminListCollection(token, access.workspaceId, 'locationBalances', 500),
    warehouseAdminReadScopedQuery(token, access.workspaceId, 'almoxMaterialCorrespondences', [], 500),
    warehouseAdminReadScopedQuery(token, access.workspaceId, 'almoxRequestImports', [], 500),
  ]);
  const materials = mats.map(row => {
    verifyDocScope(row, access);
    const v = validateWarehouseMaterial(row.data, { expectedWorkspaceId: access.workspaceId, expectedUg: access.ug });
    return v.ok ? v.data : fail();
  });
  const depots = deps.map(row => {
    verifyDocScope(row, access);
    const v = validateWarehouseDepot(row.data, { expectedWorkspaceId: access.workspaceId, expectedUg: access.ug });
    return v.ok ? v.data : fail();
  });
  const locations = locs.map(row => {
    verifyDocScope(row, access);
    const v = validateWarehouseLocation(row.data, { expectedWorkspaceId: access.workspaceId, expectedUg: access.ug });
    return v.ok ? v.data : fail();
  });
  const balances = bals.map(row => {
    verifyDocScope(row, access);
    const v = validateWarehouseLocationBalance(row.data, { expectedWorkspaceId: access.workspaceId });
    return v.ok && v.data.ug === access.ug ? v.data : fail();
  });
  if (maps.length >= 500 || imported.length >= 500) fail();
  const correspondences: MaterialCorrespondenceV1[] = maps.map(row => {
    verifyDocScope(row, access);
    const v = row.data;
    if (typeof v.sourceItemCode !== 'string' || !v.sourceItemCode
      || typeof v.sourceUnit !== 'string' || !v.sourceUnit
      || typeof v.materialId !== 'string' || !v.materialId
      || typeof v.factorToBaseUnit !== 'number' || !Number.isFinite(v.factorToBaseUnit)
      || v.factorToBaseUnit <= 0 || !Number.isSafeInteger(v.revision) || (v.revision as number) < 1
      || typeof v.approvedByUid !== 'string' || !v.approvedByUid
      || typeof v.approvedAt !== 'string' || !v.approvedAt) fail();
    return {workspaceId: access.workspaceId,sourceItemCode:v.sourceItemCode,
      sourceUnit:v.sourceUnit,materialId:v.materialId,
      factorToBaseUnit:v.factorToBaseUnit,revision:v.revision as number,
      approvedByUid:v.approvedByUid,approvedAt:v.approvedAt};
  });
  const previousImports: AlmoxSnapshotV1['previousImports'] = imported.map(row => {
    verifyDocScope(row, access);
    const v = row.data;
    const src = v.source as ImportedRequestV1['source'] | undefined;
    if (!src || typeof src.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(src.sha256)
      || typeof v.externalRequestNumber !== 'string') fail();
    return {workspaceId:access.workspaceId,externalRequestNumber:v.externalRequestNumber,
      source:{ system:'SISCOFIS',format: src.format === 'PDF' ? 'PDF' : 'TXT',
        sha256:src.sha256,layoutId:src.layoutId ?? null,originalFilename:src.originalFilename ?? null}};
  });
  const snapshot = {materials,depots,locations,balances,correspondences,previousImports};
  checkAlmoxSnapshot(access, snapshot);
  return snapshot;
}
