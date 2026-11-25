import type { CreditAllocation, calculateCreditBalance, creditAlerts } from './creditBalance';
import type { SagCreditCell } from './sagCreditText';
import type { SagHtmlCreditSequence } from './sagCreditHtml.mjs';

export type { CreditAllocation } from './creditBalance';
export type BudgetCell = SagCreditCell & { cellId?: string };
export type CreditSequence = Omit<SagHtmlCreditSequence, 'destination'> & {
  destination: (BudgetCell & { cellId: string })[];
};
export type CreditBalance = ReturnType<typeof calculateCreditBalance>;
export type CreditRole = 'gestor' | 'centro';
export interface CreditSessionMember {
  uid: string; email: string; ug: string; role: CreditRole; centerId: string | null;
}
export interface CreditRecord {
  id: string; number: string; fullNumber: string; issuingUg: string; beneficiaryUg: string;
  issueDate: string; description: string; deadline: string | null;
  operation: string; decentralization: string; sourceSystem: string;
  /** Total original do documento: null na projeção restrita ao centro. */
  documentTotalCents: number | null; totalCents: number; sequences: CreditSequence[];
  allocations: CreditAllocation[]; revision: number; createdAt: string; updatedAt: string;
  /** Generation is set only after an excluded record is registered again. */
  generation?: string;
}
export type BudgetDifference = { field: string; credit: string|null; commitment: string|null };
export interface CommitmentRecord {
  id: string; number: string; creditId: string; centerId: string; cellId: string;
  ug: string; issueDate: string; description: string; supplier: string; supplierCnpj: string;
  netCents: number; revision: number; createdAt: string; updatedAt: string;
  budgetDifferences?: BudgetDifference[];
  generation?: string;
}
export interface CostCenter { id: string; name: string; active: boolean }
export interface CreditCellBalance extends BudgetCell {
  cellId: string; originalCents: number; committedCents: number; availableCents: number;
}
export interface CreditDetail { credit: CreditRecord; balance: CreditBalance; cells: CreditCellBalance[] }
export interface FinanceCredit extends CreditRecord { balance: CreditBalance; cells: CreditCellBalance[] }
export interface FinanceAlert extends ReturnType<typeof creditAlerts> {
  creditId: string; number: string; overdrawn: boolean; overdrawnCenterIds: string[];
  overdrawnCellIds: string[];
}
export interface FinanceView {
  member: CreditSessionMember;
  totals: { creditCents: number; committedCents: number; availableCents: number;
    creditCount: number; commitmentCount: number; noCommitmentsCount: number; unallocatedCents: number };
  credits: FinanceCredit[]; commitments: CommitmentRecord[]; centers: CostCenter[];
  alerts: FinanceAlert[]; nextCursor?: string;
}
export interface FinanceFilters { year?: string | number; cursor?: string; limit?: string | number; sort?: string; center?: string; kind?: 'nc' }
export type CreditDraft = Omit<CreditRecord, 'id'|'allocations'|'revision'|'createdAt'|'updatedAt'|'sequences'|'documentTotalCents'> & {
  documentTotalCents: number;
  sequences: SagHtmlCreditSequence[];
};
export interface CommitmentDraft {
  number: string; ug: string; issueDate: string; description: string; supplier: string;
  supplierCnpj: string; netCents: number; nd: string; ptres: string; fonte: string;
  ugr: string; pi: string | null;
}
export interface CreateCreditInput {
  source: 'html' | 'manual'; draft: CreditDraft; allocations: CreditAllocation[];
  deadline?: string | null; description?: string; expectedRevision?: number;
}
export interface UpdateCreditInput {
  id: string; expectedRevision: number; allocations?: CreditAllocation[];
  deadline?: string | null; description?: string; acknowledgeDeficit?: boolean;
}
export interface CreateCommitmentInput {
  draft: CommitmentDraft; creditId: string; centerId: string; cellId: string;
  acknowledgeDeficit?: boolean; acknowledgeBudgetDifference?: boolean; expectedCreditRevision?: number;
}
export type MovementKind = 'reforco' | 'anulacao' | 'recolhimento' | 'correcao';
export interface MovementInput {
  entityType: 'nc' | 'ne'; entityId: string; kind: MovementKind; amountCents: number;
  reference: string; reason: string; expectedRevision: number; acknowledgeDeficit?: boolean;
  /** Necessário em NC com múltiplas células; ajuste não altera as linhas originais. */
  cellId?: string;
}
export interface MovementRecord extends MovementInput {
  id: string; creditId: string; cellId: string; deltaCents: number;
  authorUid: string; createdAt: string;
}
export interface DocumentRef {
  id: string; entityType: 'nc'|'ne'; entityId: string; filename: string; mimeType: string;
  sizeBytes: number; sha256: string; status: 'pending'|'ready'|'failed'; createdAt: string;
}
