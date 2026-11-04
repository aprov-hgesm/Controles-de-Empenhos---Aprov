import type { Empenho, Invoice, CronogramaEmpenho } from '../../../lib/types';
import type { EmpenhoClassDefinition } from '../../../lib/empenhoClasses';

/**
 * Adapter setorial, sem novo modelo financeiro, coleções ou operações de estoque.
 * A autenticação real continua sob platformAccess, operationalPaths e Firestore Rules.
 */
export const ALMOX_DEFAULT_CLASS = 'FUNADOM';
const FOOD_ONLY_CLASSES = new Set(['QR', 'CALI', 'PASA']);

export interface AlmoxFinanceScope {
  status: string;
  accountType?: string;
  sectorType?: string;
  workspaceId?: string | null;
  canLoadOperationalData?: boolean;
  legacyDataMode?: boolean;
  legacySettingsMode?: boolean;
}
export interface FinancialOperationScope {
  workspaceId: string;
  legacyDataMode: boolean;
  legacySettingsMode: boolean;
}

export function assertAlmoxFinanceScope(
  verified: AlmoxFinanceScope,
  operational: FinancialOperationScope,
  sessionUid: string | null,
  expectedUid: string,
): void {
  if (!sessionUid || !expectedUid || sessionUid !== expectedUid
    || verified.status !== 'sector'
    || verified.accountType !== 'sector'
    || verified.sectorType !== 'almoxarifado'
    || !verified.canLoadOperationalData
    || !verified.workspaceId
    || verified.legacyDataMode || verified.legacySettingsMode
    || operational.legacyDataMode || operational.legacySettingsMode
    || operational.workspaceId !== verified.workspaceId
  ) {
    throw new Error('ALMOX_FINANCIAL_WORKSPACE_DENIED');
  }
}

export function isAlmoxFinanceClass(value: string | null | undefined): boolean {
  const normalized = (value || '').trim().toUpperCase();
  return normalized.length > 0 && !FOOD_ONLY_CLASSES.has(normalized);
}

/** A visualização não regrava classes históricas nem altera o catálogo da OM. */
export function getAlmoxFinanceClasses(classes: readonly EmpenhoClassDefinition[]): EmpenhoClassDefinition[] {
  const available = classes.filter((item) => isAlmoxFinanceClass(item.code))
    .map((item) => ({ ...item, requiresTermoRecebimento: false }));
  if (!available.some((item) => item.code === ALMOX_DEFAULT_CLASS)) {
    available.unshift({
      code: ALMOX_DEFAULT_CLASS,
      description: 'Administração da OM / Apoio Administrativo',
      requiresTermoRecebimento: false,
    });
  }
  return available;
}

export function getAlmoxDefaultClass(value?: string | null): string {
  return isAlmoxFinanceClass(value) ? String(value).trim().toUpperCase() : ALMOX_DEFAULT_CLASS;
}

export interface AlmoxFinancialLine {
  itemId: string;
  name: string;
  unit: string;
  committedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  remainingValue: number;
  scheduledQuantity: number;
}
export interface AlmoxFinancialOverview {
  empenhoId: string;
  supplier: string;
  supplierCnpj?: string;
  exerciseYear: number | null;
  totalCommitted: number;
  totalReceived: number;
  remainingValue: number;
  invoiceCount: number;
  invoiceTotal: number;
  remittanceCount: number;
  lines: AlmoxFinancialLine[];
}

const safe = (value: number): number => Number.isFinite(value) && value >= 0 ? value : 0;
const money = (value: number): number => Math.round(value * 100) / 100;

/** Projeção somente leitura: empenho.items.received é a fonte do saldo.
 * Não soma NFs ao recebido novamente (evita duplicidade de baixa).
 */
export function summarizeAlmoxFinancial(
  empenho: Empenho,
  invoices: readonly Invoice[],
  schedules: readonly CronogramaEmpenho[],
): AlmoxFinancialOverview {
  const schedule = schedules.find((row) => row.empenhoId === empenho.id);
  const uniqueInvoices = new Map<string, Invoice>();
  for (const invoice of invoices) {
    if (invoice.empenhoId !== empenho.id) continue;
    const recordKey = invoice.recordKey || `${invoice.empenhoId}:${invoice.id}:${invoice.supplierCnpj || ''}`;
    if (!uniqueInvoices.has(recordKey)) uniqueInvoices.set(recordKey, invoice);
  }
  const lines = empenho.items.map((item) => {
    const committedQuantity = safe(item.quantity);
    const receivedQuantity = Math.min(committedQuantity, safe(item.received));
    const remainingQuantity = Math.max(0, committedQuantity - receivedQuantity);
    const scheduledQuantity = (schedule?.colunasEntregas || []).reduce(
      (total, column) => total + safe(schedule?.distribuicao?.[item.id]?.[column.id] || 0), 0
    );
    return {
      itemId: item.id, name: item.name, unit: item.unit,
      committedQuantity, receivedQuantity, remainingQuantity,
      unitPrice: safe(item.unitPrice),
      remainingValue: money(remainingQuantity * safe(item.unitPrice)),
      scheduledQuantity,
    };
  });
  const exercise = /^([12]\d{3})NE/i.exec(empenho.id);
  return {
    empenhoId: empenho.id, supplier: empenho.supplier, supplierCnpj: empenho.supplierCnpj,
    exerciseYear: exercise ? Number(exercise[1]) : null,
    totalCommitted: money(lines.reduce((total, item) => total + item.committedQuantity * item.unitPrice, 0)),
    totalReceived: money(lines.reduce((total, item) => total + item.receivedQuantity * item.unitPrice, 0)),
    remainingValue: money(lines.reduce((total, item) => total + item.remainingValue, 0)),
    invoiceCount: uniqueInvoices.size,
    invoiceTotal: money(Array.from(uniqueInvoices.values()).reduce((total, invoice) => total + safe(invoice.totalValue), 0)),
    remittanceCount: schedule?.colunasEntregas.length || 0,
    lines,
  };
}

/** Validação auxiliar de planejamento, nunca cria recebimento ou retirada física. */
export function validateAlmoxRemittances(
  empenho: Empenho,
  schedule: CronogramaEmpenho,
): string[] {
  const errors: string[] = [];
  if (schedule.empenhoId !== empenho.id) errors.push('EMPENHO_MISMATCH');
  const ids = new Set<string>();
  for (const column of schedule.colunasEntregas) {
    if (!column.id || ids.has(column.id)) errors.push('DUPLICATE_REMESSA');
    ids.add(column.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(column.dataPrevista)) errors.push('INVALID_DATE');
  }
  for (const item of empenho.items) {
    const remaining = Math.max(0, safe(item.quantity) - safe(item.received));
    let planned = 0;
    for (const [columnId, value] of Object.entries(schedule.distribuicao?.[item.id] || {})) {
      if (!ids.has(columnId) || !Number.isFinite(value) || value < 0) errors.push('INVALID_ALLOCATION');
      planned += value;
    }
    if (planned > remaining + 1e-8) errors.push('EXCEEDS_REMAINING_BALANCE');
  }
  for (const itemId of Object.keys(schedule.distribuicao || {})) {
    if (!empenho.items.some((item) => item.id === itemId)) errors.push('UNKNOWN_ITEM');
  }
  return [...new Set(errors)];
}
