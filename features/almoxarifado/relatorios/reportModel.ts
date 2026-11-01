import type { Empenho, Invoice } from '../../../lib/types';
import { buildSupplierReports } from '../../../lib/supplierReporting';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import type {
  WarehouseDepotListItem,
  WarehouseLocationListItem,
  WarehouseLocationBalanceListItem,
} from '../../../lib/warehouse/locationRepository';
import type { WarehouseLotListItem } from '../../../lib/warehouse/lotRepository';
import type { WarehouseMovementListItem } from '../../../lib/warehouse/ledgerRepository';

/**
 * W8: modelos de apresentação puros. A origem financeira DEVE ser o mesmo
 * snapshot operacional autenticado do portal (W9); não buscar dados globais.
 * Quantidades nunca são somadas entre unidades distintas nem com valores R$.
 */
export interface AlmoxFinancialSnapshot {
  workspaceId: string;
  empenhos: readonly Empenho[];
  invoices: readonly Invoice[];
  /** Somente o integrador pode declarar cobertura completa do período. */
  completeness: 'complete' | 'partial';
}

export interface AlmoxWarehouseSnapshot {
  workspaceId: string;
  materials: readonly WarehouseMaterial[];
  depots: readonly WarehouseDepotListItem[];
  locations: readonly WarehouseLocationListItem[];
  locationBalances: readonly WarehouseLocationBalanceListItem[];
  lots: readonly WarehouseLotListItem[];
  movements: readonly WarehouseMovementListItem[];
  /** Limites realmente aplicados à consulta (não indicam total na coleção). */
  limits: {
    materials: number;
    depots: number;
    locations: number;
    locationBalances: number;
    lots: number;
    movements: number;
  };
}

export function requireAlmoxReportScope(expectedWorkspaceId: string, actualWorkspaceId: string): void {
  if (!expectedWorkspaceId || !actualWorkspaceId || expectedWorkspaceId !== actualWorkspaceId) {
    throw new Error('ALMOX_REPORT_WORKSPACE_MISMATCH');
  }
}

export function buildAlmoxFinancialReport(expectedWorkspaceId: string, source: AlmoxFinancialSnapshot) {
  requireAlmoxReportScope(expectedWorkspaceId, source.workspaceId);
  const empenhos = [...source.empenhos];
  const knownIds = new Set(empenhos.map((e) => e.id));
  // Não apresentar uma NF desassociada como integrante do escopo financeiro atual.
  const invoices = source.invoices.filter((n) => knownIds.has(n.empenhoId));
  const byEmpenho = empenhos.map((empenho) => {
    const linkedInvoices = invoices.filter((n) => n.empenhoId === empenho.id);
    const committedValue = empenho.items.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
    const invoiceValue = linkedInvoices.reduce((total, invoice) => total + invoice.totalValue, 0);
    return {
      id: empenho.id,
      supplier: empenho.supplier,
      year: /^\d{4}/.test(empenho.date) ? empenho.date.slice(0, 4) : 'Não informado',
      itemCount: empenho.items.length,
      invoiceCount: linkedInvoices.length,
      committedValue,
      invoiceValue,
      /** Saldo financeiro do relatório legado (com piso zero); não é saldo físico. */
      balanceValue: Math.max(0, committedValue - invoiceValue),
    };
  }).sort((a, b) => b.id.localeCompare(a.id));

  const years = Array.from(new Set(byEmpenho.map((row) => row.year)))
    .sort((a, b) => b.localeCompare(a, 'pt-BR'));
  return {
    byEmpenho,
    suppliers: buildSupplierReports(empenhos, [...invoices]),
    years,
    committedValue: byEmpenho.reduce((sum, row) => sum + row.committedValue, 0),
    invoiceValue: byEmpenho.reduce((sum, row) => sum + row.invoiceValue, 0),
    balanceValue: byEmpenho.reduce((sum, row) => sum + row.balanceValue, 0),
    empenhoCount: empenhos.length,
    invoiceCount: invoices.length,
    unmatchedInvoiceCount: source.invoices.length - invoices.length,
    missingCnpjCount: empenhos.filter((e) => !e.supplierCnpj).length,
    complete: source.completeness === 'complete',
  };
}

