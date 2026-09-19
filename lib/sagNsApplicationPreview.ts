import type {
  SagNsReconciliationItem,
  SagNsReconciliationResult,
} from './sagNsReconciliation';

export type SagNsApplicationDecision =
  | 'change'
  | 'unchanged'
  | 'ignored'
  | 'blocked';

export interface SagNsApplicationPreviewItem {
  decision: SagNsApplicationDecision;
  reconciliationStatus: SagNsReconciliationItem['status'];
  ns: string;
  nfNumberRaw: string | null;
  invoiceId: string | null;
  invoiceRecordKey: string | null;
  empenhoId: string | null;
  currentNs: string | null;
  proposedNs: string | null;
  summary: string;
  warnings: string[];
  blockers: string[];
}

export interface SagNsApplicationPreviewStats {
  total: number;
  changes: number;
  unchanged: number;
  ignored: number;
  blocked: number;
  warningItems: number;
}

export interface SagNsApplicationPreview {
  supplierCnpj: string;
  items: SagNsApplicationPreviewItem[];
  stats: SagNsApplicationPreviewStats;
  canAdvanceToPersistenceReview: boolean;
}

function decisionFor(item: SagNsReconciliationItem): SagNsApplicationDecision {
  switch (item.status) {
    case 'matched':
      return 'change';
    case 'already_registered':
      return 'unchanged';
    case 'not_found':
    case 'missing_nf_reference':
      return 'ignored';
    case 'conflict_existing_ns':
    case 'conflict_ns_reused':
    case 'ambiguous_invoice':
    case 'data_conflict':
      return 'blocked';
  }
}

function summaryFor(
  item: SagNsReconciliationItem,
  decision: SagNsApplicationDecision
): string {
  switch (decision) {
    case 'change':
      return 'A NF receberia a NS identificada no SAG.';
    case 'unchanged':
      return 'A mesma NS já está cadastrada na NF; nenhuma alteração seria necessária.';
    case 'ignored':
      if (item.status === 'missing_nf_reference') {
        return 'A NS permaneceria sem aplicação porque o SAG não informou uma NF explícita.';
      }
      return 'A NS permaneceria sem aplicação porque a NF não foi encontrada no CNPJ selecionado.';
    case 'blocked':
      switch (item.status) {
        case 'ambiguous_invoice':
          return 'A aplicação ficaria bloqueada porque existem múltiplas NFs candidatas.';
        case 'conflict_existing_ns':
          return 'A aplicação ficaria bloqueada porque a NF já possui outra NS.';
        case 'conflict_ns_reused':
          return 'A aplicação ficaria bloqueada porque a NS já está vinculada a outra NF.';
        case 'data_conflict':
          return 'A aplicação ficaria bloqueada por inconsistência de CNPJ nos dados cadastrados.';
        default:
          return 'A aplicação ficaria bloqueada até revisão humana.';
      }
  }
}

export function buildSagNsApplicationPreview(
  reconciliation: SagNsReconciliationResult
): SagNsApplicationPreview {
  const items = reconciliation.items.map<SagNsApplicationPreviewItem>((item) => {
    const decision = decisionFor(item);
    const warnings = item.issues
      .filter((issue) => issue.severity === 'warning')
      .map((issue) => issue.message);
    const blockers = item.issues
      .filter((issue) => issue.severity === 'blocker')
      .map((issue) => issue.message);

    return {
      decision,
      reconciliationStatus: item.status,
      ns: item.record.ns,
      nfNumberRaw: item.record.nf_number_raw,
      invoiceId: item.invoice?.invoiceId || null,
      invoiceRecordKey: item.invoice?.invoiceRecordKey || null,
      empenhoId: item.invoice?.empenhoId || null,
      currentNs: item.invoice?.currentNs || null,
      proposedNs: decision === 'change' ? item.record.ns : null,
      summary: summaryFor(item, decision),
      warnings,
      blockers,
    };
  });

  const stats: SagNsApplicationPreviewStats = {
    total: items.length,
    changes: items.filter((item) => item.decision === 'change').length,
    unchanged: items.filter((item) => item.decision === 'unchanged').length,
    ignored: items.filter((item) => item.decision === 'ignored').length,
    blocked: items.filter((item) => item.decision === 'blocked').length,
    warningItems: items.filter((item) => item.warnings.length > 0).length,
  };

  return {
    supplierCnpj: reconciliation.supplierCnpj,
    items,
    stats,
    canAdvanceToPersistenceReview: stats.blocked === 0 && stats.changes > 0,
  };
}
