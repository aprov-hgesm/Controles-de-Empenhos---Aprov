import type { Empenho, Invoice, InvoiceItem, Item } from '../types';
import {
  createWarehouseMaterial,
  type WarehouseMaterial,
  type WarehouseMaterialUnit,
} from './material';

export const WAREHOUSE_INVOICE_LINK_SCHEMA_VERSION = 'warehouse_invoice_link_v1' as const;
export const WAREHOUSE_INVOICE_SETTINGS_SCHEMA_VERSION = 'warehouse_invoice_settings_v1' as const;

export type WarehouseInvoiceMovementAction = 'ENTRY' | 'CORRECTION' | 'DELETE';

export interface WarehouseInvoiceIntegrationLink {
  schemaVersion: typeof WAREHOUSE_INVOICE_LINK_SCHEMA_VERSION;
  status: 'integrated';
  workspaceId: string;
  cutoffAt: string;
  revision: number;
  lastMovementIds: string[];
}

export interface WarehouseInvoiceIntegrationSettings {
  schemaVersion: typeof WAREHOUSE_INVOICE_SETTINGS_SCHEMA_VERSION;
  workspaceId: string;
  ug: string;
  cutoffAt: string;
  activatedBy: string;
}

export interface WarehouseInvoiceMovementPlan {
  materialId: string;
  itemIds: string[];
  oldQuantity: number;
  newQuantity: number;
  quantityDelta: number;
  action: WarehouseInvoiceMovementAction;
  movementType: 'INVOICE_ENTRY' | 'INVOICE_CORRECTION';
}

