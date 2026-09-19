import {
  collection,
  deleteField,
  getDocs,
  runTransaction,
} from 'firebase/firestore';

import { auth, db } from './firebase';
import {
  appendWorkspaceAuditEvent,
  createWorkspaceAuditCorrelationId,
} from './auditTrail';
import {
  analyzeHistoricalConsistency,
  type HistoricalConsistencyIssue,
  type HistoricalConsistencyReport,
} from './historicalConsistency';
import {
  buildInvoiceRecordKey,
  isValidSupplierCnpj,
  normalizeSupplierCnpj,
} from './invoiceIdentity';
import {
  buildLegacyNsLockDocumentId,
  buildNsLockDocument,
  buildNsLockDocumentId,
  isValidNsNumber,
  isValidNsUg,
  normalizeNsNumber,
  normalizeNsUg,
  type NsLockDocument,
} from './nsIntegrity';
import {
  getCurrentOperationalScope,
  getOperationalSettingsCollectionPath,
  operationalCollectionRef,
  operationalDocRef,
  operationalSettingsDocRef,
} from './operationalPaths';
import type { Empenho, Invoice } from './types';

export interface HistoricalRepairResult {
  issueId: string;
  repairKind: NonNullable<HistoricalConsistencyIssue['repairKind']>;
  repaired: boolean;
  message: string;
}

function currentUserOrThrow() {
  const user = auth.currentUser;
  if (!user?.uid || !user.email) {
    throw new Error('Faça login novamente antes de executar o diagnóstico histórico.');
  }
  return user;
}

export async function scanHistoricalConsistency(): Promise<HistoricalConsistencyReport> {
  const user = currentUserOrThrow();
  const scope = getCurrentOperationalScope(user.uid);

  const [empenhoSnapshot, invoiceSnapshot, settingsSnapshot] = await Promise.all([
    getDocs(operationalCollectionRef(scope, 'empenhos')),
    getDocs(operationalCollectionRef(scope, 'invoices')),
    getDocs(collection(db, getOperationalSettingsCollectionPath(scope))),
  ]);

  return analyzeHistoricalConsistency({
    workspaceId: scope.workspaceId,
    workspaceUg: scope.ug,
    empenhos: empenhoSnapshot.docs.map((snapshot) => snapshot.data() as Empenho),
    invoices: invoiceSnapshot.docs.map((snapshot) => ({
      documentId: snapshot.id,
      invoice: {
        ...(snapshot.data() as Invoice),
        recordKey: (snapshot.data() as Invoice).recordKey || undefined,
      },
    })),
    settings: settingsSnapshot.docs.map((snapshot) => ({
      documentId: snapshot.id,
      data: snapshot.data(),
    })),
  });
}

function assertAutomaticIssue(
  issue: HistoricalConsistencyIssue
): asserts issue is HistoricalConsistencyIssue & {
  repairMode: 'automatic';
  repairKind: NonNullable<HistoricalConsistencyIssue['repairKind']>;
} {
  if (issue.repairMode !== 'automatic' || !issue.repairKind) {
    throw new Error(
      'Esta inconsistência não possui reparo automático seguro. Revise o diagnóstico e os documentos oficiais.'
    );
  }
}

function auditEvidence(issue: HistoricalConsistencyIssue) {
  return {
    issueId: issue.id,
    issueCode: issue.code,
    repairKind: issue.repairKind || null,
    severity: issue.severity,
    originalEvidence: issue.evidence,
  };
}

