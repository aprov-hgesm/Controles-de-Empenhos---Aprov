'use client';

import { auth } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import {
  normalizeWarehouseBarcode,
  validateWarehouseBarcodeAssociation,
  type WarehouseBarcodeAssociation,
} from './barcode';

/**
 * Leitura de barcode específica do Operador Móvel. Sem leitura direta
 * pelo SDK; nenhum fallback para getDoc em caso de falha do servidor.
 */
export async function getWarehouseMobileBarcodeByCode(
  workspaceId: string,
  barcode: string
): Promise<WarehouseBarcodeAssociation | null> {
  const user = auth.currentUser;
  if (!user) throw new Error('WAREHOUSE_MOBILE_BARCODE_AUTH_REQUIRED');
  const scope = getCurrentOperationalScope(user.uid);
  if (scope.workspaceId !== workspaceId || !scope.ug) {
    throw new Error('WAREHOUSE_MOBILE_BARCODE_SCOPE_MISMATCH');
  }
  const normalized = normalizeWarehouseBarcode(barcode);
  if (!normalized) throw new Error('WAREHOUSE_INVALID_BARCODE');
  const token = await user.getIdToken();
  let response: Response;
  try {
    response = await fetch('/api/central-depositos/mobile-barcode', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({ workspaceId, barcode: normalized }),
      cache: 'no-store',
    });
  } catch {
    throw new Error('WAREHOUSE_MOBILE_BARCODE_SERVER_UNAVAILABLE');
  }
  const payload = await response.json().catch(() => null) as
    { ok?: boolean; result?: unknown; error?: string } | null;
  if (!response.ok || !payload?.ok || !('result' in payload)) {
    throw new Error(payload?.error || 'WAREHOUSE_MOBILE_BARCODE_SERVER_UNAVAILABLE');
  }
  if (payload.result === null) return null;
  const parsed = validateWarehouseBarcodeAssociation(payload.result, {
    expectedWorkspaceId: scope.workspaceId,
    expectedUg: scope.ug,
  });
  if (!parsed.ok || parsed.data.barcode !== normalized) {
    throw new Error('WAREHOUSE_MOBILE_BARCODE_INTEGRITY');
  }
  return parsed.data;
}
