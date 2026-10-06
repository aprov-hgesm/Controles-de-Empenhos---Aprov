import { isWarehouseLocationBarcode } from './locationBarcode';
import type { WarehouseMobileScanKind } from './mobileScanner';

/**
 * Glue da Integração 1.
 *
 * Somente o namespace físico EPX1 é classificado como LOCATION aqui.
 * Códigos comerciais de produto permanecem fora deste classificador e serão
 * resolvidos pelas frentes operacionais que possuem contexto de material.
 */
export function classifyWarehouseMobileLocationScan(
  value: string
): WarehouseMobileScanKind {
  return isWarehouseLocationBarcode(value) ? 'LOCATION' : 'UNKNOWN';
}
