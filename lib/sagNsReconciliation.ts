import type { Empenho, Invoice } from './types';
import {
  getInvoiceRecordKey,
  isValidSupplierCnpj,
  normalizeInvoiceNumber,
  normalizeSupplierCnpj,
} from './invoiceIdentity';
import {
  normalizeSagNsNumber,
  type SagNsPayload,
  type SagNsRecord,
} from './sagNsContract';

export type SagNsReconciliationStatus =
  | 'matched'
  | 'already_registered'
  | 'conflict_existing_ns'
  | 'conflict_ns_reused'
  | 'ambiguous_invoice'
  | 'not_found'
  | 'missing_nf_reference'
  | 'data_conflict';

export type SagNsReconciliationIssueSeverity = 'warning' | 'blocker';

export interface SagNsInvoiceReference {
  invoiceId: string;
  invoiceRecordKey: string;
  empenhoId: string;
  issueDate: string;
  currentNs: string | null;
}

export interface SagNsReconciliationIssue {
  severity: SagNsReconciliationIssueSeverity;
  code: string;
  message: string;
}

export interface SagNsReconciliationItem {
  record: SagNsRecord;
  status: SagNsReconciliationStatus;
  invoice: SagNsInvoiceReference | null;
  candidates: SagNsInvoiceReference[];
  issues: SagNsReconciliationIssue[];
}

export interface SagNsReconciliationStats {
  total: number;
  matched: number;
  alreadyRegistered: number;
  conflicts: number;
  ambiguous: number;
  notFound: number;
  missingReference: number;
  readyToApply: number;
}

export interface SagNsReconciliationResult {
  supplierCnpj: string;
  items: SagNsReconciliationItem[];
  stats: SagNsReconciliationStats;
}

function toInvoiceReference(invoice: Invoice): SagNsInvoiceReference {
  const currentNs = normalizeSagNsNumber(invoice.numeroNS);
  return {
    invoiceId: invoice.id,
    invoiceRecordKey: getInvoiceRecordKey(invoice),
    empenhoId: invoice.empenhoId,
    issueDate: invoice.issueDate,
    currentNs: currentNs || null,
  };
}

function issue(
  severity: SagNsReconciliationIssueSeverity,
  code: string,
  message: string
): SagNsReconciliationIssue {
  return { severity, code, message };
}

function countStats(items: SagNsReconciliationItem[]): SagNsReconciliationStats {
  const conflicts = items.filter((item) =>
    ['conflict_existing_ns', 'conflict_ns_reused', 'data_conflict'].includes(item.status)
  ).length;

  return {
    total: items.length,
    matched: items.filter((item) => item.status === 'matched').length,
    alreadyRegistered: items.filter((item) => item.status === 'already_registered').length,
    conflicts,
    ambiguous: items.filter((item) => item.status === 'ambiguous_invoice').length,
    notFound: items.filter((item) => item.status === 'not_found').length,
    missingReference: items.filter((item) => item.status === 'missing_nf_reference').length,
    readyToApply: items.filter((item) => item.status === 'matched').length,
  };
}

/**
 * Concilia registros SAG somente por identidade determinística de NF dentro do CNPJ selecionado.
 *
 * Regras:
 * - O universo é delimitado pelos empenhos cujo supplierCnpj coincide com o CNPJ selecionado.
 * - A única chave automática de ligação é o número normalizado da NF.
 * - A data da NF nunca decide o vínculo; divergências viram alerta.
 * - Mais de uma NF com o mesmo número permanece ambígua.
 * - Nenhuma alteração é persistida por esta função.
 */
