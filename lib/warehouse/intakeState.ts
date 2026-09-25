import { isWarehouseItemIntakeId } from './intake';

export const WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION = 'warehouse_item_intake_v2' as const;

export type WarehouseItemIntakeStatus =
  | 'PENDING'
  | 'PARTIALLY_PROCESSED'
  | 'PROCESSED';

export type WarehouseItemIntakeEffectiveStatus =
  | WarehouseItemIntakeStatus
  | 'RECONCILIATION_REQUIRED';

export type WarehouseItemIntakeReconciliationReason =
  | 'CANONICAL_QUANTITY_CHANGED'
  | 'CANONICAL_SOURCE_MISSING'
  | 'LEGACY_INVOICE_PROJECTION';

export interface WarehouseItemIntakeState {
  schemaVersion: typeof WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  ug: string;
  invoiceRecordKey: string;
  invoiceId: string;
  empenhoId: string;
  itemId: string;
  materialId: string | null;
  description: string;
  unitLabel: string;
  supplier: string;
  receivedQuantity: number;
  allocatedQuantity: number;
  immediateConsumptionQuantity: number;
  pendingQuantity: number;
  status: WarehouseItemIntakeStatus;
  createdAt: string | null;
  updatedAt: string | null;
  createdBy: string;
  updatedBy: string;
}

export interface WarehouseItemIntakeStateValidationIssue {
  path: string;
  message: string;
}

const QUANTITY_EPSILON = 0.000001;
const MAX_QUANTITY = 1_000_000_000;

function normalizeQuantity(value: number): number {
  return Math.abs(value) < QUANTITY_EPSILON ? 0 : value;
}

export function calculateWarehouseItemIntakePendingQuantity(
  receivedQuantity: number,
  allocatedQuantity: number,
  immediateConsumptionQuantity: number
): number {
  return normalizeQuantity(
    receivedQuantity - allocatedQuantity - immediateConsumptionQuantity
  );
}

export function deriveWarehouseItemIntakeStatus(
  receivedQuantity: number,
  allocatedQuantity: number,
  immediateConsumptionQuantity: number
): WarehouseItemIntakeStatus {
  const pendingQuantity = calculateWarehouseItemIntakePendingQuantity(
    receivedQuantity,
    allocatedQuantity,
    immediateConsumptionQuantity
  );
  const processedQuantity = allocatedQuantity + immediateConsumptionQuantity;

  if (pendingQuantity <= QUANTITY_EPSILON) return 'PROCESSED';
  if (processedQuantity <= QUANTITY_EPSILON) return 'PENDING';
  return 'PARTIALLY_PROCESSED';
}

