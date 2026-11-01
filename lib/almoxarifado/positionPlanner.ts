/** Pure, read-only physical separation planner; not a reservation or outbound command. */
import type {
  RequestLineV1, MaterialCorrespondenceV1, SeparationPlanV1, SeparationPlanLineV1,
  SeparationAllocationV1, TypedIssueV1, PhysicalPositionV1,
} from './contracts';
import { ALMOX_PLAN_SCHEMA_VERSION } from './contracts';
import { matchRequestMaterial, type MaterialMatchResult } from './materialMatch';
import type { WarehouseMaterial } from '../warehouse/material';
import {
  warehouseStockPositionKey, normalizeWarehouseLocationQuantity,
  type WarehouseDepot, type WarehouseLocation, type WarehouseLocationBalance,
  type WarehouseStockPosition,
} from '../warehouse/location';

type AssignedPosition = Exclude<WarehouseStockPosition, { kind: 'UNASSIGNED' }>;
export interface PositionChoiceV1 {
  /** Human-selected physical allocations, using the current balance revision. */
  allocations: readonly { position: AssignedPosition; balanceRevision: number; plannedBaseQuantity: number }[];
  /** Required for any planned quantity strictly below the requested quantity. */
  allowPartial: boolean;
}
export interface PositionPlannerInput {
  planId: string; requestId: string; revision?: number;
  workspaceId: string; createdByUid: string; createdAt: string;
  lines: readonly RequestLineV1[];
  materials: readonly WarehouseMaterial[];
  correspondences: readonly MaterialCorrespondenceV1[];
  depots: readonly WarehouseDepot[];
  locations: readonly WarehouseLocation[];
  balances: readonly WarehouseLocationBalance[];
  choices?: Readonly<Record<string, PositionChoiceV1>>;
  stockSnapshotRevision?: string | null;
}
export interface PositionPlannerResult {
  plan: SeparationPlanV1;
  matches: MaterialMatchResult[];
}
const q = (value: number): number | null => normalizeWarehouseLocationQuantity(value);
const issue = (code: TypedIssueV1['code'], sourceRowId: string, details: string,
  severity: TypedIssueV1['severity'] = 'BLOCKING'): TypedIssueV1 =>
  ({ code, sourceRowId, details, severity });
const byPosition = (a: WarehouseLocationBalance, b: WarehouseLocationBalance) =>
  warehouseStockPositionKey(a.position).localeCompare(warehouseStockPositionKey(b.position), 'pt-BR', { numeric: true });

/** Rejects orphan, inactive or foreign-scope positions, including inactive subpositions. */
function realPosition(balance: WarehouseLocationBalance, workspaceId: string,
  depots: readonly WarehouseDepot[], locations: readonly WarehouseLocation[]): balance is WarehouseLocationBalance & { position: AssignedPosition } {
  if (balance.workspaceId !== workspaceId || balance.position.kind === 'UNASSIGNED') return false;
  const p = balance.position;
  const depot = depots.find(d => d.id === p.depotId && d.workspaceId === workspaceId
    && d.ug === balance.ug && d.status === 'active');
  const local = locations.find(l => l.id === p.locationId && l.workspaceId === workspaceId
    && l.ug === balance.ug && l.depotId === p.depotId && l.kind === 'LOCAL'
    && l.parentLocationId === null && l.status === 'active');
  if (!depot || !local) return false;
  if (p.kind === 'LOCATION') return true;
  return locations.some(l => l.id === p.subpositionId && l.workspaceId === workspaceId
    && l.ug === balance.ug && l.depotId === p.depotId && l.kind === 'SUBPOSITION'
    && l.parentLocationId === p.locationId && l.status === 'active');
}
function validQuantity(value: number): boolean { return q(value) !== null && value > 0; }
function freshBalance(balance: WarehouseLocationBalance): boolean {
  return Number.isSafeInteger(balance.revision) && balance.revision > 0 && q(balance.quantity) !== null && balance.quantity >= 0;
}
function clonedPosition(position: AssignedPosition): AssignedPosition {
  return position.kind === 'LOCATION' ? { ...position } : { ...position };
}
function physicalPosition(balance: WarehouseLocationBalance & { position: AssignedPosition }): PhysicalPositionV1 {
  return { position: clonedPosition(balance.position), balanceRevision: balance.revision,
    availableBaseQuantity: balance.quantity };
}

