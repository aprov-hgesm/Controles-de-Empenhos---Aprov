import type { WarehouseStockPosition } from './location';

export const WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION = 'warehouse_item_intake_v1' as const;

export type WarehouseItemIntakeMode = 'ALLOCATED' | 'IMMEDIATE_CONSUMPTION';
export type WarehouseItemIntakeSiscofisStatus = 'NOT_APPLICABLE' | 'PENDING' | 'POSTED';

export interface WarehouseItemIntake {
  schemaVersion: typeof WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  ug: string;
  invoiceRecordKey: string;
  invoiceId: string;
  empenhoId: string;
  itemId: string;
  materialId: string;
  description: string;
  unitLabel: string;
  quantity: number;
  mode: WarehouseItemIntakeMode;
  position: WarehouseStockPosition | null;
  lotId: string | null;
  lotCode: string | null;
  expiresOn: string | null;
  barcode: string | null;
  entryMovementId: string | null;
  transferMovementId: string | null;
  siscofisStatus: WarehouseItemIntakeSiscofisStatus;
  createdBy: string;
  updatedBy: string;
}

export interface WarehouseItemIntakeListItem {
  intake: WarehouseItemIntake;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface WarehouseItemIntakeValidationIssue {
  path: string;
  message: string;
}

export function isWarehouseItemIntakeId(value: unknown): value is string {
  return typeof value === 'string' && /^intake_[a-f0-9]{64}$/.test(value);
}

export function validateWarehouseItemIntake(
  value: unknown,
  options: { expectedWorkspaceId?: string; expectedUg?: string } = {}
):
  | { ok: true; data: WarehouseItemIntake; issues: [] }
  | { ok: false; issues: WarehouseItemIntakeValidationIssue[] } {
  const issues: WarehouseItemIntakeValidationIssue[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, issues: [{ path: '$', message: 'Registro de entrada inválido.' }] };
  }
  const raw = value as Record<string, unknown>;
  const text = (key: string, max: number, nullable = false): string | null => {
    const candidate = raw[key];
    if (nullable && candidate == null) return null;
    if (typeof candidate !== 'string' || !candidate.trim() || candidate.length > max) {
      issues.push({ path: key, message: 'Texto inválido.' });
      return null;
    }
    return candidate.trim();
  };

  if (raw.schemaVersion !== WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION) {
    issues.push({ path: 'schemaVersion', message: 'Versão de entrada inválida.' });
  }

  const id = text('id', 80) || '';
  const workspaceId = text('workspaceId', 120) || '';
  const ug = text('ug', 6) || '';
  const invoiceRecordKey = text('invoiceRecordKey', 180) || '';
  const invoiceId = text('invoiceId', 120) || '';
  const empenhoId = text('empenhoId', 120) || '';
  const itemId = text('itemId', 120) || '';
  const materialId = text('materialId', 80) || '';
  const description = text('description', 240) || '';
  const unitLabel = text('unitLabel', 80) || '';
  const quantity = typeof raw.quantity === 'number' && Number.isFinite(raw.quantity) ? raw.quantity : NaN;
  const mode = raw.mode;
  const siscofisStatus = raw.siscofisStatus;
  const position = (raw.position ?? null) as WarehouseStockPosition | null;
  const lotId = text('lotId', 80, true);
  const lotCode = text('lotCode', 80, true);
  const expiresOn = text('expiresOn', 10, true);
  const barcode = text('barcode', 128, true);
  const entryMovementId = text('entryMovementId', 80, true);
  const transferMovementId = text('transferMovementId', 80, true);
  const createdBy = text('createdBy', 180) || '';
  const updatedBy = text('updatedBy', 180) || '';

  if (!isWarehouseItemIntakeId(id)) issues.push({ path: 'id', message: 'ID de entrada inválido.' });
  if (options.expectedWorkspaceId && workspaceId !== options.expectedWorkspaceId) issues.push({ path: 'workspaceId', message: 'Workspace divergente.' });
  if (options.expectedUg && ug !== options.expectedUg) issues.push({ path: 'ug', message: 'UG divergente.' });
  if (!/^\d{6}$/.test(ug)) issues.push({ path: 'ug', message: 'UG inválida.' });
  if (!/^mat_[a-f0-9]{32}$/.test(materialId)) issues.push({ path: 'materialId', message: 'Material inválido.' });
  if (!(quantity > 0 && quantity <= 1_000_000_000)) issues.push({ path: 'quantity', message: 'Quantidade inválida.' });
  if (mode !== 'ALLOCATED' && mode !== 'IMMEDIATE_CONSUMPTION') issues.push({ path: 'mode', message: 'Modo inválido.' });

  if (mode === 'ALLOCATED') {
    if (!position || position.kind === 'UNASSIGNED') issues.push({ path: 'position', message: 'Posição física obrigatória.' });
    if (!lotId || !/^lot_[a-f0-9]{32}$/.test(lotId)) issues.push({ path: 'lotId', message: 'Lote obrigatório.' });
    if (!lotCode) issues.push({ path: 'lotCode', message: 'Código do lote obrigatório.' });
    if (!entryMovementId || !/^mov_[a-f0-9]{64}$/.test(entryMovementId)) issues.push({ path: 'entryMovementId', message: 'Movimento de entrada obrigatório.' });
    if (!transferMovementId || !/^mov_[a-f0-9]{64}$/.test(transferMovementId)) issues.push({ path: 'transferMovementId', message: 'Movimento de localização obrigatório.' });
    if (siscofisStatus !== 'NOT_APPLICABLE') issues.push({ path: 'siscofisStatus', message: 'Estado SISCOFIS inválido para alocação.' });
  }

  if (mode === 'IMMEDIATE_CONSUMPTION') {
    if (position !== null || lotId !== null || lotCode !== null || expiresOn !== null || entryMovementId !== null || transferMovementId !== null) {
      issues.push({ path: 'mode', message: 'Consumo imediato não pode materializar estoque ou localização.' });
    }
    if (siscofisStatus !== 'PENDING' && siscofisStatus !== 'POSTED') {
      issues.push({ path: 'siscofisStatus', message: 'Estado SISCOFIS inválido.' });
    }
  }

  if (expiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) issues.push({ path: 'expiresOn', message: 'Validade inválida.' });

  if (issues.length) return { ok: false, issues };
  return {
    ok: true,
    data: {
      schemaVersion: WAREHOUSE_ITEM_INTAKE_SCHEMA_VERSION,
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
      quantity,
      mode: mode as WarehouseItemIntakeMode,
      position,
      lotId,
      lotCode,
      expiresOn,
      barcode,
      entryMovementId,
      transferMovementId,
      siscofisStatus: siscofisStatus as WarehouseItemIntakeSiscofisStatus,
      createdBy,
      updatedBy,
    },
    issues: [],
  };
}

export async function createWarehouseItemIntakeId(
  workspaceId: string,
  invoiceRecordKey: string,
  itemId: string
): Promise<string> {
  const payload = new TextEncoder().encode(
    [workspaceId.trim().toLowerCase(), 'ITEM_INTAKE', invoiceRecordKey.trim(), itemId.trim()].join('\n')
  );
  const digest = await crypto.subtle.digest('SHA-256', payload);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return 'intake_' + hex;
}
