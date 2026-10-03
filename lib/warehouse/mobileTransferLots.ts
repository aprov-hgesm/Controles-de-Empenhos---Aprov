import type { WarehouseLot } from './lot';

export const WAREHOUSE_MOBILE_TRANSFER_CRITICAL_LOT_MAX_RESULTS = 500;
export const WAREHOUSE_MOBILE_TRANSFER_CRITICAL_LOT_FETCH_LIMIT =
  WAREHOUSE_MOBILE_TRANSFER_CRITICAL_LOT_MAX_RESULTS + 1;

export type WarehouseMobileTransferCriticalLotsResult =
  | {
      status: 'complete';
      lots: WarehouseLot[];
    }
  | {
      status: 'saturated';
      observedCount: number;
    };

/**
 * Prova se a leitura bounded de lotes pode ser tratada como completa.
 *
 * O repository consulta MAX + 1. Encontrar o registro extra significa que a
 * MOBILE-D não conhece o conjunto integral relevante e deve falhar fechado.
 */
export function finalizeWarehouseMobileTransferCriticalLots(
  lots: WarehouseLot[]
): WarehouseMobileTransferCriticalLotsResult {
  if (lots.length > WAREHOUSE_MOBILE_TRANSFER_CRITICAL_LOT_MAX_RESULTS) {
    return {
      status: 'saturated',
      observedCount: lots.length,
    };
  }

  return {
    status: 'complete',
    lots,
  };
}

/**
 * Adapter fail-closed: a exceção do loader não é transformada em lista vazia.
 */
export async function loadWarehouseMobileTransferCriticalLotsFailClosed(
  loader: () => Promise<WarehouseLot[]>
): Promise<WarehouseMobileTransferCriticalLotsResult> {
  const lots = await loader();
  return finalizeWarehouseMobileTransferCriticalLots(lots);
}