export function buildAlmoxWarehouseReport(expectedWorkspaceId: string, source: AlmoxWarehouseSnapshot, today: string) {
  requireAlmoxReportScope(expectedWorkspaceId, source.workspaceId);
  const assertRows = (rows: readonly { workspaceId: string }[]) => {
    for (const row of rows) requireAlmoxReportScope(expectedWorkspaceId, row.workspaceId);
  };
  assertRows(source.materials);
  assertRows(source.depots.map((e) => e.depot));
  assertRows(source.locations.map((e) => e.location));
  assertRows(source.locationBalances.map((e) => e.balance));
  assertRows(source.lots.map((e) => e.lot));
  assertRows(source.movements.map((e) => e.movement));

  const activeMaterials = source.materials.filter((m) => m.status === 'active');
  const activeDepots = source.depots.filter((d) => d.depot.status === 'active');
  const activeLocations = source.locations.filter((l) => l.location.status === 'active');
  const materialsById = new Map(source.materials.map((m) => [m.id, m]));
  const depotsById = new Map(source.depots.map((d) => [d.depot.id, d.depot]));
  const locationsById = new Map(source.locations.map((l) => [l.location.id, l.location]));

  const positions = source.locationBalances
    .filter(({ balance }) => balance.quantity > 0)
    .map(({ balance }) => {
      const position = balance.position;
      const depot = position.kind === 'UNASSIGNED' ? null : depotsById.get(position.depotId);
      const location = position.kind === 'UNASSIGNED' ? null : locationsById.get(position.locationId);
      const subposition = position.kind === 'SUBPOSITION' ? locationsById.get(position.subpositionId) : null;
      const material = materialsById.get(balance.materialId);
      return {
        id: balance.id,
        materialId: balance.materialId,
        material: material?.description || balance.materialId,
        unit: material?.unit.label || material?.unit.code || 'unidade não identificada',
        quantity: balance.quantity,
        depot: depot?.name || (position.kind === 'UNASSIGNED' ? 'Sem depósito' : position.depotId),
        location: position.kind === 'UNASSIGNED'
          ? 'Sem local atribuído'
          : [location?.code || position.locationId, subposition?.code].filter(Boolean).join(' / '),
        unassigned: position.kind === 'UNASSIGNED',
      };
    })
    .sort((a, b) => a.material.localeCompare(b.material, 'pt-BR'));

  const expiring = source.lots
    .filter(({ lot }) => lot.status === 'active' && lot.quantity > 0 && Boolean(lot.expiresOn))
    .map(({ lot }) => ({
      id: lot.id,
      material: materialsById.get(lot.materialId)?.description || lot.materialId,
      expiresOn: lot.expiresOn as string,
      expired: (lot.expiresOn as string) < today,
    }))
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));

  const truncated = {
    materials: source.materials.length >= source.limits.materials,
    depots: source.depots.length >= source.limits.depots,
    locations: source.locations.length >= source.limits.locations,
    locationBalances: source.locationBalances.length >= source.limits.locationBalances,
    lots: source.lots.length >= source.limits.lots,
    movements: source.movements.length >= source.limits.movements,
  };

  return {
    materialCount: activeMaterials.length,
    depotCount: activeDepots.length,
    locationCount: activeLocations.length,
    positionCount: positions.length,
    unassignedPositionCount: positions.filter((p) => p.unassigned).length,
    movementCount: source.movements.length,
    expiredLotCount: expiring.filter((l) => l.expired).length,
    positions,
    expiring,
    movements: [...source.movements].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    truncated,
  };
}
