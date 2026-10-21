'use client';

import { auth } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import { normalizeWorkspaceId } from '../platformIdentity';
import type { WarehouseMaterial } from './material';
import type { WarehouseLocationBalance, WarehouseStockPosition } from './location';
import type { WarehouseLot } from './lot';
import type { ApplyWarehouseMovementResult } from './ledgerRepository';
import type { TransferWarehouseStockResult } from './locationRepository';

export interface RegisterWarehouseManualEntryInput {
  operationId: string;
  existingMaterialId?: string | null;
  description: string;
  unitLabel: string;
  quantity: number;
  provenance: string;
  reference?: string | null;
  position: WarehouseStockPosition;
  expiresOn?: string | null;
  barcode?: string | null;
}

export interface RegisterWarehouseManualEntryResult {
  material: WarehouseMaterial;
  entry: ApplyWarehouseMovementResult;
  transfer: TransferWarehouseStockResult | null;
  locationBalance: WarehouseLocationBalance;
  validity: WarehouseLot | null;
  barcodeLinked: boolean;
  warnings: string[];
}

/**
 * Único contrato usado pelo desktop e celular.
 * O navegador não cria movimentações, saldos, lotes ou barcodes.
 * O servidor valida novamente usuário, UG e toda a operação.
 */
export async function registerWarehouseManualEntry(
  workspaceId: string,
  input: RegisterWarehouseManualEntryInput
): Promise<RegisterWarehouseManualEntryResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('WAREHOUSE_MANUAL_ENTRY_AUTH_REQUIRED');
  const normalized = normalizeWorkspaceId(workspaceId);
  const scope = getCurrentOperationalScope(user.uid);
  if (scope.workspaceId !== normalized || !scope.ug) {
    throw new Error('WAREHOUSE_MANUAL_ENTRY_SCOPE_MISMATCH');
  }

  const idToken = await user.getIdToken();
  let response: Response;
  try {
    response = await fetch('/api/central-depositos/manual-entry', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + idToken,
      },
      body: JSON.stringify({ workspaceId: normalized, input }),
      cache: 'no-store',
    });
  } catch {
    throw new Error('WAREHOUSE_MANUAL_ENTRY_SERVER_UNAVAILABLE');
  }

  const payload = await response.json().catch(() => null) as
    | { ok?: boolean; error?: string; result?: RegisterWarehouseManualEntryResult }
    | null;
  if (!response.ok || !payload?.ok || !payload.result) {
    throw new Error(payload?.error || 'WAREHOUSE_MANUAL_ENTRY_SERVER_UNAVAILABLE');
  }
  return payload.result;
}
