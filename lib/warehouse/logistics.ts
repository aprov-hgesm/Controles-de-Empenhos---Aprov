import type { CronogramaEmpenho, Empenho, Invoice } from '../types';
import type { WarehouseBalance, WarehouseMovement } from './movement';

export const WAREHOUSE_LOGISTICS_SETTINGS_SCHEMA_VERSION =
  'warehouse_logistics_alert_settings_v1' as const;
export const WAREHOUSE_DELIVERY_WARNING_DAYS = 7;

export type WarehouseDeliveryState =
  | 'NO_SCHEDULE'
  | 'SCHEDULE_FUTURE'
  | 'DUE_SOON'
  | 'PARTIALLY_RECEIVED'
  | 'SCHEDULE_FULFILLED'
  | 'OVERDUE'
  | 'CLOSED';

export interface WarehouseLogisticsSettings {
  schemaVersion: typeof WAREHOUSE_LOGISTICS_SETTINGS_SCHEMA_VERSION;
  workspaceId: string;
  ug: string;
  lowStockThreshold: number | null;
  updatedBy: string;
  updatedAt: string | null;
}

export interface WarehouseDeliveryScheduleEntry {
  id: string;
  title: string;
  date: string;
  quantity: number;
  observation: string | null;
}

export interface WarehouseDeliveryInvoiceSummary {
  recordKey: string;
  invoiceId: string;
  issueDate: string;
  registeredAt: string | null;
  quantity: number;
  projectedMaterialIds: string[];
}

export interface WarehouseDeliveryStockSummary {
  linkedMaterials: number;
  positiveBalances: number;
  zeroBalances: number;
  withoutBalance: number;
}

export interface WarehouseDeliveryProjection {
  empenhoId: string;
  supplier: string;
  status: WarehouseDeliveryState;
  hasSchedule: boolean;
  cronogramaId: string | null;
  committedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  progressPercent: number;
  scheduledQuantity: number;
  expectedThroughToday: number;
  overdueQuantity: number;
  nextDeliveryDate: string | null;
  daysUntilNextDelivery: number | null;
  nextDeliveries: WarehouseDeliveryScheduleEntry[];
  invoices: WarehouseDeliveryInvoiceSummary[];
  stock: WarehouseDeliveryStockSummary;
  localEntrega: string | null;
  horarioEntrega: string | null;
  observacoes: string | null;
}

