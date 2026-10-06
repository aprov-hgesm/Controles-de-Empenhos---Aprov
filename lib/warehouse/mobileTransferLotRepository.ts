import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';

import { auth, warehouseDb as db, handleFirestoreError, OperationType } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import { validateWarehouseLot, type WarehouseLot } from './lot';
import {
  WAREHOUSE_MOBILE_TRANSFER_CRITICAL_LOT_FETCH_LIMIT,
  loadWarehouseMobileTransferCriticalLotsFailClosed,
} from './mobileTransferLots';
import { warehouseDomainPath } from './namespace';
import { warehouseCanonicalLotReadInput } from './readCompatibility';
import { recordWarehouseDocumentReads } from './telemetry';

function currentScope(
  workspaceId: string
): { workspaceId: string; ug: string; uid: string } {
  const user = auth.currentUser;
  if (!user) throw new Error('WAREHOUSE_MOBILE_TRANSFER_LOT_AUTH_REQUIRED');

  const scope = getCurrentOperationalScope(user.uid);
  if (scope.workspaceId !== workspaceId || !scope.ug) {
    throw new Error('WAREHOUSE_MOBILE_TRANSFER_LOT_SCOPE_MISMATCH');
  }

  return {
    workspaceId: scope.workspaceId,
    ug: scope.ug,
    uid: user.uid,
  };
}

function parseCriticalLot(
  workspaceId: string,
  ug: string,
  materialId: string,
  id: string,
  data: Record<string, unknown>
): WarehouseLot {
  const result = validateWarehouseLot(
    warehouseCanonicalLotReadInput(id, data),
    {
      expectedWorkspaceId: workspaceId,
      expectedUg: ug,
      expectedMaterialId: materialId,
    }
  );

  if (!result.ok) {
    throw new Error(
      'WAREHOUSE_MOBILE_TRANSFER_INVALID_LOT: '
      + result.issues.map((item) => item.path + ': ' + item.message).join('; ')
    );
  }

  return result.data;
}

/**
 * Leitura crítica e bounded de lotes usada exclusivamente pela MOBILE-D.
 *
 * Diferente da superfície genérica de listagem, esta função:
 * - nunca transforma falha de leitura em [];
 * - consulta MAX + 1 para provar completude;
 * - falha fechado quando o conjunto pode estar saturado/incompleto.
 */
export async function listWarehouseMobileTransferLotsCritical(
  workspaceId: string,
  materialId: string
): Promise<WarehouseLot[]> {
  const scope = currentScope(workspaceId);
  const path = warehouseDomainPath(scope.workspaceId, 'lots');

  try {
    const result = await loadWarehouseMobileTransferCriticalLotsFailClosed(
      async () => {
        const snapshot = await getDocs(
          query(
            collection(db, path),
            where('materialId', '==', materialId),
            limit(WAREHOUSE_MOBILE_TRANSFER_CRITICAL_LOT_FETCH_LIMIT)
          )
        );

        recordWarehouseDocumentReads(scope.workspaceId, snapshot.size);

        return snapshot.docs.map((item) =>
          parseCriticalLot(
            scope.workspaceId,
            scope.ug,
            materialId,
            item.id,
            item.data() as Record<string, unknown>
          )
        );
      }
    );

    if (result.status === 'saturated') {
      throw new Error(
        'WAREHOUSE_MOBILE_TRANSFER_LOTS_SATURATED: '
        + result.observedCount
      );
    }

    return result.lots;
  } catch (error) {
    if (
      error instanceof Error
      && error.message.includes('WAREHOUSE_MOBILE_TRANSFER_LOTS_SATURATED')
    ) {
      throw error;
    }

    try {
      handleFirestoreError(error, OperationType.LIST, path);
    } catch (handledError) {
      const detail = handledError instanceof Error
        ? handledError.message
        : String(handledError);
      throw new Error(
        'WAREHOUSE_MOBILE_TRANSFER_LOTS_READ_FAILED: ' + detail
      );
    }

    throw new Error('WAREHOUSE_MOBILE_TRANSFER_LOTS_READ_FAILED');
  }
}
