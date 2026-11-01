/**
 * W5 R1-C — orchestration only. Never writes warehouse balances or official SISCOFIS.
 * A caller must supply an IAM-read, validated snapshot; no client mapping is trusted.
 */
import { createHash } from 'node:crypto';
import type { ImportedRequestV1, MaterialCorrespondenceV1, SeparationPlanV1, SeparationSheetV1, TypedIssueV1 } from './contracts';
import { ALMOX_SHEET_SCHEMA_VERSION } from './contracts';
import { parseSiscofisRequestTxt } from './siscofisRequestTxt';
import { parseSiscofisRequestPdf } from './siscofisRequestPdf';
import { planPhysicalSeparation, type PositionChoiceV1 } from './positionPlanner';
import type { WarehouseMaterial } from '../warehouse/material';
import type { WarehouseDepot, WarehouseLocation, WarehouseLocationBalance } from '../warehouse/location';

export const ALMOX_OUTBOUND_ENABLED = false as const;
const AUXILIARY_NOTICE = 'Documento auxiliar: NÃO substitui registro ou autorização no SISCOFIS.' as const;
export interface AlmoxAccessV1 { uid: string; workspaceId: string; ug: string; sectorType: string }
export interface AlmoxSnapshotV1 {
  materials: WarehouseMaterial[];
  depots: WarehouseDepot[];
  locations: WarehouseLocation[];
  balances: WarehouseLocationBalance[];
  correspondences: MaterialCorrespondenceV1[];
  previousImports: Pick<ImportedRequestV1, 'workspaceId' | 'externalRequestNumber' | 'source'>[];
}
export interface AlmoxPreviewInputV1 {
  access: AlmoxAccessV1;
  source: Uint8Array;
  format: 'TXT' | 'PDF';
  filename: string | null;
  snapshot: AlmoxSnapshotV1;
  choices?: Record<string, PositionChoiceV1>;
  organizationName: string;
}
export type AlmoxPreviewResultV1 =
  | { ok: false; issue: TypedIssueV1 }
  | { ok: true; request: ImportedRequestV1; plan: SeparationPlanV1; sheet: SeparationSheetV1 | null;
      depots: AlmoxSnapshotV1['depots']; locations: AlmoxSnapshotV1['locations'];
      availablePositions: { sourceRowId: string; position: WarehouseLocationBalance['position']; balanceRevision: number; quantity: number; depotCode: string; locationCode: string; subpositionCode: string | null }[];
      outboundEnabled: false };
