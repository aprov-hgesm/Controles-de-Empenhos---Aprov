import { deriveUnassignedQuantity, type WarehouseLocationBalance } from './location';
import { warehouseLotExpiryState, type WarehouseLot } from './lot';
import type { WarehouseMaterial } from './material';
import type { WarehouseBalance } from './movement';
import type { WarehouseInventorySession } from './inventory';
import {
  WAREHOUSE_DELIVERY_WARNING_DAYS,
  type WarehouseDeliveryProjection,
  type WarehouseLogisticsSettings,
} from './logistics';

export const WAREHOUSE_LOGISTICS_ALERT_SCHEMA_VERSION = 'warehouse_logistics_alert_v1' as const;

export type WarehouseLogisticsAlertKind =
  | 'MATERIAL_UNLOCATED'
  | 'LOT_EXPIRED'
  | 'LOT_NEAR_EXPIRY'
  | 'STOCK_ZERO'
  | 'LOW_STOCK'
  | 'INVENTORY_RECONCILIATION'
  | 'SISCOFIS_DIVERGENCE'
  | 'DELIVERY_DUE_SOON'
  | 'DELIVERY_OVERDUE';

export type WarehouseLogisticsAlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type WarehouseLogisticsAlertStatus = 'OPEN' | 'RESOLVED';

export interface WarehouseLogisticsAlert {
  schemaVersion: typeof WAREHOUSE_LOGISTICS_ALERT_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  ug: string;
  kind: WarehouseLogisticsAlertKind;
  entityId: string;
  empenhoId: string | null;
  severity: WarehouseLogisticsAlertSeverity;
  status: WarehouseLogisticsAlertStatus;
  title: string;
  subtitle: string;
  description: string;
  fingerprint: string;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  resolvedAt: string | null;
}

export interface WarehouseSiscofisAlertSnapshot {
  id: string;
  status: 'APPLYING' | 'CONFIRMED';
  referenceDate: string;
  summary: { divergentRows: number; unresolvedRows: number };
}

export interface WarehouseLogisticsAlertCandidate {
  kind: WarehouseLogisticsAlertKind;
  entityId: string;
  severity: WarehouseLogisticsAlertSeverity;
  title: string;
  subtitle: string;
  description: string;
  empenhoId: string | null;
}

export interface WarehouseLogisticsAlertInput {
  workspaceId: string;
  materials: readonly WarehouseMaterial[];
  balances: readonly WarehouseBalance[];
  locationBalances: readonly WarehouseLocationBalance[];
  lots: readonly WarehouseLot[];
  inventories: readonly WarehouseInventorySession[];
  siscofisSnapshots: readonly WarehouseSiscofisAlertSnapshot[];
  deliveries: readonly WarehouseDeliveryProjection[];
  settings: WarehouseLogisticsSettings | null;
  today?: Date;
}

export interface WarehouseLogisticsDashboardSummary {
  materialsWithStock: number;
  materialsWithoutLocation: number;
  expiredLots: number;
  nearExpiryLots: number;
  zeroStock: number;
  lowStock: number | null;
  overdueDeliveries: number;
  upcomingDeliveries: number;
  activeSchedules: number;
  inventoryAttention: number;
  siscofisDivergences: number;
}

function candidate(
  kind: WarehouseLogisticsAlertKind,
  entityId: string,
  severity: WarehouseLogisticsAlertSeverity,
  title: string,
  subtitle: string,
  description: string,
  empenhoId: string | null = null
): WarehouseLogisticsAlertCandidate {
  return { kind, entityId, severity, title, subtitle, description, empenhoId };
}

function materialName(materialById: Map<string, WarehouseMaterial>, materialId: string): string {
  return materialById.get(materialId)?.description || materialId;
}

