import { warehouseStockPositionsEqual, type WarehouseLocationBalance, type WarehouseStockPosition } from './location';
import type { WarehouseLot } from './lot';
import type { WarehouseMaterial } from './material';

export function warehouseMobileCanonicalBalanceReadInput(
  id: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  return {
    schemaVersion: data.schemaVersion,
    id,
    workspaceId: data.workspaceId,
    ug: data.ug,
    materialId: data.materialId,
    position: data.position,
    quantity: data.quantity,
    revision: data.revision,
    lastMovementId: data.lastMovementId,
  };
}

export interface WarehouseMobilePhysicalQueryPlan {
  field: 'position.locationId' | 'position.subpositionId';
  value: string;
  kind: 'LOCATION' | 'SUBPOSITION';
}

export interface WarehouseMobilePhysicalQueryItem {
  material: WarehouseMaterial;
  balance: WarehouseLocationBalance;
  lots: WarehouseLot[];
}

export function warehouseMobilePhysicalQueryPlan(
  position: WarehouseStockPosition
): WarehouseMobilePhysicalQueryPlan {
  if (position.kind === 'UNASSIGNED') {
    throw new Error('WAREHOUSE_MOBILE_PHYSICAL_QUERY_POSITION_REQUIRED');
  }

  if (position.kind === 'SUBPOSITION') {
    return {
      field: 'position.subpositionId',
      value: position.subpositionId,
      kind: 'SUBPOSITION',
    };
  }

  return {
    field: 'position.locationId',
    value: position.locationId,
    kind: 'LOCATION',
  };
}

function assertScope(
  entity: { workspaceId: string; ug: string },
  expectedWorkspaceId: string,
  expectedUg: string,
  label: string
): void {
  if (entity.workspaceId !== expectedWorkspaceId) {
    throw new Error('WAREHOUSE_MOBILE_PHYSICAL_QUERY_' + label + '_WORKSPACE_MISMATCH');
  }
  if (entity.ug !== expectedUg) {
    throw new Error('WAREHOUSE_MOBILE_PHYSICAL_QUERY_' + label + '_UG_MISMATCH');
  }
}

export function buildWarehouseMobilePhysicalQueryItems(input: {
  workspaceId: string;
  ug: string;
  position: WarehouseStockPosition;
  balances: readonly WarehouseLocationBalance[];
  materials: readonly WarehouseMaterial[];
  lots: readonly WarehouseLot[];
}): WarehouseMobilePhysicalQueryItem[] {
  warehouseMobilePhysicalQueryPlan(input.position);

  const materialById = new Map<string, WarehouseMaterial>();
  input.materials.forEach((material) => {
    assertScope(material, input.workspaceId, input.ug, 'MATERIAL');
    materialById.set(material.id, material);
  });

  const lotsByMaterial = new Map<string, WarehouseLot[]>();
  input.lots.forEach((lot) => {
    assertScope(lot, input.workspaceId, input.ug, 'LOT');
    if (
      lot.status !== 'active'
      || lot.quantity <= 0
      || !warehouseStockPositionsEqual(lot.position, input.position)
    ) {
      return;
    }

    const current = lotsByMaterial.get(lot.materialId) || [];
    current.push(lot);
    lotsByMaterial.set(lot.materialId, current);
  });

  const seenMaterials = new Set<string>();
  const items: WarehouseMobilePhysicalQueryItem[] = [];

  input.balances.forEach((balance) => {
    assertScope(balance, input.workspaceId, input.ug, 'BALANCE');

    if (
      balance.quantity <= 0
      || !warehouseStockPositionsEqual(balance.position, input.position)
    ) {
      return;
    }

    if (seenMaterials.has(balance.materialId)) {
      throw new Error(
        'WAREHOUSE_MOBILE_PHYSICAL_QUERY_DUPLICATE_BALANCE:' + balance.materialId
      );
    }
    seenMaterials.add(balance.materialId);

    const material = materialById.get(balance.materialId);
    if (!material) {
      throw new Error('WAREHOUSE_MOBILE_PHYSICAL_QUERY_MATERIAL_NOT_FOUND');
    }

    const lots = (lotsByMaterial.get(balance.materialId) || [])
      .slice()
      .sort((left, right) => {
        const expiryCompare = (left.expiresOn || '9999-12-31')
          .localeCompare(right.expiresOn || '9999-12-31');
        return expiryCompare !== 0
          ? expiryCompare
          : left.code.localeCompare(right.code, 'pt-BR');
      });

    items.push({ material, balance, lots });
  });

  return items.sort((left, right) =>
    left.material.description.localeCompare(
      right.material.description,
      'pt-BR',
      { sensitivity: 'base' }
    )
  );
}
