/**
 * EMPROVEX Almoxarifado — contrato compartilhado R1.
 * Propriedade W1. W2/W3/W4 apenas importam estas definições.
 * Nenhum tipo abaixo autoriza retirada, grava saldo ou altera o SISCOFIS.
 */
import type { WarehouseStockPosition } from '../warehouse/location';

export const ALMOX_REQUEST_SCHEMA_VERSION = 'almox_request_v1' as const;
export const ALMOX_PLAN_SCHEMA_VERSION = 'almox_separation_plan_v1' as const;
export const ALMOX_SHEET_SCHEMA_VERSION = 'almox_separation_sheet_v1' as const;

export type SourceFormatV1 = 'PDF' | 'TXT';
export type QuantityMeaningV1 = 'REQUESTED' | 'AUTHORIZED' | 'UNKNOWN';
export type MatchStatusV1 = 'UNRESOLVED' | 'CONFIRMED' | 'INVALID';
export type TypedIssueCodeV1 =
  | 'UNREADABLE_SOURCE'
  | 'UNSUPPORTED_LAYOUT'
  | 'MISSING_REQUEST_ID'
  | 'MISSING_REQUESTING_UNIT'
  | 'UNKNOWN_QUANTITY_MEANING'
  | 'INVALID_QUANTITY'
  | 'MATERIAL_UNRESOLVED'
  | 'UNIT_INCOMPATIBLE'
  | 'MULTIPLE_POSITIONS'
  | 'INSUFFICIENT_STOCK'
  | 'UNASSIGNED_STOCK'
  | 'STOCK_CHANGED'
  | 'DUPLICATE_REQUEST'
  | 'IDEMPOTENCY_CONFLICT'
  | 'CROSS_WORKSPACE_ACCESS'
  | 'INACTIVE_POSITION';
export interface TypedIssueV1 {
  code: TypedIssueCodeV1;
  severity: 'BLOCKING' | 'WARNING' | 'INFO';
  sourceRowId?: string;
  details?: string;
}
export interface RequestSourceV1 {
  system: 'SISCOFIS';
  format: SourceFormatV1;
  /** SHA-256 calculado sobre os bytes originais, não sobre conteúdo normalizado. */
  sha256: string;
  layoutId: string | null;
  originalFilename: string | null;
}
export interface RequestLineV1 {
  sourceRowId: string;
  sourceText: string;
  sourceItemCode: string | null;
  description: string;
  sourceQuantity: number | null;
  quantityMeaning: QuantityMeaningV1;
  sourceUnit: string | null;
  canonicalMaterialId: string | null;
  factorToBaseUnit: number | null;
  canonicalQuantity: number | null;
  matchStatus: MatchStatusV1;
}
export interface ImportedRequestV1 {
  schemaVersion: typeof ALMOX_REQUEST_SCHEMA_VERSION;
  requestId: string;
  /** Resolvido pelo servidor; nunca confiado somente ao arquivo ou formulário. */
  workspaceId: string;
  source: RequestSourceV1;
  externalRequestNumber: string | null;
  requestingUnit: string | null;
  referenceDate: string | null;
  officialStatus: string | null;
  revision: number;
  rows: RequestLineV1[];
  issues: TypedIssueV1[];
}
export interface MaterialCorrespondenceV1 {
  workspaceId: string;
  sourceItemCode: string;
  sourceUnit: string;
  materialId: string;
  factorToBaseUnit: number;
  revision: number;
  approvedByUid: string;
  approvedAt: string;
}
export interface PhysicalPositionV1 {
  /** UNASSIGNED não pode produzir alocação executável. */
  position: Exclude<WarehouseStockPosition, { kind: 'UNASSIGNED' }>;
  balanceRevision: number;
  availableBaseQuantity: number;
}
export interface SeparationAllocationV1 {
  allocationId: string;
  position: PhysicalPositionV1;
  plannedBaseQuantity: number;
  actualBaseQuantity: number | null;
}
export interface SeparationPlanLineV1 {
  sourceRowId: string;
  materialId: string;
  requestedBaseQuantity: number;
  plannedBaseQuantity: number;
  actualBaseQuantity: number | null;
  allocations: SeparationAllocationV1[];
  issues: TypedIssueV1[];
}
export type SeparationPlanStatusV1 =
  | 'DRAFT'
  | 'NEEDS_REVIEW'
  | 'PLANNED'
  | 'PARTIAL'
  | 'SEPARATING'
  | 'CHECKED'
  | 'CANCELLED';
export interface SeparationPlanV1 {
  schemaVersion: typeof ALMOX_PLAN_SCHEMA_VERSION;
  planId: string;
  requestId: string;
  revision: number;
  workspaceId: string;
  status: SeparationPlanStatusV1;
  rows: SeparationPlanLineV1[];
  stockSnapshotRevision: string | null;
  createdByUid: string;
  createdAt: string;
  issues: TypedIssueV1[];
}
/** Projeção imutável para impressão, NÃO prova de saída/baixa. */
export interface SeparationSheetV1 {
  schemaVersion: typeof ALMOX_SHEET_SCHEMA_VERSION;
  sheetId: string;
  workspaceId: string;
  requestId: string;
  planId: string;
  planRevision: number;
  organizationName: string;
  requestingUnit: string;
  externalRequestNumber: string | null;
  issuedAt: string;
  issuedByUid: string;
  plan: Readonly<SeparationPlanV1>;
  auxiliaryDocumentNotice: 'Documento auxiliar: NÃO substitui registro ou autorização no SISCOFIS.';
}
/** Contratos de W2/W3/W4 não podem executar movimentação. */
export interface SeparationPdfResultV1 {
  filename: string;
  mimeType: 'application/pdf';
  pageCount: number;
  sourceSheetId: string;
}
export interface AlmoxTypedFailureV1 {
  ok: false;
  issue: TypedIssueV1;
}
/**
 * Invariantes de implementação para W2/W3/W4:
 * - chave da importação = (workspaceId, source.sha256);
 * - revisão identificada por (workspaceId, externalRequestNumber, revision);
 * - mapping aprovado = (workspaceId, sourceItemCode, sourceUnit);
 * - alocação só em posições reais, ativas e com saldo; soma das parcelas = planejado;
 * - 0 <= planejado <= solicitado; parcial depende de aprovação explícita;
 * - quantityMeaning UNKNOWN nunca vira AUTHORIZED automaticamente;
 * - W5 é o único responsável pela baixa auxiliar, idempotência e revalidação server-side.
 */