export function buildWarehouseLogisticsAlertCandidates(
  input: WarehouseLogisticsAlertInput
): WarehouseLogisticsAlertCandidate[] {
  const today = input.today || new Date();
  const materialById = new Map(input.materials.map((material) => [material.id, material]));
  const locationsByMaterial = new Map<string, WarehouseLocationBalance[]>();
  for (const locationBalance of input.locationBalances) {
    const bucket = locationsByMaterial.get(locationBalance.materialId) || [];
    bucket.push(locationBalance);
    locationsByMaterial.set(locationBalance.materialId, bucket);
  }

  const result: WarehouseLogisticsAlertCandidate[] = [];

  for (const balance of input.balances) {
    const material = materialById.get(balance.materialId);
    if (material?.status !== 'active') continue;

    if (balance.quantity === 0) {
      result.push(candidate(
        'STOCK_ZERO', balance.materialId, 'WARNING',
        'Estoque zerado', material.description,
        'O saldo canônico deste material está zerado.'
      ));
      continue;
    }

    if (
      input.settings?.lowStockThreshold != null
      && balance.quantity > 0
      && balance.quantity <= input.settings.lowStockThreshold
    ) {
      result.push(candidate(
        'LOW_STOCK', balance.materialId, 'WARNING',
        'Baixo estoque', material.description,
        'Saldo atual ' + balance.quantity + ' está no ou abaixo do mínimo configurado de '
          + input.settings.lowStockThreshold + '.'
      ));
    }

    if (balance.quantity > 0) {
      const unassigned = deriveUnassignedQuantity(
        balance.quantity,
        locationsByMaterial.get(balance.materialId) || []
      );
      if (unassigned > 0.000001) {
        result.push(candidate(
          'MATERIAL_UNLOCATED', balance.materialId, 'WARNING',
          'Material sem localização', material.description,
          'Há ' + unassigned + ' unidade(s) do saldo sem posição física atribuída.'
        ));
      }
    }
  }

  for (const lot of input.lots) {
    if (lot.status !== 'active' || lot.quantity <= 0) continue;
    const state = warehouseLotExpiryState(lot, today);
    if (state === 'EXPIRED') {
      result.push(candidate(
        'LOT_EXPIRED', lot.id, 'CRITICAL',
        'Lote vencido', materialName(materialById, lot.materialId),
        'Lote ' + lot.code + ' possui saldo rastreado e validade vencida em '
          + (lot.expiresOn || 'data não informada') + '.'
      ));
    } else if (state === 'NEAR_EXPIRY') {
      result.push(candidate(
        'LOT_NEAR_EXPIRY', lot.id, 'WARNING',
        'Lote próximo do vencimento', materialName(materialById, lot.materialId),
        'Lote ' + lot.code + ' vence em ' + (lot.expiresOn || 'data não informada') + '.'
      ));
    }
  }

  for (const inventory of input.inventories) {
    if (inventory.status !== 'RECONCILIATION_REQUIRED') continue;
    result.push(candidate(
      'INVENTORY_RECONCILIATION', inventory.id, 'CRITICAL',
      'Inventário exige reconciliação', 'Sessão ' + inventory.id,
      'A sessão foi pausada por mudança concorrente do estoque e exige revisão humana.'
    ));
  }

  const latestSiscofis = input.siscofisSnapshots.find((snapshot) => snapshot.status === 'CONFIRMED');
  if (latestSiscofis && (latestSiscofis.summary.divergentRows > 0 || latestSiscofis.summary.unresolvedRows > 0)) {
    result.push(candidate(
      'SISCOFIS_DIVERGENCE', latestSiscofis.id, 'WARNING',
      'Conciliação SISCOFIS com divergência', 'Referência ' + latestSiscofis.referenceDate,
      latestSiscofis.summary.divergentRows + ' divergência(s) e '
        + latestSiscofis.summary.unresolvedRows + ' linha(s) sem vínculo exigem análise.'
    ));
  }

  for (const delivery of input.deliveries) {
    if (delivery.overdueQuantity > 0) {
      result.push(candidate(
        'DELIVERY_OVERDUE', delivery.empenhoId, 'WARNING',
        'Previsão de entrega vencida',
        'Empenho ' + delivery.empenhoId + ' · ' + delivery.supplier,
        delivery.overdueQuantity + ' unidade(s) previstas até hoje ainda não constam como recebidas.',
        delivery.empenhoId
      ));
      continue;
    }
    if (
      delivery.remainingQuantity > 0
      && delivery.daysUntilNextDelivery != null
      && delivery.daysUntilNextDelivery >= 0
      && delivery.daysUntilNextDelivery <= WAREHOUSE_DELIVERY_WARNING_DAYS
    ) {
      result.push(candidate(
        'DELIVERY_DUE_SOON', delivery.empenhoId, 'INFO',
        'Entrega prevista se aproximando',
        'Empenho ' + delivery.empenhoId + ' · ' + delivery.supplier,
        'Próxima previsão em ' + delivery.nextDeliveryDate
          + ' (' + delivery.daysUntilNextDelivery + ' dia(s)).',
        delivery.empenhoId
      ));
    }
  }

  const unique = new Map<string, WarehouseLogisticsAlertCandidate>();
  for (const item of result) unique.set(item.kind + ':' + item.entityId, item);
  return Array.from(unique.values());
}