export class AlmoxIntegrationError extends Error {
  constructor(public readonly code: string, public readonly status = 403) { super(code); }
}
export function requireAlmoxAccess(access: AlmoxAccessV1): void {
  if (!access || access.sectorType !== 'almoxarifado' || !access.uid || !access.workspaceId || !/^\d{6}$/.test(access.ug)) {
    throw new AlmoxIntegrationError('ALMOX_IDENTITY_DENIED', 403);
  }
}
export function checkAlmoxSnapshot(access: AlmoxAccessV1, snapshot: AlmoxSnapshotV1): void {
  requireAlmoxAccess(access);
  const scoped = [...snapshot.materials, ...snapshot.depots, ...snapshot.locations, ...snapshot.balances];
  if (scoped.some(item => item.workspaceId !== access.workspaceId || item.ug !== access.ug)
    || snapshot.correspondences.some(item => item.workspaceId !== access.workspaceId)
    || snapshot.previousImports.some(item => item.workspaceId !== access.workspaceId)) {
    throw new AlmoxIntegrationError('ALMOX_CROSS_WORKSPACE_SNAPSHOT', 403);
  }
  if (snapshot.materials.length > 500 || snapshot.balances.length > 500 ||
      snapshot.depots.length > 500 || snapshot.locations.length > 500 ||
      snapshot.correspondences.length >= 500 || snapshot.previousImports.length >= 500) {
    throw new AlmoxIntegrationError('ALMOX_SNAPSHOT_INCOMPLETE', 409);
  }
}
export async function previewAlmoxSyntheticRequest(input: AlmoxPreviewInputV1): Promise<AlmoxPreviewResultV1> {
  const { access, snapshot } = input;
  checkAlmoxSnapshot(access, snapshot);
  if (input.format !== 'PDF' && input.format !== 'TXT') {
    return { ok: false, issue: { code: 'UNSUPPORTED_LAYOUT', severity: 'BLOCKING' } };
  }
  const params = { bytes: input.source, workspaceId: access.workspaceId,
    originalFilename: input.filename, previousImports: snapshot.previousImports };
  const parsed = input.format === 'TXT' ? parseSiscofisRequestTxt(params) : await parseSiscofisRequestPdf(params);
  if (!parsed.ok) return parsed;
  const request = parsed.data;
  // No caller-provided CONFIRMED, material ID, stock quantity or workspace is used.
  const planId = 'almoxplan_' + createHash('sha256')
    .update(access.workspaceId + '\u0000' + request.requestId + '\u0000' + JSON.stringify(input.choices ?? {}))
    .digest('hex').slice(0,32);
  const { plan, matches } = planPhysicalSeparation({
    planId, requestId: request.requestId, workspaceId: access.workspaceId,
    createdByUid: access.uid, createdAt: new Date().toISOString(),
    lines: request.rows, materials: snapshot.materials, correspondences: snapshot.correspondences,
    depots: snapshot.depots, locations: snapshot.locations, balances: snapshot.balances,
    choices: input.choices,
  });
  // Resolved rows come solely from trusted W3 matching, never from the request body.
  const resolved = new Map(matches.map(item => [item.line.sourceRowId, item.line]));
  const readOnlyRequest: ImportedRequestV1 = { ...request,
    rows: request.rows.map(row => resolved.get(row.sourceRowId) ?? row) };
  const issuable = (plan.status === 'PLANNED' || plan.status === 'PARTIAL')
    && plan.rows.length === request.rows.length
    && plan.rows.every(row => row.allocations.length > 0 && row.plannedBaseQuantity > 0)
    && !plan.issues.some(issue => issue.severity === 'BLOCKING');
  const sheet: SeparationSheetV1 | null = issuable ? {
    schemaVersion: ALMOX_SHEET_SCHEMA_VERSION, sheetId: 'almoxsheet_' + planId.slice(10),
    workspaceId: access.workspaceId, requestId: request.requestId,
    planId, planRevision: plan.revision,
    organizationName: input.organizationName, requestingUnit: request.requestingUnit ?? 'Não informado',
    externalRequestNumber: request.externalRequestNumber,
    issuedAt: new Date().toISOString(), issuedByUid: access.uid, plan,
    auxiliaryDocumentNotice: AUXILIARY_NOTICE,
  } : null;
  const materialForRow = new Map(matches.filter(m => m.material).map(m => [m.line.sourceRowId, m.material!.id]));
  const availablePositions: Extract<AlmoxPreviewResultV1, {ok:true}>['availablePositions'] = [];
  for (const row of request.rows) {
    const materialId = materialForRow.get(row.sourceRowId);
    if (!materialId) continue;
    for (const b of snapshot.balances) {
      if (b.materialId !== materialId || b.quantity <= 0 || b.position.kind === 'UNASSIGNED') continue;
      const position = b.position;
      const d = snapshot.depots.find(d => d.id === position.depotId && d.status === 'active');
      const l = snapshot.locations.find(l => l.id === position.locationId && l.depotId === position.depotId
        && l.kind === 'LOCAL' && l.status === 'active');
      const sub = position.kind === 'SUBPOSITION' ? snapshot.locations.find(s =>
        s.id === position.subpositionId && s.parentLocationId === position.locationId
        && s.depotId === position.depotId && s.status === 'active' && s.kind === 'SUBPOSITION') : null;
      if (!d || !l || (b.position.kind === 'SUBPOSITION' && !sub)) continue;
      availablePositions.push({ sourceRowId: row.sourceRowId, position: b.position,
        balanceRevision: b.revision, quantity: b.quantity,
        depotCode: d.code, locationCode: l.code, subpositionCode: sub?.code ?? null });
    }
  }
  return {ok:true,request:readOnlyRequest,plan,sheet,depots:snapshot.depots,
    locations:snapshot.locations,availablePositions,outboundEnabled:false};
}
/** A confirmation request is always denied until an independently approved atomic ledger adapter exists. */
export function confirmAlmoxPhysicalWithdrawal(_input: unknown): never {
  throw new AlmoxIntegrationError('ALMOX_OUTBOUND_DISABLED_PENDING_OPERATIONAL_APPROVAL', 423);
}
