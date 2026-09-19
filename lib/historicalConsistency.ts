import type { Empenho, Invoice } from './types';
import {
  buildInvoiceRecordKey,
  isValidSupplierCnpj,
  normalizeSupplierCnpj,
} from './invoiceIdentity';
import {
  buildLegacyNsLockDocumentId,
  buildNsIdentityKey,
  buildNsLockDocumentId,
  isValidNsNumber,
  isValidNsUg,
  normalizeNsNumber,
  normalizeNsUg,
  type NsLockDocument,
} from './nsIntegrity';

export type HistoricalConsistencySeverity = 'critical' | 'warning' | 'info';
export type HistoricalConsistencyRepairMode =
  | 'automatic'
  | 'manual_review'
  | 'diagnostic_only';

export type HistoricalConsistencyIssueCode =
  | 'empenho_invalid_cnpj'
  | 'invoice_missing_empenho'
  | 'invoice_missing_supplier_cnpj'
  | 'invoice_invalid_supplier_cnpj'
  | 'invoice_supplier_cnpj_mismatch'
  | 'invoice_record_key_missing'
  | 'invoice_record_key_mismatch'
  | 'invoice_record_key_noncanonical'
  | 'invoice_invalid_ns'
  | 'invoice_ug_without_ns'
  | 'invoice_ns_without_ug'
  | 'invoice_ns_wrong_workspace_ug'
  | 'duplicate_ns_identity'
  | 'canonical_lock_missing'
  | 'canonical_lock_conflict'
  | 'canonical_lock_metadata_mismatch'
  | 'legacy_lock_redundant'
  | 'legacy_lock_migration_available'
  | 'legacy_lock_missing'
  | 'orphan_ns_lock';

export type HistoricalConsistencyRepairKind =
  | 'backfill_invoice_supplier_cnpj'
  | 'backfill_invoice_record_key'
  | 'clear_orphan_ns_ug'
  | 'rebuild_canonical_lock'
  | 'refresh_canonical_lock'
  | 'migrate_legacy_lock'
  | 'delete_redundant_legacy_lock'
  | 'delete_orphan_lock';

export interface HistoricalInvoiceDocument {
  documentId: string;
  invoice: Invoice;
}

export interface HistoricalSettingsDocument {
  documentId: string;
  data: Record<string, unknown>;
}

export interface HistoricalConsistencySnapshot {
  workspaceId: string;
  workspaceUg: string | null;
  empenhos: Empenho[];
  invoices: HistoricalInvoiceDocument[];
  settings: HistoricalSettingsDocument[];
}

export interface HistoricalConsistencyIssue {
  id: string;
  code: HistoricalConsistencyIssueCode;
  severity: HistoricalConsistencySeverity;
  repairMode: HistoricalConsistencyRepairMode;
  repairKind?: HistoricalConsistencyRepairKind;
  entityType: 'empenho' | 'invoice' | 'ns_lock';
  entityId: string;
  summary: string;
  detail: string;
  evidence: Record<string, string | number | boolean | null | string[]>;
}

export interface HistoricalConsistencyReport {
  workspaceId: string;
  workspaceUg: string | null;
  generatedAt: string;
  totals: {
    issues: number;
    critical: number;
    warnings: number;
    automatic: number;
    manualReview: number;
    diagnosticOnly: number;
  };
  issues: HistoricalConsistencyIssue[];
}

function issueId(
  code: HistoricalConsistencyIssueCode,
  entityType: HistoricalConsistencyIssue['entityType'],
  entityId: string
): string {
  return `${code}:${entityType}:${encodeURIComponent(entityId)}`;
}

function createIssue(
  input: Omit<HistoricalConsistencyIssue, 'id'>
): HistoricalConsistencyIssue {
  return {
    ...input,
    id: issueId(input.code, input.entityType, input.entityId),
  };
}

function lockData(document: HistoricalSettingsDocument): Partial<NsLockDocument> | null {
  if (document.data.type !== 'sag-ns-lock') return null;
  return {
    ...(document.data as Partial<NsLockDocument>),
    id: document.documentId,
  };
}