export function buildWarehouseLogisticsDashboardSummary(
  input: WarehouseLogisticsAlertInput
): WarehouseLogisticsDashboardSummary {
  const activeMaterialIds = new Set(
    input.materials.filter((material) => material.status === 'active').map((material) => material.id)
  );
  const locationsByMaterial = new Map<string, WarehouseLocationBalance[]>();
  for (const item of input.locationBalances) {
    const bucket = locationsByMaterial.get(item.materialId) || [];
    bucket.push(item);
    locationsByMaterial.set(item.materialId, bucket);
  }

  const latestSiscofis = input.siscofisSnapshots.find((snapshot) => snapshot.status === 'CONFIRMED');

  return {
    materialsWithStock: input.balances.filter(
      (balance) => activeMaterialIds.has(balance.materialId) && balance.quantity > 0
    ).length,
    materialsWithoutLocation: input.balances.filter((balance) =>
      activeMaterialIds.has(balance.materialId)
      && balance.quantity > 0
      && deriveUnassignedQuantity(
        balance.quantity,
        locationsByMaterial.get(balance.materialId) || []
      ) > 0.000001
    ).length,
    expiredLots: input.lots.filter(
      (lot) => lot.status === 'active' && lot.quantity > 0
        && warehouseLotExpiryState(lot, input.today) === 'EXPIRED'
    ).length,
    nearExpiryLots: input.lots.filter(
      (lot) => lot.status === 'active' && lot.quantity > 0
        && warehouseLotExpiryState(lot, input.today) === 'NEAR_EXPIRY'
    ).length,
    zeroStock: input.balances.filter(
      (balance) => activeMaterialIds.has(balance.materialId) && balance.quantity === 0
    ).length,
    lowStock: input.settings?.lowStockThreshold == null
      ? null
      : input.balances.filter(
          (balance) =>
            activeMaterialIds.has(balance.materialId)
            && balance.quantity > 0
            && balance.quantity <= input.settings!.lowStockThreshold!
        ).length,
    overdueDeliveries: input.deliveries.filter((delivery) => delivery.overdueQuantity > 0).length,
    upcomingDeliveries: input.deliveries.filter(
      (delivery) => delivery.remainingQuantity > 0
        && delivery.nextDeliveryDate != null
        && delivery.overdueQuantity <= 0
    ).length,
    activeSchedules: input.deliveries.filter(
      (delivery) => delivery.hasSchedule && delivery.remainingQuantity > 0
    ).length,
    inventoryAttention: input.inventories.filter(
      (inventory) => inventory.status === 'RECONCILIATION_REQUIRED'
    ).length,
    siscofisDivergences: latestSiscofis
      ? latestSiscofis.summary.divergentRows + latestSiscofis.summary.unresolvedRows
      : 0,
  };
}
