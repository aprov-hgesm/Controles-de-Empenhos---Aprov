import type { Alert, AlertLogisticsMetadata } from '../types';
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

export const WAREHOUSE_LOGISTICS_ALERT_PREFIX = 'warehouse-logistics-';

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

export interface WarehouseSiscofisAlertSnapshot {
  id: string;
  status: 'APPLYING' | 'CONFIRMED';
  referenceDate: string;
  summary: { divergentRows: number; unresolvedRows: number };
}

export interface WarehouseLogisticsAlertCandidate {
  kind: WarehouseLogisticsAlertKind;
  entityId: string;
  alert: Alert;
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

function slug(value: string): string {
  const normalized = value.toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (normalized || 'entity').slice(0, 180);
}

export function warehouseLogisticsAlertKindSlug(kind: WarehouseLogisticsAlertKind): string {
  return kind.toLowerCase().replace(/_/g, '-');
}

export function warehouseLogisticsAlertManagedPrefix(
  workspaceId: string,
  kind: WarehouseLogisticsAlertKind
): string {
  return WAREHOUSE_LOGISTICS_ALERT_PREFIX
    + warehouseLogisticsAlertKindSlug(kind)
    + '-'
    + slug(workspaceId)
    + '-';
}

export function createWarehouseLogisticsAlertId(
  kind: WarehouseLogisticsAlertKind,
  workspaceId: string,
  entityId: string
): string {
  return warehouseLogisticsAlertManagedPrefix(workspaceId, kind) + slug(entityId);
}

function candidate(
  workspaceId: string,
  kind: WarehouseLogisticsAlertKind,
  entityId: string,
  type: Alert['type'],
  title: string,
  subtitle: string,
  description: string,
  empenhoId?: string
): WarehouseLogisticsAlertCandidate {
  const logistics: AlertLogisticsMetadata = {
    managedBy: 'warehouse-phase-11',
    kind,
    entityId,
    active: true,
    fingerprint: [kind, entityId, title, subtitle, description].join('|'),
  };
  return {
    kind,
    entityId,
    alert: {
      id: createWarehouseLogisticsAlertId(kind, workspaceId, entityId),
      ...(empenhoId ? { empenhoId } : {}),
      type,
      status: 'NOVO',
      source: 'SISTEMA',
      title,
      subtitle,
      description,
      date: new Date().toISOString(),
      logistics,
    },
  };
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
        input.workspaceId, 'STOCK_ZERO', balance.materialId, 'ESTOQUE ZERADO',
        'Estoque zerado', material.description,
        'O saldo canônico deste material está zerado. Consulte o Estoque antes de nova saída.'
      ));
      continue;
    }

    if (
      input.settings?.lowStockThreshold != null
      && balance.quantity > 0
      && balance.quantity <= input.settings.lowStockThreshold
    ) {
      result.push(candidate(
        input.workspaceId, 'LOW_STOCK', balance.materialId, 'ATENÇÃO',
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
          input.workspaceId, 'MATERIAL_UNLOCATED', balance.materialId, 'ATENÇÃO',
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
        input.workspaceId, 'LOT_EXPIRED', lot.id, 'CRÍTICO',
        'Lote vencido', materialName(materialById, lot.materialId),
        'Lote ' + lot.code + ' possui saldo rastreado e validade vencida em '
          + (lot.expiresOn || 'data não informada') + '.'
      ));
    } else if (state === 'NEAR_EXPIRY') {
      result.push(candidate(
        input.workspaceId, 'LOT_NEAR_EXPIRY', lot.id, 'ATENÇÃO',
        'Lote próximo do vencimento', materialName(materialById, lot.materialId),
        'Lote ' + lot.code + ' vence em ' + (lot.expiresOn || 'data não informada')
          + '. A janela canônica de validade próxima é reutilizada do estoque.'
      ));
    }
  }

  for (const inventory of input.inventories) {
    if (inventory.status !== 'RECONCILIATION_REQUIRED') continue;
    result.push(candidate(
      input.workspaceId, 'INVENTORY_RECONCILIATION', inventory.id, 'CRÍTICO',
      'Inventário exige reconciliação', 'Sessão ' + inventory.id,
      'A sessão foi pausada por mudança concorrente do estoque e exige revisão humana.'
    ));
  }

  const latestSiscofis = input.siscofisSnapshots.find((snapshot) => snapshot.status === 'CONFIRMED');
  if (
    latestSiscofis
    && (latestSiscofis.summary.divergentRows > 0 || latestSiscofis.summary.unresolvedRows > 0)
  ) {
    result.push(candidate(
      input.workspaceId, 'SISCOFIS_DIVERGENCE', latestSiscofis.id, 'ATENÇÃO',
      'Conciliação SISCOFIS com divergência', 'Referência ' + latestSiscofis.referenceDate,
      latestSiscofis.summary.divergentRows + ' divergência(s) e '
        + latestSiscofis.summary.unresolvedRows + ' linha(s) sem vínculo exigem análise.'
    ));
  }

  for (const delivery of input.deliveries) {
    if (delivery.overdueQuantity > 0) {
      result.push(candidate(
        input.workspaceId, 'DELIVERY_OVERDUE', delivery.empenhoId, 'ATENÇÃO',
        'Previsão de entrega vencida',
        'Empenho ' + delivery.empenhoId + ' · ' + delivery.supplier,
        delivery.overdueQuantity
          + ' unidade(s) previstas até hoje ainda não constam como recebidas no EMPROVEX.',
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
        input.workspaceId, 'DELIVERY_DUE_SOON', delivery.empenhoId, 'ATENÇÃO',
        'Entrega prevista se aproximando',
        'Empenho ' + delivery.empenhoId + ' · ' + delivery.supplier,
        'Próxima previsão em ' + delivery.nextDeliveryDate
          + ' (' + delivery.daysUntilNextDelivery + ' dia(s)).',
        delivery.empenhoId
      ));
    }
  }

  const unique = new Map<string, WarehouseLogisticsAlertCandidate>();
  for (const item of result) unique.set(item.alert.id, item);
  return Array.from(unique.values());
}

export function buildWarehouseDeliveryAlertCandidates(
  workspaceId: string,
  deliveries: readonly WarehouseDeliveryProjection[]
): WarehouseLogisticsAlertCandidate[] {
  return buildWarehouseLogisticsAlertCandidates({
    workspaceId,
    materials: [],
    balances: [],
    locationBalances: [],
    lots: [],
    inventories: [],
    siscofisSnapshots: [],
    deliveries,
    settings: null,
  }).filter(
    (item) => item.kind === 'DELIVERY_OVERDUE' || item.kind === 'DELIVERY_DUE_SOON'
  );
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

  const expiredLots = input.lots.filter(
    (lot) => lot.status === 'active' && lot.quantity > 0
      && warehouseLotExpiryState(lot, input.today) === 'EXPIRED'
  ).length;
  const nearExpiryLots = input.lots.filter(
    (lot) => lot.status === 'active' && lot.quantity > 0
      && warehouseLotExpiryState(lot, input.today) === 'NEAR_EXPIRY'
  ).length;
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
    expiredLots,
    nearExpiryLots,
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
      (delivery) =>
        delivery.remainingQuantity > 0
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
