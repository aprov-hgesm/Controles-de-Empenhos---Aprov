import type { WarehouseMaterialUnit } from './material';
import {
  listWarehousePositiveLocationBalances,
  transferWarehouseStock,
  type TransferWarehouseStockResult,
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
  const [materials, locationBalances, snapshots] = await Promise.all([
    listWarehouseMaterials(workspaceId, 500),
    listWarehousePositiveLocationBalances(workspaceId, 500),
    listWarehouseSiscofisSnapshots(workspaceId, 25),
  ]);

  const materialById = new Map(
    materials
      .filter((material) => material.status === 'active')
      .map((material) => [material.id, material])
  );

  const marcoZero = snapshots.find(
    (snapshot) =>
      snapshot.kind === 'MARCO_ZERO'
      && snapshot.status === 'CONFIRMED'
  ) || null;

  const marcoRowsByMaterial = new Map<string, typeof marcoZero.rows>();
  if (marcoZero) {
    for (const row of marcoZero.rows) {
      if (!row.materialId) continue;
      const existing = marcoRowsByMaterial.get(row.materialId) || [];
      existing.push(row);
      marcoRowsByMaterial.set(row.materialId, existing);
    }
  }

  const rows: WarehousePendingPhysicalAllocationRow[] = [];

  for (const item of locationBalances) {
    const balance = item.balance;
    if (
      balance.position.kind !== 'UNASSIGNED'
      || balance.quantity <= 0
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
      origin: marcoRows.length > 0
        ? 'SISCOFIS_MARCO_ZERO'
        : 'UNASSIGNED_STOCK',
      sourceItemNumbers: Array.from(
        new Set(
          marcoRows
            .map((row) => row.sourceItemNumber?.trim() || '')
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right, 'pt-BR')),
      referenceDate: marcoRows.length > 0
        ? marcoZero?.referenceDate || null
        : null,
    });
  }

  return rows.sort((left, right) => {
    if (left.origin !== right.origin) {
      return left.origin === 'SISCOFIS_MARCO_ZERO' ? -1 : 1;
    }
    return left.description.localeCompare(right.description, 'pt-BR');
  });
}

export async function allocateWarehousePendingPhysicalStock(
  workspaceId: string,
  input: AllocateWarehousePendingPhysicalStockInput
): Promise<TransferWarehouseStockResult> {
  if (input.position.kind === 'UNASSIGNED') {
    throw new Error('WAREHOUSE_PENDING_ALLOCATION_LOCATION_REQUIRED');
  }

  const operationId = input.operationId.trim();
  if (!operationId || operationId.length > 96) {
    throw new Error('WAREHOUSE_PENDING_ALLOCATION_INVALID_OPERATION_ID');
  }

  return transferWarehouseStock(workspaceId, {
    materialId: input.materialId,
    quantity: input.quantity,
    from: { kind: 'UNASSIGNED' },
    to: input.position,
    idempotencyKey: [
      'pending-physical-allocation',
      input.materialId,
      operationId,
    ].join(':').slice(0, 240),
    note: 'Alocação física de saldo sem localização',
  });
}