export function planPhysicalSeparation(input: PositionPlannerInput): PositionPlannerResult {
  const matches = input.lines.map(line => matchRequestMaterial({
    workspaceId: input.workspaceId, line, materials: input.materials, correspondences: input.correspondences,
  }));
  const plan: SeparationPlanV1 = {
    schemaVersion: ALMOX_PLAN_SCHEMA_VERSION, planId: input.planId, requestId: input.requestId,
    workspaceId: input.workspaceId, revision: input.revision ?? 1,
    createdByUid: input.createdByUid, createdAt: input.createdAt,
    stockSnapshotRevision: input.stockSnapshotRevision ?? null,
    status: 'NEEDS_REVIEW', rows: [], issues: [],
  };
  // All inventories must be scoped by a trusted server read. Never silently mix workspaces.
  const sources = [...input.materials, ...input.depots, ...input.locations, ...input.balances];
  if (!input.workspaceId || sources.some(item => item.workspaceId !== input.workspaceId)) {
    plan.issues.push(issue('CROSS_WORKSPACE_ACCESS', '', 'Dados de workspaces diferentes no snapshot.'));
    return { plan, matches: [] }; // no foreign material details in response
  }
  if (input.lines.length === 0 || input.lines.some(line => !line.sourceRowId) ||
    new Set(input.lines.map(line => line.sourceRowId)).size !== input.lines.length) {
    plan.issues.push(issue('MATERIAL_UNRESOLVED', '', 'Identificadores de linhas duplicados.'));
    return { plan, matches: [] };
  }
  // Local simulated availability prevents two request lines consuming the same quantity in one plan.
  const remaining = new Map<string, number>();
  let pending = false;
  let partial = false;
  for (const match of matches) {
    const row = match.line;
    if (!match.material || row.canonicalQuantity === null || !validQuantity(row.canonicalQuantity)) {
      plan.issues.push(...match.issues);
      pending = true;
      continue; // SeparationPlanLineV1 requires a genuine materialId; never invent one.
    }
    const candidates = input.balances.filter(b => b.materialId === match.material!.id);
    if (candidates.some(b => b.ug !== match.material!.ug)) {
      plan.issues.push(issue('STOCK_CHANGED', row.sourceRowId, 'UG do saldo diverge do material.'));
      pending = true;
      continue;
    }
    const unavailable = candidates.filter(b => b.position.kind === 'UNASSIGNED' && b.quantity > 0);
    const rejected = candidates.filter(b => b.position.kind !== 'UNASSIGNED' && (!freshBalance(b)
      || !realPosition(b, input.workspaceId, input.depots, input.locations)));
    const valid = candidates.filter((b): b is WarehouseLocationBalance & { position: AssignedPosition } =>
      freshBalance(b) && b.quantity > 0 && realPosition(b, input.workspaceId, input.depots, input.locations)).sort(byPosition);
    const keys = valid.map(b => warehouseStockPositionKey(b.position));
    const duplicated = keys.some((k, i) => keys.indexOf(k) !== i);
    const rowIssues: TypedIssueV1[] = [];
    const requested = row.canonicalQuantity;
    const planLine: SeparationPlanLineV1 = {
      sourceRowId: row.sourceRowId, materialId: match.material.id,
      requestedBaseQuantity: requested, plannedBaseQuantity: 0,
      actualBaseQuantity: null, allocations: [], issues: rowIssues,
    };
    plan.rows.push(planLine);
    if (duplicated || rejected.some(b => b.quantity > 0 && !freshBalance(b))) {
      rowIssues.push(issue('STOCK_CHANGED', row.sourceRowId, 'Saldo duplicado ou revisão/quantidade inválida no snapshot.'));
      pending = true;
      continue;
    }
    if (rejected.length) rowIssues.push(issue('INACTIVE_POSITION', row.sourceRowId, 'Existe saldo em posição física inativa ou inválida.', 'WARNING'));
    if (unavailable.length) rowIssues.push(issue('UNASSIGNED_STOCK', row.sourceRowId, 'Saldo não atribuído a posição física.', 'WARNING'));

    const effective = valid.map(b => ({ balance: b, available: remaining.get(match.material!.id + '/' + warehouseStockPositionKey(b.position)) ?? b.quantity }));
    const total = q(effective.reduce((sum, e) => sum + e.available, 0));
    if (total === null) {
      rowIssues.push(issue('STOCK_CHANGED', row.sourceRowId, 'Soma de saldos fora dos limites aceitos.'));
      pending = true; continue;
    }
    const shortage = total < requested;
    if (shortage) rowIssues.push(issue('INSUFFICIENT_STOCK', row.sourceRowId,
      `Disponível em posições ativas: ${total}; solicitado: ${requested}.`, 'WARNING'));
    const choice = input.choices && Object.prototype.hasOwnProperty.call(input.choices, row.sourceRowId)
      ? input.choices[row.sourceRowId] : undefined;
    if (!choice && (valid.length !== 1 || total < requested)) {
      if (valid.length > 1) rowIssues.push(issue('MULTIPLE_POSITIONS', row.sourceRowId, 'Seleção física humana obrigatória.'));
      else if (valid.length === 0 && unavailable.length) rowIssues.push(issue('UNASSIGNED_STOCK', row.sourceRowId, 'Material sem posição utilizável.'));
      else rowIssues.push(issue('INSUFFICIENT_STOCK', row.sourceRowId, 'Plano parcial requer aceite e seleção explícitos.'));
      pending = true;
      continue;
    }
    const selection = choice?.allocations ?? [{ position: valid[0].position, balanceRevision: valid[0].revision, plannedBaseQuantity: requested }];
    if (!Array.isArray(selection)) {
      rowIssues.push(issue('STOCK_CHANGED', row.sourceRowId, 'Alocações inválidas.'));
      pending = true; continue;
    }
    const used = new Set<string>();
    let sum = 0;
    const allocations: SeparationAllocationV1[] = [];
    let invalid = false;
    for (const part of selection) {
      if (!part || !part.position || !validQuantity(part.plannedBaseQuantity)) { invalid = true; break; }
      const posKey = warehouseStockPositionKey(part.position);
      const matchBalance = effective.find(e => warehouseStockPositionKey(e.balance.position) === posKey);
      if (used.has(posKey) || !matchBalance || matchBalance.balance.revision !== part.balanceRevision
        || part.plannedBaseQuantity > matchBalance.available) { invalid = true; break; }
      used.add(posKey);
      sum = q(sum + part.plannedBaseQuantity) ?? Number.NaN;
      if (!Number.isFinite(sum)) { invalid = true; break; }
      allocations.push({ allocationId: `${encodeURIComponent(row.sourceRowId)}::${posKey}`,
        position: physicalPosition(matchBalance.balance), plannedBaseQuantity: part.plannedBaseQuantity,
        actualBaseQuantity: null });
    }
    if (invalid || sum > requested || (sum < requested && !choice?.allowPartial)
      || (sum === requested && selection.length === 0)) {
      rowIssues.push(issue('STOCK_CHANGED', row.sourceRowId,
        'Parcelas, revisões, saldo ou confirmação de parcial inválidos.'));
      pending = true;
      continue;
    }
    if (sum < requested) {
      // A partial plan may be empty only if explicitly accepted; never suggest physical picks.
      partial = true;
      if (!rowIssues.some(e => e.code === 'INSUFFICIENT_STOCK')) {
        rowIssues.push(issue('INSUFFICIENT_STOCK', row.sourceRowId, 'Quantidade parcial aprovada explicitamente.', 'WARNING'));
      }
    }
    planLine.allocations = allocations;
    planLine.plannedBaseQuantity = sum;
    for (const part of allocations) {
      const k = match.material.id + '/' + warehouseStockPositionKey(part.position.position);
      const current = remaining.get(k) ?? part.position.availableBaseQuantity;
      remaining.set(k, q(current - part.plannedBaseQuantity) ?? 0);
    }
  }
  plan.issues.push(...plan.rows.flatMap(row => row.issues));
  plan.status = pending ? 'NEEDS_REVIEW' : partial ? 'PARTIAL' : 'PLANNED';
  return { plan, matches };
}

