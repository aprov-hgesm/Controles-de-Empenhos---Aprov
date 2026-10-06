import type { WarehouseMaterialUnit } from './material';
import type { WarehouseSiscofisPreviewRow } from './siscofis';
import {
  listWarehousePositiveLocationBalances,
} from './locationRepository';
import type { WarehouseStockPosition } from './location';
import { listWarehouseMaterials } from './materialRepository';
import { listWarehouseSiscofisSnapshots } from './siscofisService';

export type WarehousePendingPhysicalAllocationOrigin =
  | 'SISCOFIS_MARCO_ZERO'
  | 'UNASSIGNED_STOCK';

export interface WarehousePendingPhysicalAllocationRow {
  materialId: string;
  description: string;
  unit: WarehouseMaterialUnit;
  pendingQuantity: number;
  origin: WarehousePendingPhysicalAllocationOrigin;
  sourceItemNumbers: string[];
  referenceDate: string | null;
}

export interface AllocateWarehousePendingPhysicalStockInput {
  materialId: string;
  quantity: number;
  position: WarehouseStockPosition;
  operationId: string;
}

export async function listWarehousePendingPhysicalAllocations(
  workspaceId: string
): Promise<WarehousePendingPhysicalAllocationRow[]> {
  const snapshots = await listWarehouseSiscofisSnapshots(workspaceId, 25);
  const marcoZero = snapshots.find(
    (snapshot) =>
      snapshot.kind === 'MARCO_ZERO'
      && snapshot.status === 'CONFIRMED'
  ) || null;

  if (!marcoZero) return [];

  const marcoRowsByMaterial = new Map<string, WarehouseSiscofisPreviewRow[]>();
  for (const row of marcoZero.rows) {
    if (!row.materialId) continue;
    const existing = marcoRowsByMaterial.get(row.materialId) || [];
    existing.push(row);
    marcoRowsByMaterial.set(row.materialId, existing);
  }
  if (marcoRowsByMaterial.size === 0) return [];

  const [materials, locationBalances] = await Promise.all([
    listWarehouseMaterials(workspaceId, 500),
    listWarehousePositiveLocationBalances(workspaceId, 500),
  ]);

  const materialById = new Map(
    materials
      .filter(
        (material) =>
          material.status === 'active'
          && marcoRowsByMaterial.has(material.id)
      )
      .map((material) => [material.id, material])
  );

  const rows: WarehousePendingPhysicalAllocationRow[] = [];

  for (const item of locationBalances) {
    const balance = item.balance;
    if (
      balance.position.kind !== 'UNASSIGNED'
      || balance.quantity <= 0
      || !marcoRowsByMaterial.has(balance.materialId)
    ) {
      continue;
    }

    const material = materialById.get(balance.materialId);
    if (!material) continue;

    const marcoRows = marcoRowsByMaterial.get(material.id) || [];
    rows.push({
      materialId: material.id,
      description: material.description,
      unit: material.unit,
      pendingQuantity: balance.quantity,
      origin: 'SISCOFIS_MARCO_ZERO',
      sourceItemNumbers: Array.from(
        new Set(
          marcoRows
            .map((row) => row.sourceItemNumber?.trim() || '')
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right, 'pt-BR')),
      referenceDate: marcoZero.referenceDate,
    });
  }

  return rows.sort((left, right) =>
    left.description.localeCompare(right.description, 'pt-BR')
  );
}

export async function allocateWarehousePendingPhysicalStock(
  workspaceId: string,
  input: AllocateWarehousePendingPhysicalStockInput
): Promise<never> {
  if (input.position.kind === 'UNASSIGNED') {
    throw new Error('WAREHOUSE_PENDING_ALLOCATION_LOCATION_REQUIRED');
  }

  const operationId = input.operationId.trim();
  if (!operationId || operationId.length > 96) {
    throw new Error('WAREHOUSE_PENDING_ALLOCATION_INVALID_OPERATION_ID');
  }

  // Compatibility surface only. Marco Zero records can prove historical
  // UNASSIGNED evidence, but they are neither physical stock nor intake-v2
  // pending quantity. A dedicated reconciliation/migration path is required
  // before any balance can become operational stock in LOCATION/SUBPOSITION.
  void workspaceId;
  void input.materialId;
  void input.quantity;
  throw new Error('WAREHOUSE_PENDING_ALLOCATION_RECONCILIATION_REQUIRED');
}