export function validateWarehouseItemIntakeState(
  value: unknown,
  options: { expectedWorkspaceId?: string; expectedUg?: string } = {}
):
  | { ok: true; data: WarehouseItemIntakeState; issues: [] }
  | { ok: false; issues: WarehouseItemIntakeStateValidationIssue[] } {
  const issues: WarehouseItemIntakeStateValidationIssue[] = [];

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      issues: [{ path: '$', message: 'Estado logístico de item inválido.' }],
    };
  }

  const raw = value as Record<string, unknown>;
  const requiredText = (key: string, max: number): string => {
    const candidate = raw[key];
    if (
      typeof candidate !== 'string'
      || !candidate.trim()
      || candidate.length > max
    ) {
      issues.push({ path: key, message: 'Texto inválido.' });
      return '';
    }
    return candidate.trim();
  };
  const nullableText = (key: string, max: number): string | null => {
    const candidate = raw[key];
    if (candidate == null) return null;
    if (
      typeof candidate !== 'string'
      || !candidate.trim()
      || candidate.length > max
    ) {
      issues.push({ path: key, message: 'Texto inválido.' });
      return null;
    }
    return candidate.trim();
  };
  const quantity = (key: string): number => {
    const candidate = raw[key];
    if (
      typeof candidate !== 'number'
      || !Number.isFinite(candidate)
      || candidate < 0
      || candidate > MAX_QUANTITY
    ) {
      issues.push({ path: key, message: 'Quantidade inválida.' });
      return NaN;
    }
    return normalizeQuantity(candidate);
  };
  const nullableTimestamp = (key: string): string | null => {
    const candidate = raw[key];
    if (candidate == null) return null;
    if (
      typeof candidate !== 'string'
      || !candidate
      || !Number.isFinite(Date.parse(candidate))
    ) {
      issues.push({ path: key, message: 'Data/hora inválida.' });
      return null;
    }
    return candidate;
  };

  if (raw.schemaVersion !== WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION) {
    issues.push({ path: 'schemaVersion', message: 'Versão do contrato inválida.' });
  }

  const id = requiredText('id', 80);
  const workspaceId = requiredText('workspaceId', 120);
  const ug = requiredText('ug', 6);
  const invoiceRecordKey = requiredText('invoiceRecordKey', 180);
  const invoiceId = requiredText('invoiceId', 120);
  const empenhoId = requiredText('empenhoId', 120);
  const itemId = requiredText('itemId', 120);
  const materialId = nullableText('materialId', 80);
  const description = requiredText('description', 240);
  const unitLabel = requiredText('unitLabel', 80);
  const supplier = requiredText('supplier', 240);
  const receivedQuantity = quantity('receivedQuantity');
  const allocatedQuantity = quantity('allocatedQuantity');
  const immediateConsumptionQuantity = quantity('immediateConsumptionQuantity');
  const pendingQuantity = quantity('pendingQuantity');
  const createdAt = nullableTimestamp('createdAt');
  const updatedAt = nullableTimestamp('updatedAt');
  const createdBy = requiredText('createdBy', 180);
  const updatedBy = requiredText('updatedBy', 180);
  const status = raw.status;

  if (!isWarehouseItemIntakeId(id)) {
    issues.push({ path: 'id', message: 'Identidade logística inválida.' });
  }
  if (options.expectedWorkspaceId && workspaceId !== options.expectedWorkspaceId) {
    issues.push({ path: 'workspaceId', message: 'Workspace divergente.' });
  }
  if (options.expectedUg && ug !== options.expectedUg) {
    issues.push({ path: 'ug', message: 'UG divergente.' });
  }
  if (!/^\d{6}$/.test(ug)) {
    issues.push({ path: 'ug', message: 'UG inválida.' });
  }
  if (materialId && !/^mat_[a-f0-9]{32}$/.test(materialId)) {
    issues.push({ path: 'materialId', message: 'Material inválido.' });
  }
  if (!(receivedQuantity > 0)) {
    issues.push({ path: 'receivedQuantity', message: 'Quantidade recebida deve ser positiva.' });
  }

  if (
    Number.isFinite(receivedQuantity)
    && Number.isFinite(allocatedQuantity)
    && Number.isFinite(immediateConsumptionQuantity)
    && allocatedQuantity + immediateConsumptionQuantity > receivedQuantity + QUANTITY_EPSILON
  ) {
    issues.push({
      path: 'allocatedQuantity',
      message: 'Quantidade tratada não pode superar a quantidade recebida.',
    });
  }

  const expectedPending = calculateWarehouseItemIntakePendingQuantity(
    receivedQuantity,
    allocatedQuantity,
    immediateConsumptionQuantity
  );

  if (
    Number.isFinite(pendingQuantity)
    && Number.isFinite(expectedPending)
    && Math.abs(pendingQuantity - expectedPending) > QUANTITY_EPSILON
  ) {
    issues.push({
      path: 'pendingQuantity',
      message: 'Quantidade pendente diverge da quantidade recebida menos as quantidades tratadas.',
    });
  }

  if (
    status !== 'PENDING'
    && status !== 'PARTIALLY_PROCESSED'
    && status !== 'PROCESSED'
  ) {
    issues.push({ path: 'status', message: 'Status logístico inválido.' });
  } else if (
    Number.isFinite(receivedQuantity)
    && Number.isFinite(allocatedQuantity)
    && Number.isFinite(immediateConsumptionQuantity)
    && status !== deriveWarehouseItemIntakeStatus(
      receivedQuantity,
      allocatedQuantity,
      immediateConsumptionQuantity
    )
  ) {
    issues.push({ path: 'status', message: 'Status incompatível com as quantidades.' });
  }

  if (issues.length) return { ok: false, issues };

  return {
    ok: true,
    data: {
      schemaVersion: WAREHOUSE_ITEM_INTAKE_STATE_SCHEMA_VERSION,
      id,
      workspaceId,
      ug,
      invoiceRecordKey,
      invoiceId,
      empenhoId,
      itemId,
      materialId,
      description,
      unitLabel,
      supplier,
      receivedQuantity,
      allocatedQuantity,
      immediateConsumptionQuantity,
      pendingQuantity,
      status: status as WarehouseItemIntakeStatus,
      createdAt,
      updatedAt,
      createdBy,
      updatedBy,
    },
    issues: [],
  };
}