/** Preview-only revalidation; W5 must repeat under a server transaction before every debit. */
export function revalidatePhysicalSeparation(plan: SeparationPlanV1, input: Pick<PositionPlannerInput,
  'workspaceId' | 'depots' | 'locations' | 'balances'>): TypedIssueV1[] {
  const issues: TypedIssueV1[] = [];
  if (input.workspaceId !== plan.workspaceId ||
    [...input.depots, ...input.locations, ...input.balances].some(x => x.workspaceId !== plan.workspaceId)) {
    return [issue('CROSS_WORKSPACE_ACCESS', '', 'Snapshot pertence a outro workspace.')];
  }
  const consumed = new Map<string, number>();
  for (const row of plan.rows) {
    let sum = 0;
    for (const allocation of row.allocations) {
      const p = allocation.position;
      const k = row.materialId + '/' + warehouseStockPositionKey(p.position);
      const b = input.balances.filter(x => x.materialId === row.materialId &&
        warehouseStockPositionKey(x.position) === warehouseStockPositionKey(p.position));
      if (b.length !== 1 || !freshBalance(b[0]) || !realPosition(b[0], input.workspaceId, input.depots, input.locations)
        || b[0].revision !== p.balanceRevision || b[0].quantity !== p.availableBaseQuantity) {
        issues.push(issue('STOCK_CHANGED', row.sourceRowId, 'Revisão, quantidade ou posição diverge do plano.'));
        continue;
      }
      const used = q((consumed.get(k) ?? 0) + allocation.plannedBaseQuantity);
      if (used === null || !validQuantity(allocation.plannedBaseQuantity) || used > b[0].quantity) {
        issues.push(issue('INSUFFICIENT_STOCK', row.sourceRowId, 'Parcelas excedem saldo físico.'));
        continue;
      }
      consumed.set(k, used);
      sum = q(sum + allocation.plannedBaseQuantity) ?? Number.NaN;
    }
    if (q(sum) === null || sum !== row.plannedBaseQuantity || sum > row.requestedBaseQuantity) {
      issues.push(issue('STOCK_CHANGED', row.sourceRowId, 'Somatório de parcelas do plano inválido.'));
    }
  }
  return issues;
}
