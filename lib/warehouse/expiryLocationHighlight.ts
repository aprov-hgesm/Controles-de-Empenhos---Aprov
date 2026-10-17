import type { WarehouseLocationBalance } from './location';
import type { WarehouseLot } from './lot';
import { warehouseStockPositionsEqual } from './location';

export const WAREHOUSE_LOCATION_EXPIRY_HIGHLIGHT_DAYS = 14;

/** Compara datas civis ISO sem depender do fuso UTC do servidor/browser. */
export function warehouseExpiryDayWithin(
  expiresOn: string | null,
  today: Date,
  days = WAREHOUSE_LOCATION_EXPIRY_HIGHLIGHT_DAYS
): boolean {
  if (!expiresOn || !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) return false;
  const [year, month, day] = expiresOn.split('-').map(Number);
  const expiry = Date.UTC(year, month - 1, day);
  const validDate = new Date(expiry).toISOString().slice(0, 10) === expiresOn;
  if (!validDate) return false;
  const current = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const delta = (expiry - current) / 86400000;
  return delta >= 0 && delta <= days;
}

/** Retorna locais com saldo físico positivo e lote ativo vencendo em até 14 dias.
 * Cada lote deve pertencer à mesma posição (inclusive subposição) do saldo.
 * Não altera saldos e ignora lotes antigos, vencidos, vazios e de outros locais.
 */
export function warehouseLocationsExpiringSoon(
  balances: WarehouseLocationBalance[],
  lots: WarehouseLot[],
  today: Date = new Date()
): Set<string> {
  const balanceByMaterial = new Map<string, WarehouseLocationBalance[]>();
  for (const balance of balances) {
    if (balance.quantity <= 0 || balance.position.kind === 'UNASSIGNED') continue;
    const current = balanceByMaterial.get(balance.materialId) || [];
    current.push(balance);
    balanceByMaterial.set(balance.materialId, current);
  }

  const locationIds = new Set<string>();
  for (const lot of lots) {
    if (
      lot.status !== 'active'
      || lot.quantity <= 0
      || lot.position.kind === 'UNASSIGNED'
      || !warehouseExpiryDayWithin(lot.expiresOn, today)
    ) continue;
    const balancesForMaterial = balanceByMaterial.get(lot.materialId) || [];
    if (balancesForMaterial.some((balance) =>
      warehouseStockPositionsEqual(balance.position, lot.position)
    )) {
      locationIds.add(lot.position.locationId);
    }
  }
  return locationIds;
}
