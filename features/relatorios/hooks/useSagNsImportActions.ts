'use client';

import type React from 'react';
import type { User } from 'firebase/auth';
import type { Empenho, Invoice } from '../../../lib/types';
import { getInvoiceRecordKey, normalizeSupplierCnpj } from '../../../lib/invoiceIdentity';
import { normalizeSagNsNumber, normalizeSagUg, type SagNsPayload } from '../../../lib/sagNsContract';
import { reconcileSagNsPayload } from '../../../lib/sagNsReconciliation';
import {
  buildSagNsApplicationFingerprint,
  buildSagNsApplicationPreview,
} from '../../../lib/sagNsApplicationPreview';
import { buildSagNsPersistenceChanges } from '../../../lib/sagNsPersistencePlan';
import {
  commitSagNsImport,
  type SagNsImportCommitResult,
} from '../../../lib/sagNsPersistence';
import { getCurrentOperationalScope } from '../../../lib/operationalPaths';

type ToastType = 'success' | 'error' | 'info';

interface SagNsImportActionsContext {
  user: User | null;
  empenhos: Empenho[];
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  showToast: (message: string, type?: ToastType) => void;
}

export class SagNsImportActionError extends Error {
  readonly code: 'unauthenticated' | 'stale_preview' | 'blocked_preview';

  constructor(
    code: 'unauthenticated' | 'stale_preview' | 'blocked_preview',
    message: string
  ) {
    super(message);
    this.name = 'SagNsImportActionError';
    this.code = code;
  }
}

export function useSagNsImportActions(context: SagNsImportActionsContext) {
  const { user, empenhos, invoices, setInvoices, showToast } = context;

  const handleApplySagNsImport = async (
    payload: SagNsPayload,
    supplierCnpj: string,
    expectedFingerprint: string
  ): Promise<SagNsImportCommitResult> => {
    if (!user) {
      throw new SagNsImportActionError(
        'unauthenticated',
        'Faça login novamente antes de gravar as NS do SAG.'
      );
    }

    const scope = getCurrentOperationalScope(user.uid);
    const workspaceUg = normalizeSagUg(scope.ug);
    if (!workspaceUg) {
      throw new SagNsImportActionError(
        'blocked_preview',
        'A UG da Organização Militar não está configurada para este usuário. Solicite ao administrador a vinculação da UG antes de importar NS.'
      );
    }

    const payloadUg = normalizeSagUg(payload.ug);
    if (payloadUg && payloadUg !== workspaceUg) {
      throw new SagNsImportActionError(
        'blocked_preview',
        `O SAG informou a UG ${payloadUg}, diferente da UG ${workspaceUg} vinculada a este usuário.`
      );
    }

    const scopedPayload: SagNsPayload = {
      ...payload,
      ug: workspaceUg,
    };

    const freshReconciliation = reconcileSagNsPayload(
      scopedPayload,
      supplierCnpj,
      empenhos,
      invoices
    );
    const freshPreview = buildSagNsApplicationPreview(freshReconciliation);
    const freshFingerprint = buildSagNsApplicationFingerprint(freshPreview);

    if (freshFingerprint !== expectedFingerprint) {
      throw new SagNsImportActionError(
        'stale_preview',
        'Os dados mudaram desde a abertura da confirmação. Revise novamente a prévia antes de gravar.'
      );
    }

    if (!freshPreview.canAdvanceToPersistenceReview) {
      throw new SagNsImportActionError(
        'blocked_preview',
        freshPreview.stats.blocked > 0
          ? 'O lote possui bloqueios e não pode ser gravado.'
          : 'O lote não possui alterações novas para gravar.'
      );
    }

    const changes = buildSagNsPersistenceChanges(freshPreview);
    const normalizedSupplierCnpj = normalizeSupplierCnpj(supplierCnpj);
    const selectedEmpenhoIds = new Set(
      empenhos
        .filter(
          (empenho) =>
            normalizeSupplierCnpj(empenho.supplierCnpj) === normalizedSupplierCnpj
        )
        .map((empenho) => empenho.id)
    );
    const proposedNs = new Set(
      changes.map((change) => normalizeSagNsNumber(change.proposedNs))
    );
    const proposedIdentities = new Set(
      changes.map(
        (change) =>
          `${change.proposedUg}|${normalizeSagNsNumber(change.proposedNs)}`
      )
    );
    const knownNsOwnerRecordKeys = invoices
      .filter((invoice) => {
        if (!selectedEmpenhoIds.has(invoice.empenhoId)) return false;
        const invoiceNs = normalizeSagNsNumber(invoice.numeroNS);
        if (!invoiceNs || !proposedNs.has(invoiceNs)) return false;
        const invoiceUg = normalizeSagUg(invoice.nsUg);
        return !invoiceUg || proposedIdentities.has(`${invoiceUg}|${invoiceNs}`);
      })
      .map(getInvoiceRecordKey);

    const result = await commitSagNsImport(user.uid, {
      supplierCnpj: normalizedSupplierCnpj,
      changes,
      knownNsOwnerRecordKeys,
    });

    if (result.updatedInvoices.length > 0) {
      const updatesByKey = new Map(
        result.updatedInvoices.map((invoice) => [getInvoiceRecordKey(invoice), invoice])
      );
      setInvoices((current) =>
        current.map((invoice) => updatesByKey.get(getInvoiceRecordKey(invoice)) || invoice)
      );
    }

    const parts = [];
    if (result.appliedCount > 0) {
      parts.push(
        `${result.appliedCount} NS ${result.appliedCount === 1 ? 'gravada' : 'gravadas'}`
      );
    }
    if (result.alreadyAppliedCount > 0) {
      parts.push(
        `${result.alreadyAppliedCount} ${result.alreadyAppliedCount === 1 ? 'já estava aplicada' : 'já estavam aplicadas'}`
      );
    }

    showToast(
      parts.length > 0
        ? `Importação SAG concluída: ${parts.join(' · ')}.`
        : 'Importação SAG concluída sem alterações.',
      'success'
    );

    return result;
  };

  return { handleApplySagNsImport };
}
