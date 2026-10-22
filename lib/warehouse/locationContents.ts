import type { WarehouseLocation, WarehouseLocationBalance } from './location';
import { warehouseStockPositionsEqual } from './location';
import type { WarehouseMaterial } from './material';
import type { WarehouseLot } from './lot';

export interface LocationContentsLot {
  id: string;
  code: string;
  quantity: number;
  expiresOn: string | null;
}

export interface LocationContentsRow {
  materialId: string;
  description: string;
  quantity: number;
  unit: string;
  lots: LocationContentsLot[];
  quantityWithoutLot: number;
  lotQuantityExceedsBalance: boolean;
}

export interface LocationContentsGroup {
  id: string;
  code: string;
  name: string;
  direct: boolean;
  rows: LocationContentsRow[];
}

export interface LocationContents {
  location: WarehouseLocation;
  groups: LocationContentsGroup[];
  materialCount: number;
  rowCount: number;
  hasLotDiscrepancy: boolean;
}

/** Projeção read-only: saldo físico é a única fonte autorizada de quantidade. */
export function deriveWarehouseLocationContents(
  locationId: string,
  locations: WarehouseLocation[],
  balances: WarehouseLocationBalance[],
  materials: WarehouseMaterial[],
  lots: WarehouseLot[]
): LocationContents | null {
  const location = locations.find((candidate) =>
    candidate.id === locationId && candidate.kind === 'LOCAL' && candidate.status === 'active'
  );
  if (!location) return null;

  const materialById = new Map(materials.map((material) => [material.id, material]));
  const subpositionById = new Map(
    locations
      .filter((candidate) =>
        candidate.kind === 'SUBPOSITION'
        && candidate.parentLocationId === location.id
        && candidate.depotId === location.depotId
        && candidate.status === 'active'
      )
      .map((candidate) => [candidate.id, candidate])
  );
  const grouped = new Map<string, LocationContentsGroup>();
  let rowCount = 0;
  const materialIds = new Set<string>();
  let hasLotDiscrepancy = false;

  for (const balance of balances) {
    if (balance.quantity <= 0 || balance.position.kind === 'UNASSIGNED') continue;
    if (
      balance.position.depotId !== location.depotId
      || balance.position.locationId !== location.id
    ) continue;

    const subposition = balance.position.kind === 'SUBPOSITION'
      ? subpositionById.get(balance.position.subpositionId)
      : null;
    const key = balance.position.kind === 'SUBPOSITION'
      ? balance.position.subpositionId
      : location.id;
    let group = grouped.get(key);
    if (!group) {
      group = {
        id: key,
        code: subposition?.code || (key === location.id ? 'LOCAL' : 'SEM CADASTRO'),
        name: subposition?.name || (key === location.id ? 'Sem prateleira' : 'Subposição não localizada'),
        direct: key === location.id,
        rows: [],
      };
      grouped.set(key, group);
    }
    const material = materialById.get(balance.materialId);
    const matchedLots = lots
      .filter((lot) =>
        lot.status === 'active'
        && lot.materialId === balance.materialId
        && lot.quantity > 0
        && warehouseStockPositionsEqual(lot.position, balance.position)
      )
      .sort((a, b) => (a.expiresOn || '9999-12-31').localeCompare(b.expiresOn || '9999-12-31'));
    const lotQuantity = matchedLots.reduce((sum, lot) => sum + lot.quantity, 0);
    const exceeds = lotQuantity > balance.quantity + 0.000001;
    hasLotDiscrepancy = hasLotDiscrepancy || exceeds;
    group.rows.push({
      materialId: balance.materialId,
      description: material?.description || 'Material não localizado (' + balance.materialId + ')',
      quantity: balance.quantity,
      unit: material?.unit.label || material?.unit.code.toUpperCase() || 'UN',
      lots: matchedLots.map((lot) => ({
        id: lot.id,
        code: lot.code,
        quantity: lot.quantity,
        expiresOn: lot.expiresOn,
      })),
      quantityWithoutLot: Math.max(0, balance.quantity - lotQuantity),
      lotQuantityExceedsBalance: exceeds,
    });
    rowCount += 1;
    materialIds.add(balance.materialId);
  }

  const groups = [...grouped.values()].sort((left, right) =>
    Number(left.direct) - Number(right.direct)
    || left.code.localeCompare(right.code, 'pt-BR', { numeric: true })
  );
  for (const group of groups) {
    group.rows.sort((left, right) => left.description.localeCompare(right.description, 'pt-BR'));
  }

  return {
    location,
    groups,
    materialCount: materialIds.size,
    rowCount,
    hasLotDiscrepancy,
  };
}

export function warehouseLocationQuantity(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

export function warehouseLocationExpiry(value: string | null): string {
  if (!value) return 'Não informada';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? match[3] + '/' + match[2] + '/' + match[1] : value;
}

/** Classificação por dias civis; fuso horário não deve deslocar a validade. */
export function warehouseLocationExpiryStatus(
  expiresOn: string | null,
  today = new Date()
): 'expired' | 'soon' | 'normal' | 'none' {
  if (!expiresOn || !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) return 'none';
  const [year, month, day] = expiresOn.split('-').map(Number);
  const expiresAt = Date.UTC(year, month - 1, day);
  if (new Date(expiresAt).toISOString().slice(0, 10) !== expiresOn) return 'none';
  const todayAt = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const remainingDays = Math.round((expiresAt - todayAt) / 86400000);
  if (remainingDays < 0) return 'expired';
  if (remainingDays <= 14) return 'soon';
  return 'normal';
}