export async function repairHistoricalConsistencyIssue(
  issue: HistoricalConsistencyIssue
): Promise<HistoricalRepairResult> {
  assertAutomaticIssue(issue);

  const user = currentUserOrThrow();
  const scope = getCurrentOperationalScope(user.uid);
  const correlationId = createWorkspaceAuditCorrelationId(scope);
  const now = new Date().toISOString();

  return runTransaction(db, async (transaction) => {
    if (issue.repairKind === 'backfill_invoice_supplier_cnpj') {
      const invoiceRef = operationalDocRef(scope, 'invoices', issue.entityId);
      const invoiceSnapshot = await transaction.get(invoiceRef);
      if (!invoiceSnapshot.exists()) {
        throw new Error('A NF não existe mais. Execute um novo diagnóstico.');
      }

      const invoice = invoiceSnapshot.data() as Invoice;
      if (normalizeNsNumber(invoice.numeroNS)) {
        throw new Error('A NF passou a possuir NS. O reparo automático de CNPJ foi bloqueado.');
      }

      const empenhoRef = operationalDocRef(scope, 'empenhos', invoice.empenhoId);
      const empenhoSnapshot = await transaction.get(empenhoRef);
      if (!empenhoSnapshot.exists()) {
        throw new Error('O empenho vinculado não existe mais.');
      }

      const empenho = empenhoSnapshot.data() as Empenho;
      const targetCnpj = normalizeSupplierCnpj(empenho.supplierCnpj);
      if (!targetCnpj || !isValidSupplierCnpj(targetCnpj)) {
        throw new Error('O empenho não possui CNPJ válido para preencher a NF.');
      }

      const currentCnpj = normalizeSupplierCnpj(invoice.supplierCnpj);
      if (currentCnpj) {
        if (currentCnpj === targetCnpj) {
          return {
            issueId: issue.id,
            repairKind: issue.repairKind,
            repaired: false,
            message: 'A NF já possui o CNPJ correto.',
          };
        }
        throw new Error('A NF passou a possuir outro CNPJ. O reparo foi interrompido.');
      }

      transaction.set(invoiceRef, {
        supplierCnpj: targetCnpj,
        userId: user.uid,
      }, { merge: true });

      appendWorkspaceAuditEvent(
        transaction,
        scope,
        {
          operation: 'historical.repair',
          source: 'system',
          entityType: 'invoice',
          entityId: issue.entityId,
          correlationId,
          before: {
            supplierCnpj: null,
          },
          after: {
            supplierCnpj: targetCnpj,
          },
          metadata: auditEvidence(issue),
        },
        user.uid
      );

      return {
        issueId: issue.id,
        repairKind: issue.repairKind,
        repaired: true,
        message: 'CNPJ da NF preenchido a partir do empenho vinculado.',
      };
    }

    if (issue.repairKind === 'backfill_invoice_record_key') {
      const invoiceRef = operationalDocRef(scope, 'invoices', issue.entityId);
      const snapshot = await transaction.get(invoiceRef);
      if (!snapshot.exists()) {
        throw new Error('A NF não existe mais. Execute um novo diagnóstico.');
      }

      const invoice = snapshot.data() as Invoice;
      if (normalizeNsNumber(invoice.numeroNS)) {
        throw new Error('A NF possui NS e exige reparo de identidade controlado.');
      }

      const cnpj = normalizeSupplierCnpj(invoice.supplierCnpj);
      const expected = buildInvoiceRecordKey(cnpj, invoice.id);
      if (!expected || expected !== issue.entityId) {
        throw new Error('A identidade física da NF mudou e não é mais elegível ao backfill automático.');
      }

      if (String(invoice.recordKey || '').trim() === issue.entityId) {
        return {
          issueId: issue.id,
          repairKind: issue.repairKind,
          repaired: false,
          message: 'A recordKey da NF já está normalizada.',
        };
      }

      transaction.set(invoiceRef, {
        recordKey: issue.entityId,
        userId: user.uid,
      }, { merge: true });

      appendWorkspaceAuditEvent(
        transaction,
        scope,
        {
          operation: 'historical.repair',
          source: 'system',
          entityType: 'invoice',
          entityId: issue.entityId,
          correlationId,
          before: {
            recordKey: String(invoice.recordKey || '') || null,
          },
          after: {
            recordKey: issue.entityId,
          },
          metadata: auditEvidence(issue),
        },
        user.uid
      );

      return {
        issueId: issue.id,
        repairKind: issue.repairKind,
        repaired: true,
        message: 'recordKey histórica preenchida com a identidade física já canônica.',
      };
    }

    if (issue.repairKind === 'clear_orphan_ns_ug') {
      const invoiceRef = operationalDocRef(scope, 'invoices', issue.entityId);
      const snapshot = await transaction.get(invoiceRef);
      if (!snapshot.exists()) {
        throw new Error('A NF não existe mais. Execute um novo diagnóstico.');
      }

      const invoice = snapshot.data() as Invoice;
      const ns = normalizeNsNumber(invoice.numeroNS);
      const ug = normalizeNsUg(invoice.nsUg);
      if (ns) {
        throw new Error('A NF passou a possuir NS. A UG não será removida.');
      }
      if (!ug) {
        return {
          issueId: issue.id,
          repairKind: issue.repairKind,
          repaired: false,
          message: 'A UG órfã já foi removida.',
        };
      }

      transaction.set(invoiceRef, {
        nsUg: deleteField(),
        userId: user.uid,
      }, { merge: true });

      appendWorkspaceAuditEvent(
        transaction,
        scope,
        {
          operation: 'historical.repair',
          source: 'system',
          entityType: 'invoice',
          entityId: issue.entityId,
          correlationId,
          before: {
            numeroNS: null,
            nsUg: ug,
          },
          after: {
            numeroNS: null,
            nsUg: null,
          },
          metadata: auditEvidence(issue),
        },
        user.uid
      );

      return {
        issueId: issue.id,
        repairKind: issue.repairKind,
        repaired: true,
        message: 'UG órfã removida sem alterar qualquer número de NS.',
      };
    }

    if (
      issue.repairKind === 'rebuild_canonical_lock'
      || issue.repairKind === 'refresh_canonical_lock'
      || issue.repairKind === 'migrate_legacy_lock'
    ) {
      const invoiceRecordKey = String(
        issue.evidence.invoiceRecordKey || issue.entityId
      ).trim();
      const invoiceRef = operationalDocRef(scope, 'invoices', invoiceRecordKey);
      const invoiceSnapshot = await transaction.get(invoiceRef);
      if (!invoiceSnapshot.exists()) {
        throw new Error('A NF proprietária do lock não existe mais.');
      }

      const invoice = invoiceSnapshot.data() as Invoice;
      const ns = normalizeNsNumber(invoice.numeroNS);
      const ug = normalizeNsUg(invoice.nsUg);
      const cnpj = normalizeSupplierCnpj(invoice.supplierCnpj);
      if (!isValidNsNumber(ns) || !isValidNsUg(ug)) {
        throw new Error('A NF não possui identidade UG + NS canônica.');
      }
      if (scope.ug && normalizeNsUg(scope.ug) !== ug) {
        throw new Error('A UG da NF diverge da UG autenticada do workspace.');
      }
      if (!cnpj || !isValidSupplierCnpj(cnpj)) {
        throw new Error('A NF não possui CNPJ válido para reconstruir o lock.');
      }

      const empenhoRef = operationalDocRef(scope, 'empenhos', invoice.empenhoId);
      const empenhoSnapshot = await transaction.get(empenhoRef);
      if (!empenhoSnapshot.exists()) {
        throw new Error('O empenho da NF não existe mais.');
      }
      const empenho = empenhoSnapshot.data() as Empenho;
      if (normalizeSupplierCnpj(empenho.supplierCnpj) !== cnpj) {
        throw new Error('O CNPJ da NF diverge do empenho.');
      }

      const canonicalId = buildNsLockDocumentId(ug, ns);
      const legacyId = buildLegacyNsLockDocumentId(ns);
      const canonicalRef = operationalSettingsDocRef(scope, canonicalId);
      const legacyRef = operationalSettingsDocRef(scope, legacyId);
      const [canonicalSnapshot, legacySnapshot] = await Promise.all([
        transaction.get(canonicalRef),
        transaction.get(legacyRef),
      ]);

      if (
        canonicalSnapshot.exists()
        && (canonicalSnapshot.data() as Partial<NsLockDocument>).invoiceRecordKey !== invoiceRecordKey
      ) {
        throw new Error('O lock canônico passou a pertencer a outra NF.');
      }

      if (issue.repairKind === 'migrate_legacy_lock') {
        if (!legacySnapshot.exists()) {
          throw new Error('O lock legado não existe mais.');
        }
        const legacy = legacySnapshot.data() as Partial<NsLockDocument>;
        if (legacy.invoiceRecordKey !== invoiceRecordKey) {
          throw new Error('O lock legado pertence a outra NF.');
        }
      }

      const existingCanonical = canonicalSnapshot.exists()
        ? (canonicalSnapshot.data() as Partial<NsLockDocument>)
        : null;
      const existingLegacy = legacySnapshot.exists()
        ? (legacySnapshot.data() as Partial<NsLockDocument>)
        : null;
      const createdAt = String(
        existingCanonical?.createdAt
        || existingLegacy?.createdAt
        || now
      );

      const mutation = {
        invoiceRecordKey,
        invoiceId: invoice.id,
        empenhoId: invoice.empenhoId,
        supplierCnpj: cnpj,
        expectedCurrentUg: ug,
        expectedCurrentNs: ns,
        proposedUg: ug,
        proposedNs: ns,
        source: 'system' as const,
      };
      const nextLock = buildNsLockDocument({
        workspaceId: scope.workspaceId,
        mutation,
        userId: user.uid,
        createdAt,
        updatedAt: now,
      });

      if (
        issue.repairKind === 'refresh_canonical_lock'
        && !canonicalSnapshot.exists()
      ) {
        throw new Error('O lock canônico deixou de existir. Execute um novo diagnóstico.');
      }

      transaction.set(canonicalRef, nextLock, { merge: false });
      if (
        issue.repairKind === 'migrate_legacy_lock'
        && legacySnapshot.exists()
        && legacyId !== canonicalId
      ) {
        transaction.delete(legacyRef);
      }

      appendWorkspaceAuditEvent(
        transaction,
        scope,
        {
          operation: 'historical.repair',
          source: 'system',
          entityType: 'ns_lock',
          entityId: canonicalId,
          correlationId,
          before: {
            canonicalLockPresent: canonicalSnapshot.exists(),
            legacyLockPresent: legacySnapshot.exists(),
            previousInvoiceRecordKey: String(
              existingCanonical?.invoiceRecordKey || existingLegacy?.invoiceRecordKey || ''
            ) || null,
          },
          after: {
            canonicalLockPresent: true,
            legacyLockPresent:
              issue.repairKind === 'migrate_legacy_lock'
                ? false
                : legacySnapshot.exists(),
            invoiceRecordKey,
            ug,
            numeroNS: ns,
          },
          metadata: auditEvidence(issue),
        },
        user.uid
      );

      return {
        issueId: issue.id,
        repairKind: issue.repairKind,
        repaired: true,
        message:
          issue.repairKind === 'migrate_legacy_lock'
            ? 'Lock legado migrado para a identidade canônica UG + NS.'
            : issue.repairKind === 'refresh_canonical_lock'
              ? 'Metadados do lock canônico atualizados a partir da NF proprietária.'
              : 'Lock canônico reconstruído a partir da NF proprietária.',
      };
    }

    if (issue.repairKind === 'delete_redundant_legacy_lock') {
      const legacyRef = operationalSettingsDocRef(scope, issue.entityId);
      const legacySnapshot = await transaction.get(legacyRef);
      if (!legacySnapshot.exists()) {
        return {
          issueId: issue.id,
          repairKind: issue.repairKind,
          repaired: false,
          message: 'O lock legado redundante já foi removido.',
        };
      }

      const legacy = legacySnapshot.data() as Partial<NsLockDocument>;
      const invoiceRecordKey = String(legacy.invoiceRecordKey || '').trim();
      const invoiceRef = operationalDocRef(scope, 'invoices', invoiceRecordKey);
      const invoiceSnapshot = await transaction.get(invoiceRef);
      if (!invoiceSnapshot.exists()) {
        throw new Error('A NF proprietária não existe; execute novo diagnóstico para tratar como lock órfão.');
      }

      const invoice = invoiceSnapshot.data() as Invoice;
      const canonicalId = buildNsLockDocumentId(invoice.nsUg, invoice.numeroNS);
      if (!canonicalId) {
        throw new Error('A NF deixou de possuir identidade canônica.');
      }
      const canonicalSnapshot = await transaction.get(
        operationalSettingsDocRef(scope, canonicalId)
      );
      if (!canonicalSnapshot.exists()) {
        throw new Error('O lock canônico não existe; o lock legado não será removido.');
      }
      if (
        (canonicalSnapshot.data() as Partial<NsLockDocument>).invoiceRecordKey
          !== invoiceRecordKey
      ) {
        throw new Error('O lock canônico pertence a outra NF.');
      }

      transaction.delete(legacyRef);

      appendWorkspaceAuditEvent(
        transaction,
        scope,
        {
          operation: 'historical.repair',
          source: 'system',
          entityType: 'ns_lock',
          entityId: issue.entityId,
          correlationId,
          before: {
            legacyLockPresent: true,
            invoiceRecordKey,
          },
          after: {
            legacyLockPresent: false,
            canonicalLockId: canonicalId,
          },
          metadata: auditEvidence(issue),
        },
        user.uid
      );

      return {
        issueId: issue.id,
        repairKind: issue.repairKind,
        repaired: true,
        message: 'Lock legado redundante removido.',
      };
    }

    if (issue.repairKind === 'delete_orphan_lock') {
      const lockRef = operationalSettingsDocRef(scope, issue.entityId);
      const lockSnapshot = await transaction.get(lockRef);
      if (!lockSnapshot.exists()) {
        return {
          issueId: issue.id,
          repairKind: issue.repairKind,
          repaired: false,
          message: 'O lock órfão já foi removido.',
        };
      }

      const lock = lockSnapshot.data() as Partial<NsLockDocument>;
      const ownerKey = String(lock.invoiceRecordKey || '').trim();
      if (!ownerKey) {
        throw new Error('Lock sem invoiceRecordKey exige revisão humana.');
      }

      const ownerSnapshot = await transaction.get(
        operationalDocRef(scope, 'invoices', ownerKey)
      );
      if (ownerSnapshot.exists()) {
        throw new Error('A NF proprietária existe novamente. O lock não foi removido.');
      }

      transaction.delete(lockRef);

      appendWorkspaceAuditEvent(
        transaction,
        scope,
        {
          operation: 'historical.repair',
          source: 'system',
          entityType: 'ns_lock',
          entityId: issue.entityId,
          correlationId,
          before: {
            lockPresent: true,
            invoiceRecordKey: ownerKey,
            numeroNS: normalizeNsNumber(lock.numeroNS) || null,
            ug: normalizeNsUg(lock.ug) || null,
          },
          after: {
            lockPresent: false,
          },
          metadata: auditEvidence(issue),
        },
        user.uid
      );

      return {
        issueId: issue.id,
        repairKind: issue.repairKind,
        repaired: true,
        message: 'Lock órfão removido após revalidação da ausência da NF proprietária.',
      };
    }

    throw new Error('Tipo de reparo histórico não implementado.');
  });
}
