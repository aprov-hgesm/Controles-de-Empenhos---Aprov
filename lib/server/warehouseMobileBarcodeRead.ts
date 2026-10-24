import { createWarehouseBarcodeId, normalizeWarehouseBarcode, validateWarehouseBarcodeAssociation, type WarehouseBarcodeAssociation } from '../warehouse/barcode';
import { warehouseCanonicalBarcodeReadInput } from '../warehouse/readCompatibility';
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import { warehouseAdminBatchRead, WarehouseStoreError } from './warehouseFirestoreTransaction';

/** Escopo e UG vêm da sessão verificada, jamais do corpo da requisição. */
export async function readWarehouseMobileBarcodeServer(
  access: VerifiedWarehouseRequest, barcodeInput: unknown
): Promise<WarehouseBarcodeAssociation | null> {
  const code = normalizeWarehouseBarcode(barcodeInput);
  if (!code) throw new WarehouseStoreError('WAREHOUSE_MOBILE_BARCODE_INVALID', 400);
  const id = await createWarehouseBarcodeId(access.workspaceId, code);
  const path = 'warehouse/' + access.workspaceId + '/barcodes/' + id;
  const token = process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR === '1'
    ? 'emulator' : await getGoogleAccessToken();
  const docs = await warehouseAdminBatchRead(token, [path]);
  const row = docs.get(path);
  if (!row) return null;
  const parsed = validateWarehouseBarcodeAssociation(
    warehouseCanonicalBarcodeReadInput(id, row.data),
    { expectedWorkspaceId: access.workspaceId, expectedUg: access.ug }
  );
  if (!parsed.ok || parsed.data.barcode !== code || parsed.data.id !== id) {
    throw new WarehouseStoreError('WAREHOUSE_MOBILE_BARCODE_INTEGRITY', 409);
  }
  return parsed.data;
}