function normalizeUnitLookup(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function warehouseUnitFromOperationalLabel(value: string): WarehouseMaterialUnit {
  const original = value.trim().replace(/\s+/g, ' ');
  const key = normalizeUnitLookup(value).replace(/[.]/g, '');

  if (['un', 'und', 'unid', 'unidade', 'unidades'].includes(key)) {
    return { code: 'unit', label: null };
  }
  if (['kg', 'quilo', 'quilos', 'quilograma', 'quilogramas'].includes(key)) {
    return { code: 'kg', label: null };
  }
  if (['g', 'gr', 'grama', 'gramas'].includes(key)) {
    return { code: 'g', label: null };
  }
  if (['l', 'lt', 'litro', 'litros'].includes(key)) {
    return { code: 'l', label: null };
  }
  if (['ml', 'mililitro', 'mililitros'].includes(key)) {
    return { code: 'ml', label: null };
  }
  if (['pct', 'pc', 'pac', 'pacote', 'pacotes'].includes(key)) {
    return { code: 'package', label: null };
  }
  if (['cx', 'caixa', 'caixas'].includes(key)) {
    return { code: 'box', label: null };
  }
  if (['fd', 'fardo', 'fardos'].includes(key)) {
    return { code: 'bundle', label: null };
  }

  return {
    code: 'other',
    label: original || 'Apresentação não informada',
  };
}

export async function deriveWarehouseMaterialIdForEmpenhoItem(
  workspaceId: string,
  empenhoId: string,
  itemId: string
): Promise<string> {
  const payload = new TextEncoder().encode(
    [workspaceId.trim().toLowerCase(), 'EMPENHO_ITEM', empenhoId.trim(), itemId.trim()].join('\n')
  );
  const digest = await crypto.subtle.digest('SHA-256', payload);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return 'mat_' + hex.slice(0, 32);
}

export function createWarehouseMaterialFromEmpenhoItem(input: {
  workspaceId: string;
  ug: string;
  materialId: string;
  item: Item;
}): WarehouseMaterial {
  const created = createWarehouseMaterial({
    id: input.materialId,
    workspaceId: input.workspaceId,
    ug: input.ug,
    description: input.item.name,
    aliases: [],
    unit: warehouseUnitFromOperationalLabel(input.item.unit),
    status: 'active',
    conversions: [],
  });

  if (!created.ok) {
    throw new Error(
      'WAREHOUSE_INVOICE_INVALID_MATERIAL: ' +
      created.issues.map((issue) => issue.path + ': ' + issue.message).join('; ')
    );
  }

  return created.data;
}

function aggregateInvoiceItems(items: InvoiceItem[]): Map<string, { quantity: number; itemIds: string[] }> {
  const result = new Map<string, { quantity: number; itemIds: string[] }>();

  for (const item of items) {
    const materialId = item.warehouseMaterialId?.trim().toLowerCase();
    if (!materialId || !(item.quantity > 0)) continue;

    const existing = result.get(materialId) || { quantity: 0, itemIds: [] };
    existing.quantity += item.quantity;
    if (!existing.itemIds.includes(item.itemId)) existing.itemIds.push(item.itemId);
    result.set(materialId, existing);
  }

  return result;
}

export function isWarehouseIntegratedInvoice(invoice: Invoice | null | undefined): boolean {
  return invoice?.warehouseIntegration?.schemaVersion === WAREHOUSE_INVOICE_LINK_SCHEMA_VERSION
    && invoice.warehouseIntegration.status === 'integrated';
}

export function isInvoiceOnOrAfterWarehouseCutoff(
  registeredAt: string | undefined,
  cutoffAt: string
): boolean {
  const registered = Date.parse(registeredAt || '');
  const cutoff = Date.parse(cutoffAt);
  return Number.isFinite(registered) && Number.isFinite(cutoff) && registered >= cutoff;
}

export function buildWarehouseInvoiceMovementPlans(
  previousInvoice: Invoice | null,
  nextInvoice: Invoice | null
): WarehouseInvoiceMovementPlan[] {
  const previousItems = previousInvoice && isWarehouseIntegratedInvoice(previousInvoice)
    ? aggregateInvoiceItems(previousInvoice.items)
    : new Map<string, { quantity: number; itemIds: string[] }>();
  const nextItems = nextInvoice
    ? aggregateInvoiceItems(nextInvoice.items)
    : new Map<string, { quantity: number; itemIds: string[] }>();

  const materialIds = new Set([...previousItems.keys(), ...nextItems.keys()]);
  const plans: WarehouseInvoiceMovementPlan[] = [];

  for (const materialId of materialIds) {
    const before = previousItems.get(materialId);
    const after = nextItems.get(materialId);
    const oldQuantity = before?.quantity || 0;
    const newQuantity = after?.quantity || 0;
    const quantityDelta = Number((newQuantity - oldQuantity).toFixed(6));
    if (quantityDelta === 0) continue;

    const itemIds = Array.from(new Set([...(before?.itemIds || []), ...(after?.itemIds || [])]));
    const action: WarehouseInvoiceMovementAction =
      oldQuantity === 0 ? 'ENTRY' : newQuantity === 0 ? 'DELETE' : 'CORRECTION';

    plans.push({
      materialId,
      itemIds,
      oldQuantity,
      newQuantity,
      quantityDelta,
      action,
      movementType: action === 'ENTRY' ? 'INVOICE_ENTRY' : 'INVOICE_CORRECTION',
    });
  }

  return plans.sort((left, right) => left.materialId.localeCompare(right.materialId));
}

export function buildWarehouseInvoiceIdempotencyKey(input: {
  invoiceRecordKey: string;
  integrationRevision: number;
  plan: WarehouseInvoiceMovementPlan;
}): string {
  return [
    'invoice',
    input.invoiceRecordKey,
    'warehouse',
    'r' + input.integrationRevision,
    input.plan.action,
    input.plan.materialId,
    String(input.plan.oldQuantity),
    String(input.plan.newQuantity),
  ].join(':').slice(0, 240);
}

export function attachWarehouseMaterialMappings(
  invoice: Invoice,
  materialByItemId: Map<string, string>
): Invoice {
  return {
    ...invoice,
    items: invoice.items.map((item) => ({
      ...item,
      warehouseMaterialId: materialByItemId.get(item.itemId) || item.warehouseMaterialId,
    })),
  };
}

export function attachWarehouseMaterialMappingsToEmpenho(
  empenho: Empenho,
  materialByItemId: Map<string, string>
): Empenho {
  return {
    ...empenho,
    items: empenho.items.map((item) => ({
      ...item,
      warehouseMaterialId: materialByItemId.get(item.id) || item.warehouseMaterialId,
    })),
  };
}