function lockMatchesInvoice(
  lock: Partial<NsLockDocument>,
  document: HistoricalInvoiceDocument
): boolean {
  const invoice = document.invoice;
  return (
    lock.invoiceRecordKey === document.documentId
    && lock.invoiceId === invoice.id
    && lock.empenhoId === invoice.empenhoId
    && normalizeSupplierCnpj(lock.supplierCnpj) === normalizeSupplierCnpj(invoice.supplierCnpj)
    && normalizeNsNumber(lock.numeroNS) === normalizeNsNumber(invoice.numeroNS)
    && normalizeNsUg(lock.ug) === normalizeNsUg(invoice.nsUg)
  );
}

export function analyzeHistoricalConsistency(
  snapshot: HistoricalConsistencySnapshot
): HistoricalConsistencyReport {
  const issues: HistoricalConsistencyIssue[] = [];
  const workspaceUg = normalizeNsUg(snapshot.workspaceUg) || null;
  const empenhoById = new Map(snapshot.empenhos.map((item) => [item.id, item]));
  const invoiceByDocumentId = new Map(
    snapshot.invoices.map((document) => [document.documentId, document])
  );
  const locks = snapshot.settings
    .map((document) => ({ document, lock: lockData(document) }))
    .filter(
      (entry): entry is {
        document: HistoricalSettingsDocument;
        lock: Partial<NsLockDocument>;
      } => Boolean(entry.lock)
    );
  const lockById = new Map(locks.map((entry) => [entry.document.documentId, entry.lock]));

  for (const empenho of snapshot.empenhos) {
    const rawCnpj = String(empenho.supplierCnpj || '').trim();
    if (rawCnpj && !isValidSupplierCnpj(rawCnpj)) {
      issues.push(createIssue({
        code: 'empenho_invalid_cnpj',
        severity: 'critical',
        repairMode: 'manual_review',
        entityType: 'empenho',
        entityId: empenho.id,
        summary: 'CNPJ histórico do empenho é inválido.',
        detail: 'O EMPROVEX não substitui CNPJ histórico sem confirmação humana do fornecedor correto.',
        evidence: {
          supplierCnpj: rawCnpj,
        },
      }));
    }
  }

  const canonicalOwners = new Map<string, HistoricalInvoiceDocument[]>();
  for (const document of snapshot.invoices) {
    const ns = normalizeNsNumber(document.invoice.numeroNS);
    const ug = normalizeNsUg(document.invoice.nsUg);
    const identity = buildNsIdentityKey(ug, ns);
    if (!identity) continue;
    const owners = canonicalOwners.get(identity) || [];
    owners.push(document);
    canonicalOwners.set(identity, owners);
  }

  for (const [identity, owners] of canonicalOwners) {
    if (owners.length < 2) continue;
    for (const owner of owners) {
      issues.push(createIssue({
        code: 'duplicate_ns_identity',
        severity: 'critical',
        repairMode: 'manual_review',
        entityType: 'invoice',
        entityId: owner.documentId,
        summary: 'A mesma identidade UG + NS aparece em mais de uma NF.',
        detail: 'Duplicidade de NS exige conferência documental; nenhum proprietário é escolhido automaticamente.',
        evidence: {
          identity,
          owners: owners.map((item) => item.documentId),
        },
      }));
    }
  }

  for (const document of snapshot.invoices) {
    const invoice = document.invoice;
    const empenho = empenhoById.get(invoice.empenhoId);
    const rawInvoiceCnpj = String(invoice.supplierCnpj || '').trim();
    const invoiceCnpj = normalizeSupplierCnpj(invoice.supplierCnpj);
    const empenhoCnpj = normalizeSupplierCnpj(empenho?.supplierCnpj);
    const ns = normalizeNsNumber(invoice.numeroNS);
    const ug = normalizeNsUg(invoice.nsUg);

    if (!empenho) {
      issues.push(createIssue({
        code: 'invoice_missing_empenho',
        severity: 'critical',
        repairMode: 'manual_review',
        entityType: 'invoice',
        entityId: document.documentId,
        summary: 'NF aponta para empenho inexistente.',
        detail: 'É necessário identificar o empenho correto antes de qualquer reparo.',
        evidence: {
          invoiceId: invoice.id,
          empenhoId: invoice.empenhoId,
        },
      }));
    }

    if (rawInvoiceCnpj && !isValidSupplierCnpj(rawInvoiceCnpj)) {
      issues.push(createIssue({
        code: 'invoice_invalid_supplier_cnpj',
        severity: 'critical',
        repairMode: 'manual_review',
        entityType: 'invoice',
        entityId: document.documentId,
        summary: 'CNPJ histórico da NF é inválido.',
        detail: 'O valor existente não será substituído por inferência a partir do empenho; confirme o documento fiscal.',
        evidence: {
          invoiceSupplierCnpj: rawInvoiceCnpj,
          empenhoSupplierCnpj: empenhoCnpj || null,
          empenhoId: invoice.empenhoId,
        },
      }));
    } else if (!rawInvoiceCnpj && empenhoCnpj && isValidSupplierCnpj(empenhoCnpj)) {
      issues.push(createIssue({
        code: 'invoice_missing_supplier_cnpj',
        severity: ns ? 'warning' : 'info',
        repairMode: ns ? 'manual_review' : 'automatic',
        repairKind: ns ? undefined : 'backfill_invoice_supplier_cnpj',
        entityType: 'invoice',
        entityId: document.documentId,
        summary: 'NF histórica não possui CNPJ normalizado.',
        detail: ns
          ? 'A NF possui NS; o CNPJ deve ser saneado junto da integridade do lock.'
          : 'O CNPJ pode ser herdado com segurança do empenho vinculado.',
        evidence: {
          invoiceId: invoice.id,
          empenhoId: invoice.empenhoId,
          empenhoSupplierCnpj: empenhoCnpj,
        },
      }));
    } else if (
      invoiceCnpj
      && empenhoCnpj
      && invoiceCnpj !== empenhoCnpj
    ) {
      issues.push(createIssue({
        code: 'invoice_supplier_cnpj_mismatch',
        severity: 'critical',
        repairMode: 'manual_review',
        entityType: 'invoice',
        entityId: document.documentId,
        summary: 'CNPJ da NF diverge do CNPJ do empenho.',
        detail: 'A divergência pode representar vínculo histórico incorreto e não é alterada automaticamente.',
        evidence: {
          invoiceSupplierCnpj: invoiceCnpj,
          empenhoSupplierCnpj: empenhoCnpj,
          empenhoId: invoice.empenhoId,
        },
      }));
    }

    const expectedRecordKey = buildInvoiceRecordKey(
      invoiceCnpj || empenhoCnpj,
      invoice.id
    );
    const storedRecordKey = String(invoice.recordKey || '').trim();

    if (!storedRecordKey) {
      const safe = Boolean(!ns && expectedRecordKey && expectedRecordKey === document.documentId);
      issues.push(createIssue({
        code: 'invoice_record_key_missing',
        severity: safe ? 'info' : 'warning',
        repairMode: safe ? 'automatic' : 'manual_review',
        repairKind: safe ? 'backfill_invoice_record_key' : undefined,
        entityType: 'invoice',
        entityId: document.documentId,
        summary: 'NF histórica não possui recordKey persistida.',
        detail: safe
          ? 'O ID físico já coincide com a identidade canônica; somente o campo recordKey precisa ser preenchido.'
          : 'O ID físico não coincide com a identidade canônica e exige migração controlada.',
        evidence: {
          documentId: document.documentId,
          expectedRecordKey: expectedRecordKey || null,
        },
      }));
    } else if (storedRecordKey !== document.documentId) {
      issues.push(createIssue({
        code: 'invoice_record_key_mismatch',
        severity: 'critical',
        repairMode: 'manual_review',
        entityType: 'invoice',
        entityId: document.documentId,
        summary: 'recordKey da NF diverge do ID físico no Firestore.',
        detail: 'A identidade documental precisa ser migrada por fluxo controlado; nenhum documento é movido automaticamente.',
        evidence: {
          documentId: document.documentId,
          storedRecordKey,
          expectedRecordKey: expectedRecordKey || null,
        },
      }));
    } else if (expectedRecordKey && document.documentId !== expectedRecordKey) {
      issues.push(createIssue({
        code: 'invoice_record_key_noncanonical',
        severity: 'warning',
        repairMode: 'manual_review',
        entityType: 'invoice',
        entityId: document.documentId,
        summary: 'NF usa ID físico não canônico.',
        detail: 'O documento continua localizável, mas uma migração de identidade deve ser revisada antes de mover a NF.',
        evidence: {
          documentId: document.documentId,
          expectedRecordKey,
        },
      }));
    }

    if (invoice.numeroNS && !isValidNsNumber(ns)) {
      issues.push(createIssue({
        code: 'invoice_invalid_ns',
        severity: 'critical',
        repairMode: 'manual_review',
        entityType: 'invoice',
        entityId: document.documentId,
        summary: 'Número de NS histórico é inválido.',
        detail: 'O número deve ser conferido no documento oficial antes de qualquer alteração.',
        evidence: {
          numeroNS: String(invoice.numeroNS),
        },
      }));
      continue;
    }

    if (!ns && ug) {
      issues.push(createIssue({
        code: 'invoice_ug_without_ns',
        severity: 'warning',
        repairMode: 'automatic',
        repairKind: 'clear_orphan_ns_ug',
        entityType: 'invoice',
        entityId: document.documentId,
        summary: 'NF possui UG de NS sem possuir número de NS.',
        detail: 'A UG órfã pode ser removida sem inferir ou alterar qualquer documento oficial.',
        evidence: {
          nsUg: ug,
        },
      }));
      continue;
    }

    if (ns && !ug) {
      const legacyId = buildLegacyNsLockDocumentId(ns);
      const legacy = lockById.get(legacyId);
      issues.push(createIssue({
        code: legacy ? 'invoice_ns_without_ug' : 'legacy_lock_missing',
        severity: 'warning',
        repairMode: 'manual_review',
        entityType: 'invoice',
        entityId: document.documentId,
        summary: 'NS histórica não possui UG confiável.',
        detail: legacy
          ? 'Existe lock legado, mas ele não prova sozinho qual UG histórica deve ser atribuída.'
          : 'A UG não será inferida a partir da configuração atual do workspace.',
        evidence: {
          numeroNS: ns,
          legacyLockId: legacy ? legacyId : null,
        },
      }));
      continue;
    }

    if (!ns || !ug) continue;

    if (workspaceUg && ug !== workspaceUg) {
      issues.push(createIssue({
        code: 'invoice_ns_wrong_workspace_ug',
        severity: 'critical',
        repairMode: 'manual_review',
        entityType: 'invoice',
        entityId: document.documentId,
        summary: 'UG histórica da NS diverge da UG do workspace.',
        detail: 'A divergência pode ser legítima em histórico importado; exige conferência documental e não é sobrescrita.',
        evidence: {
          invoiceUg: ug,
          workspaceUg,
          numeroNS: ns,
        },
      }));
    }

    const identity = buildNsIdentityKey(ug, ns);
    const duplicateOwners = canonicalOwners.get(identity) || [];
    const canonicalId = buildNsLockDocumentId(ug, ns);
    const legacyId = buildLegacyNsLockDocumentId(ns);
    const canonicalLock = lockById.get(canonicalId);
    const legacyLock = lockById.get(legacyId);
    const canRepairLock = (
      duplicateOwners.length === 1
      && Boolean(empenho)
      && Boolean(invoiceCnpj)
      && Boolean(empenhoCnpj)
      && invoiceCnpj === empenhoCnpj
      && isValidSupplierCnpj(invoiceCnpj)
      && (!workspaceUg || ug === workspaceUg)
      && String(invoice.recordKey || '').trim() === document.documentId
    );

    if (!canonicalLock) {
      if (
        legacyLock
        && legacyLock.invoiceRecordKey === document.documentId
        && canRepairLock
      ) {
        issues.push(createIssue({
          code: 'legacy_lock_migration_available',
          severity: 'warning',
          repairMode: 'automatic',
          repairKind: 'migrate_legacy_lock',
          entityType: 'ns_lock',
          entityId: legacyId,
          summary: 'Lock legado pode ser migrado para a identidade UG + NS.',
          detail: 'A NF já possui UG canônica e o lock legado aponta para a mesma NF.',
          evidence: {
            invoiceRecordKey: document.documentId,
            legacyLockId: legacyId,
            canonicalLockId: canonicalId,
            identity,
          },
        }));
      } else {
        issues.push(createIssue({
          code: 'canonical_lock_missing',
          severity: 'critical',
          repairMode: canRepairLock ? 'automatic' : 'manual_review',
          repairKind: canRepairLock ? 'rebuild_canonical_lock' : undefined,
          entityType: 'invoice',
          entityId: document.documentId,
          summary: 'NF com NS canônica não possui lock canônico correspondente.',
          detail: canRepairLock
            ? 'A identidade é única e coerente; o lock pode ser reconstruído a partir da própria NF.'
            : 'Existem ambiguidades de identidade/CNPJ/UG que impedem reconstrução automática.',
          evidence: {
            canonicalLockId: canonicalId,
            identity,
          },
        }));
      }
    } else if (canonicalLock.invoiceRecordKey !== document.documentId) {
      issues.push(createIssue({
        code: 'canonical_lock_conflict',
        severity: 'critical',
        repairMode: 'manual_review',
        entityType: 'ns_lock',
        entityId: canonicalId,
        summary: 'Lock canônico aponta para outra NF.',
        detail: 'Conflito de propriedade de NS exige conferência documental.',
        evidence: {
          expectedInvoiceRecordKey: document.documentId,
          actualInvoiceRecordKey: String(canonicalLock.invoiceRecordKey || ''),
          identity,
        },
      }));
    } else if (!lockMatchesInvoice(canonicalLock, document)) {
      issues.push(createIssue({
        code: 'canonical_lock_metadata_mismatch',
        severity: 'warning',
        repairMode: canRepairLock ? 'automatic' : 'manual_review',
        repairKind: canRepairLock ? 'refresh_canonical_lock' : undefined,
        entityType: 'ns_lock',
        entityId: canonicalId,
        summary: 'Metadados do lock divergem da NF proprietária.',
        detail: canRepairLock
          ? 'A propriedade da NS é coerente; os metadados podem ser atualizados a partir da NF.'
          : 'A divergência possui elementos ambíguos e precisa de revisão.',
        evidence: {
          invoiceRecordKey: document.documentId,
          identity,
        },
      }));
    }

    if (
      legacyLock
      && legacyLock.invoiceRecordKey === document.documentId
      && canonicalLock
    ) {
      issues.push(createIssue({
        code: 'legacy_lock_redundant',
        severity: 'info',
        repairMode: 'automatic',
        repairKind: 'delete_redundant_legacy_lock',
        entityType: 'ns_lock',
        entityId: legacyId,
        summary: 'Lock legado redundante permanece ao lado do lock canônico.',
        detail: 'O lock legado pode ser removido porque a NF já possui lock canônico UG + NS.',
        evidence: {
          invoiceRecordKey: document.documentId,
          canonicalLockId: canonicalId,
          legacyLockId: legacyId,
        },
      }));
    }
  }

  for (const { document, lock } of locks) {
    const ownerKey = String(lock.invoiceRecordKey || '').trim();
    if (ownerKey && invoiceByDocumentId.has(ownerKey)) continue;

    issues.push(createIssue({
      code: 'orphan_ns_lock',
      severity: 'warning',
      repairMode: ownerKey ? 'automatic' : 'manual_review',
      repairKind: ownerKey ? 'delete_orphan_lock' : undefined,
      entityType: 'ns_lock',
      entityId: document.documentId,
      summary: 'Lock de NS não possui NF proprietária existente.',
      detail: 'O lock órfão pode ser removido após revalidação transacional de que a NF continua ausente.',
      evidence: {
        invoiceRecordKey: ownerKey || null,
        numeroNS: normalizeNsNumber(lock.numeroNS) || null,
        ug: normalizeNsUg(lock.ug) || null,
      },
    }));
  }

  const uniqueIssues = Array.from(new Map(issues.map((issue) => [issue.id, issue])).values())
    .sort((left, right) => {
      const severityRank = { critical: 0, warning: 1, info: 2 } as const;
      return severityRank[left.severity] - severityRank[right.severity]
        || left.code.localeCompare(right.code)
        || left.entityId.localeCompare(right.entityId);
    });

  return {
    workspaceId: snapshot.workspaceId,
    workspaceUg,
    generatedAt: new Date().toISOString(),
    totals: {
      issues: uniqueIssues.length,
      critical: uniqueIssues.filter((issue) => issue.severity === 'critical').length,
      warnings: uniqueIssues.filter((issue) => issue.severity === 'warning').length,
      automatic: uniqueIssues.filter((issue) => issue.repairMode === 'automatic').length,
      manualReview: uniqueIssues.filter((issue) => issue.repairMode === 'manual_review').length,
      diagnosticOnly: uniqueIssues.filter((issue) => issue.repairMode === 'diagnostic_only').length,
    },
    issues: uniqueIssues,
  };
}
