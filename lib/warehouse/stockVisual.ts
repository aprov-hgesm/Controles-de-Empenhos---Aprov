/**
 * Read-only representation of physical stock for the warehouse 3D preview.
 * Never infer stock or lot assignment from labels, material totals or a different
 * position. No Firestore dependency: the caller supplies existing domain records.
 */
type PhysicalPosition =
  | { kind: 'UNASSIGNED' }
  | { kind: 'LOCATION' | 'SUBPOSITION'; depotId: string; locationId: string; subpositionId: string | null };

type VisualBalance = { materialId: string; quantity: number; position: PhysicalPosition };
type VisualLot = {
  materialId: string;
  quantity: number;
  position: PhysicalPosition;
  status: string;
  expiresOn: string | null;
};

export type WarehouseVisualExpiry = 'normal' | 'near' | 'expired';

export interface WarehouseVisualExpiryMap {
  byLocation: Map<string, WarehouseVisualExpiry>;
  bySubposition: Map<string, WarehouseVisualExpiry>;
  /** Lots assigned at a location without a subposition, not its children. */
  byBaseLocation: Map<string, WarehouseVisualExpiry>;
}

export const WAREHOUSE_VISUAL_EXPIRY_DAYS = 14;

/** UTC cutoff used both by the Firestore range query and the renderer. */
export function warehouseVisualExpiryCutoffDate(today: Date = new Date()): string {
  return new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate() + WAREHOUSE_VISUAL_EXPIRY_DAYS
  )).toISOString().slice(0, 10);
}

function dateUtc(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : null;
}

function physicalKey(position: PhysicalPosition): string | null {
  if (position.kind === 'UNASSIGNED') return null;
  return [
    position.depotId, position.locationId,
    position.kind === 'SUBPOSITION' ? position.subpositionId || '' : '',
  ].join('|');
}

function severity(state: WarehouseVisualExpiry): number {
  return state === 'expired' ? 2 : state === 'near' ? 1 : 0;
}

function mark(map: Map<string, WarehouseVisualExpiry>, key: string, next: WarehouseVisualExpiry): void {
  if (severity(next) > severity(map.get(key) || 'normal')) map.set(key, next);
}

export function warehouseVisualExpiryMap(
  balances: readonly VisualBalance[],
  lots: readonly VisualLot[],
  today: Date = new Date()
): WarehouseVisualExpiryMap {
  const result: WarehouseVisualExpiryMap = {
    byLocation: new Map(),
    bySubposition: new Map(),
    byBaseLocation: new Map(),
  };
  const currentDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const backedPositions = new Set<string>();
  for (const balance of balances) {
    if (!(balance.quantity > 0)) continue;
    const key = physicalKey(balance.position);
    if (key) backedPositions.add(balance.materialId + '|' + key);
  }
  for (const lot of lots) {
    if (lot.status !== 'active' || !(lot.quantity > 0) || !lot.expiresOn) continue;
    const key = physicalKey(lot.position);
    if (!key || !backedPositions.has(lot.materialId + '|' + key)) continue;
    const expiryDay = dateUtc(lot.expiresOn);
    if (expiryDay === null) continue;
    const days = Math.round((expiryDay - currentDay) / 86400000);
    const state: WarehouseVisualExpiry =
      days < 0 ? 'expired' : days <= WAREHOUSE_VISUAL_EXPIRY_DAYS ? 'near' : 'normal';
    if (state === 'normal' || lot.position.kind === 'UNASSIGNED') continue;
    mark(result.byLocation, lot.position.locationId, state);
    if (lot.position.kind === 'SUBPOSITION' && lot.position.subpositionId) {
      mark(result.bySubposition, lot.position.subpositionId, state);
    } else {
      mark(result.byBaseLocation, lot.position.locationId, state);
    }
  }
  return result;
}

export type WarehouseVisualStackSlot = { u: number; v: number; layer: number };

/** A legible bounded proxy, not a claim that one box equals one stock unit. */
export function warehouseVisualStackSlots(quantity: number, maximum = 8): WarehouseVisualStackSlot[] {
  if (!Number.isFinite(quantity) || quantity <= 0) return [];
  const count = quantity < 5 ? 1 : quantity < 20 ? 2 : quantity < 60 ? 4 : quantity < 120 ? 6 : 8;
  const slots: WarehouseVisualStackSlot[] = [];
  const bounded = Math.min(count, Math.max(0, Math.min(8, Math.floor(maximum))));
  for (let index = 0; index < bounded; index++) {
    const layer = Math.floor(index / 4);
    const floor = index % 4;
    slots.push({
      u: floor % 2 === 0 ? 0.32 : 0.68,
      v: floor < 2 ? 0.32 : 0.68,
      layer,
    });
  }
  return slots;
}