function positive(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function utcDayMs(day: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const parsed = Date.parse(day + 'T00:00:00.000Z');
  return Number.isNaN(parsed) ? null : parsed;
}

export function warehouseIsoDay(today: Date = new Date()): string {
  return today.toISOString().slice(0, 10);
}

export function warehouseDaysUntil(date: string, today: Date = new Date()): number | null {
  const target = utcDayMs(date);
  const current = utcDayMs(warehouseIsoDay(today));
  if (target == null || current == null) return null;
  return Math.round((target - current) / 86_400_000);
}

function scheduleQuantity(cronograma: CronogramaEmpenho, itemId: string, columnId: string): number {
  return positive(cronograma.distribuicao?.[itemId]?.[columnId]);
}

function invoiceQuantity(invoice: Invoice): number {
  return Array.isArray(invoice.items)
    ? invoice.items.reduce((total, item) => total + positive(item.quantity), 0)
    : 0;
}

function invoiceMaterialIds(
  invoice: Invoice,
  movements: readonly WarehouseMovement[]
): string[] {
  const recordKey = invoice.recordKey || invoice.id;
  const ids = movements
    .filter((movement) => {
      const source = movement.source;
      return source?.kind === 'INVOICE'
        && (
          source.invoiceRecordKey === recordKey
          || source.invoiceId === invoice.id
        );
    })
    .map((movement) => movement.materialId);
  return Array.from(new Set(ids));
}

function empenhoMaterialIds(
  empenhoId: string,
  movements: readonly WarehouseMovement[]
): string[] {
  return Array.from(new Set(
    movements
      .filter((movement) =>
        movement.source?.kind === 'INVOICE'
        && movement.source.empenhoId === empenhoId
      )
      .map((movement) => movement.materialId)
  ));
}

export function buildWarehouseDeliveryProjection(
  empenho: Empenho,
  cronograma: CronogramaEmpenho | null,
  invoices: readonly Invoice[],
  balances: readonly WarehouseBalance[] = [],
  movements: readonly WarehouseMovement[] = [],
  today: Date = new Date()
): WarehouseDeliveryProjection {
  const currentDay = warehouseIsoDay(today);
  const empenhoItems = Array.isArray(empenho.items) ? empenho.items : [];
  const committedQuantity = empenhoItems.reduce((total, item) => total + positive(item.quantity), 0);
  const receivedQuantity = empenhoItems.reduce((total, item) => total + positive(item.received), 0);
  const remainingQuantity = Math.max(0, committedQuantity - receivedQuantity);
  const progressPercent = committedQuantity > 0
    ? Math.min(100, Math.max(0, (receivedQuantity / committedQuantity) * 100))
    : 0;

  const empenhoInvoices = invoices
    .filter((invoice) => invoice.empenhoId === empenho.id)
    .map((invoice) => ({
      recordKey: invoice.recordKey || invoice.id,
      invoiceId: invoice.id,
      issueDate: invoice.issueDate,
      registeredAt: invoice.registeredAt || null,
      quantity: invoiceQuantity(invoice),
      projectedMaterialIds: invoiceMaterialIds(invoice, movements),
    }))
    .sort((left, right) =>
      (right.registeredAt || right.issueDate || '').localeCompare(
        left.registeredAt || left.issueDate || ''
      )
    );

  const linkedMaterialIds = empenhoMaterialIds(empenho.id, movements);
  const balanceByMaterial = new Map(balances.map((balance) => [balance.materialId, balance]));
  const stock: WarehouseDeliveryStockSummary = {
    linkedMaterials: linkedMaterialIds.length,
    positiveBalances: linkedMaterialIds.filter(
      (materialId) => (balanceByMaterial.get(materialId)?.quantity || 0) > 0
    ).length,
    zeroBalances: linkedMaterialIds.filter(
      (materialId) => balanceByMaterial.get(materialId)?.quantity === 0
    ).length,
    withoutBalance: linkedMaterialIds.filter(
      (materialId) => !balanceByMaterial.has(materialId)
    ).length,
  };

  const base = {
    empenhoId: empenho.id,
    supplier: typeof empenho.supplier === 'string' && empenho.supplier.trim()
      ? empenho.supplier
      : 'Fornecedor não informado',
    committedQuantity,
    receivedQuantity,
    remainingQuantity,
    progressPercent,
    invoices: empenhoInvoices,
    stock,
  };

  if (!cronograma) {
    return {
      ...base,
      status: remainingQuantity <= 0 || empenho.status === 'Encerrado' ? 'CLOSED' : 'NO_SCHEDULE',
      hasSchedule: false,
      cronogramaId: null,
      scheduledQuantity: 0,
      expectedThroughToday: 0,
      overdueQuantity: 0,
      nextDeliveryDate: null,
      daysUntilNextDelivery: null,
      nextDeliveries: [],
      localEntrega: null,
      horarioEntrega: null,
      observacoes: null,
    };
  }

  const cronogramaColumns = Array.isArray(cronograma.colunasEntregas)
    ? cronograma.colunasEntregas
    : [];
  const columns = cronogramaColumns
    .map((column) => ({
      id: column.id,
      title: column.titulo,
      date: column.dataPrevista,
      observation: column.observacao || null,
      quantity: empenhoItems.reduce(
        (total, item) => total + scheduleQuantity(cronograma, item.id, column.id),
        0
      ),
    }))
    .filter((column) => utcDayMs(column.date) != null)
    .sort((left, right) => left.date.localeCompare(right.date));

  const scheduledQuantity = columns.reduce((total, column) => total + column.quantity, 0);
  const expectedThroughToday = columns
    .filter((column) => column.date <= currentDay)
    .reduce((total, column) => total + column.quantity, 0);

  // O atraso é calculado por item. Excesso de um item não mascara falta de outro
  // e nenhuma NF é artificialmente vinculada a uma remessa específica.
  const overdueQuantity = empenhoItems.reduce((total, item) => {
    const expectedForItem = cronogramaColumns
      .filter((column) => column.dataPrevista <= currentDay)
      .reduce(
        (subtotal, column) => subtotal + scheduleQuantity(cronograma, item.id, column.id),
        0
      );
    return total + Math.max(0, expectedForItem - positive(item.received));
  }, 0);

  const nextDeliveries = columns
    .filter((column) => column.date > currentDay && column.quantity > 0)
    .slice(0, 4);
  const nextDeliveryDate = nextDeliveries[0]?.date || null;
  const daysUntilNextDelivery = nextDeliveryDate
    ? warehouseDaysUntil(nextDeliveryDate, today)
    : null;

  let status: WarehouseDeliveryState;
  if (remainingQuantity <= 0 || empenho.status === 'Encerrado') status = 'SCHEDULE_FULFILLED';
  else if (overdueQuantity > 0) status = 'OVERDUE';
  else if (receivedQuantity > 0) status = 'PARTIALLY_RECEIVED';
  else if (
    daysUntilNextDelivery != null
    && daysUntilNextDelivery >= 0
    && daysUntilNextDelivery <= WAREHOUSE_DELIVERY_WARNING_DAYS
  ) status = 'DUE_SOON';
  else status = 'SCHEDULE_FUTURE';

  return {
    ...base,
    status,
    hasSchedule: true,
    cronogramaId: cronograma.id,
    scheduledQuantity,
    expectedThroughToday,
    overdueQuantity,
    nextDeliveryDate,
    daysUntilNextDelivery,
    nextDeliveries,
    localEntrega: cronograma.localEntrega || null,
    horarioEntrega: cronograma.horarioEntrega || null,
    observacoes: cronograma.observacoes || null,
  };
}

export function buildWarehouseDeliveryProjections(
  empenhos: readonly Empenho[],
  cronogramas: readonly CronogramaEmpenho[],
  invoices: readonly Invoice[],
  balances: readonly WarehouseBalance[] = [],
  movements: readonly WarehouseMovement[] = [],
  today: Date = new Date()
): WarehouseDeliveryProjection[] {
  const cronogramaByEmpenho = new Map(
    cronogramas.map((cronograma) => [cronograma.empenhoId, cronograma])
  );
  const rank: Record<WarehouseDeliveryState, number> = {
    OVERDUE: 0,
    DUE_SOON: 1,
    PARTIALLY_RECEIVED: 2,
    SCHEDULE_FUTURE: 3,
    NO_SCHEDULE: 4,
    SCHEDULE_FULFILLED: 5,
    CLOSED: 6,
  };

  return empenhos
    .map((empenho) =>
      buildWarehouseDeliveryProjection(
        empenho,
        cronogramaByEmpenho.get(empenho.id) || null,
        invoices,
        balances,
        movements,
        today
      )
    )
    .sort((left, right) => {
      const stateOrder = rank[left.status] - rank[right.status];
      if (stateOrder !== 0) return stateOrder;
      return (left.nextDeliveryDate || '9999-12-31').localeCompare(
        right.nextDeliveryDate || '9999-12-31'
      );
    });
}

export function warehouseDeliveryStateLabel(state: WarehouseDeliveryState): string {
  const labels: Record<WarehouseDeliveryState, string> = {
    NO_SCHEDULE: 'Sem cronograma',
    SCHEDULE_FUTURE: 'Programação futura',
    DUE_SOON: 'Entrega prevista para breve',
    PARTIALLY_RECEIVED: 'Entrega parcialmente atendida',
    SCHEDULE_FULFILLED: 'Cronograma atendido',
    OVERDUE: 'Previsão vencida com saldo não recebido',
    CLOSED: 'Empenho encerrado',
  };
  return labels[state];
}

export function validateWarehouseLogisticsSettings(
  input: WarehouseLogisticsSettings,
  expectedWorkspaceId?: string
): WarehouseLogisticsSettings {
  if (input.schemaVersion !== WAREHOUSE_LOGISTICS_SETTINGS_SCHEMA_VERSION) {
    throw new Error('WAREHOUSE_LOGISTICS_SETTINGS_INVALID_SCHEMA');
  }
  if (!input.workspaceId || (expectedWorkspaceId && input.workspaceId !== expectedWorkspaceId)) {
    throw new Error('WAREHOUSE_LOGISTICS_SETTINGS_INVALID_WORKSPACE');
  }
  if (!/^\d{6}$/.test(input.ug)) throw new Error('WAREHOUSE_LOGISTICS_SETTINGS_INVALID_UG');
  if (
    input.lowStockThreshold != null
    && (!Number.isFinite(input.lowStockThreshold) || input.lowStockThreshold <= 0 || input.lowStockThreshold > 1_000_000_000)
  ) {
    throw new Error('WAREHOUSE_LOGISTICS_SETTINGS_INVALID_LOW_STOCK');
  }
  if (!input.updatedBy) throw new Error('WAREHOUSE_LOGISTICS_SETTINGS_INVALID_ACTOR');
  return input;
}