export function reconcileSagNsPayload(
  payload: SagNsPayload,
  supplierCnpj: string,
  empenhos: Empenho[],
  invoices: Invoice[]
): SagNsReconciliationResult {
  const expectedCnpj = normalizeSupplierCnpj(supplierCnpj);
  const payloadCnpj = normalizeSupplierCnpj(payload.supplier_cnpj);

  if (!expectedCnpj || !isValidSupplierCnpj(expectedCnpj)) {
    throw new Error('CNPJ selecionado inválido para conciliação SAG. Confira formato e dígitos verificadores.');
  }

  if (!payloadCnpj || !isValidSupplierCnpj(payloadCnpj) || payloadCnpj !== expectedCnpj) {
    throw new Error('O CNPJ do payload SAG não corresponde ao fornecedor selecionado.');
  }

  const selectedEmpenhoIds = new Set(
    empenhos
      .filter((empenho) => normalizeSupplierCnpj(empenho.supplierCnpj) === expectedCnpj)
      .map((empenho) => empenho.id)
  );

  const scopedInvoices = invoices.filter((invoice) => selectedEmpenhoIds.has(invoice.empenhoId));
  const eligibleByNumber = new Map<string, Invoice[]>();
  const mismatchedByNumber = new Map<string, Invoice[]>();
  const invoicesByNs = new Map<string, Invoice[]>();

  for (const invoice of scopedInvoices) {
    const invoiceNumber = normalizeInvoiceNumber(invoice.id);
    if (!invoiceNumber) continue;

    const invoiceCnpj = normalizeSupplierCnpj(invoice.supplierCnpj);
    const hasConflictingCnpj = Boolean(invoiceCnpj && invoiceCnpj !== expectedCnpj);
    const targetMap = hasConflictingCnpj ? mismatchedByNumber : eligibleByNumber;
    const current = targetMap.get(invoiceNumber) || [];
    current.push(invoice);
    targetMap.set(invoiceNumber, current);

    if (!hasConflictingCnpj) {
      const normalizedNs = normalizeSagNsNumber(invoice.numeroNS);
      if (normalizedNs) {
        const nsInvoices = invoicesByNs.get(normalizedNs) || [];
        nsInvoices.push(invoice);
        invoicesByNs.set(normalizedNs, nsInvoices);
      }
    }
  }

  const items = payload.records.map<SagNsReconciliationItem>((record) => {
    const issues: SagNsReconciliationIssue[] = [];

    if (!record.nf_number_raw) {
      return {
        record,
        status: 'missing_nf_reference',
        invoice: null,
        candidates: [],
        issues: [
          issue(
            'warning',
            'missing_nf_reference',
            'A NS não possui número de NF explicitamente informado no relatório SAG.'
          ),
        ],
      };
    }

    const normalizedNf = normalizeInvoiceNumber(record.nf_number_raw);
    const candidates = eligibleByNumber.get(normalizedNf) || [];
    const mismatchedCandidates = mismatchedByNumber.get(normalizedNf) || [];

    if (candidates.length === 0 && mismatchedCandidates.length > 0) {
      return {
        record,
        status: 'data_conflict',
        invoice: null,
        candidates: mismatchedCandidates.map(toInvoiceReference),
        issues: [
          issue(
            'blocker',
            'invoice_supplier_cnpj_conflict',
            'Existe NF com este número ligada a um empenho do fornecedor, mas a própria NF possui CNPJ divergente. A inconsistência deve ser corrigida antes da conciliação.'
          ),
        ],
      };
    }

    if (candidates.length === 0) {
      return {
        record,
        status: 'not_found',
        invoice: null,
        candidates: [],
        issues: [
          issue(
            'warning',
            'invoice_not_found',
            'Nenhuma NF cadastrada para este CNPJ possui o mesmo número normalizado.'
          ),
        ],
      };
    }

    if (candidates.length > 1) {
      return {
        record,
        status: 'ambiguous_invoice',
        invoice: null,
        candidates: candidates.map(toInvoiceReference),
        issues: [
          issue(
            'blocker',
            'ambiguous_invoice_number',
            'Mais de uma NF do mesmo CNPJ possui este número normalizado. O EMPROVEX não escolherá por data nem por proximidade.'
          ),
        ],
      };
    }

    const target = candidates[0];
    const targetRef = toInvoiceReference(target);

    if (record.nf_issue_date && target.issueDate && record.nf_issue_date !== target.issueDate) {
      issues.push(
        issue(
          'warning',
          'nf_issue_date_mismatch',
          'O número da NF coincide, mas a data da NF no SAG diverge da data cadastrada no EMPROVEX. A data não foi usada para decidir o vínculo.'
        )
      );
    }

    const targetNs = normalizeSagNsNumber(target.numeroNS);
    if (targetNs) {
      if (targetNs === record.ns) {
        return {
          record,
          status: 'already_registered',
          invoice: targetRef,
          candidates: [targetRef],
          issues,
        };
      }

      return {
        record,
        status: 'conflict_existing_ns',
        invoice: targetRef,
        candidates: [targetRef],
        issues: [
          ...issues,
          issue(
            'blocker',
            'invoice_has_different_ns',
            `A NF já possui a NS ${targetNs}, diferente da NS ${record.ns} recebida do SAG.`
          ),
        ],
      };
    }

    const sameNsElsewhere = (invoicesByNs.get(record.ns) || []).filter(
      (invoice) => getInvoiceRecordKey(invoice) !== getInvoiceRecordKey(target)
    );

    if (sameNsElsewhere.length > 0) {
      return {
        record,
        status: 'conflict_ns_reused',
        invoice: targetRef,
        candidates: [targetRef, ...sameNsElsewhere.map(toInvoiceReference)],
        issues: [
          ...issues,
          issue(
            'blocker',
            'ns_already_used_by_other_invoice',
            'A mesma NS já está cadastrada em outra NF deste fornecedor. Nenhuma alteração deve ser aplicada automaticamente.'
          ),
        ],
      };
    }

    return {
      record,
      status: 'matched',
      invoice: targetRef,
      candidates: [targetRef],
      issues,
    };
  });

  return {
    supplierCnpj: expectedCnpj,
    items,
    stats: countStats(items),
  };
}
