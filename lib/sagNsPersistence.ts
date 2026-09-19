import type { Invoice } from './types';
import type { NsIntegrityMutation } from './nsIntegrity';
import {
  commitNsIntegrityMutations,
  MAX_NS_INTEGRITY_KNOWN_OWNER_READS,
  MAX_NS_INTEGRITY_TRANSACTION_MUTATIONS,
} from './nsIntegrityService';
import type { SagNsPersistenceChange } from './sagNsPersistencePlan';

export const MAX_SAG_NS_TRANSACTION_CHANGES = MAX_NS_INTEGRITY_TRANSACTION_MUTATIONS;
export const MAX_SAG_NS_KNOWN_OWNER_READS = MAX_NS_INTEGRITY_KNOWN_OWNER_READS;

export interface SagNsImportCommitInput {
  supplierCnpj: string;
  changes: SagNsPersistenceChange[];
  knownNsOwnerRecordKeys: string[];
}

export interface SagNsImportCommitResult {
  appliedCount: number;
  alreadyAppliedCount: number;
  updatedInvoices: Invoice[];
}

export async function commitSagNsImport(
  userId: string,
  input: SagNsImportCommitInput
): Promise<SagNsImportCommitResult> {
  const mutations: NsIntegrityMutation[] = input.changes.map((change) => ({
    invoiceRecordKey: change.invoiceRecordKey,
    invoiceId: change.invoiceId,
    empenhoId: change.empenhoId,
    supplierCnpj: input.supplierCnpj,
    expectedCurrentNs: change.expectedCurrentNs,
    proposedNs: change.proposedNs,
    source: 'sag',
  }));

  const result = await commitNsIntegrityMutations(userId, {
    mutations,
    knownNsOwnerRecordKeys: input.knownNsOwnerRecordKeys,
  });

  return {
    appliedCount: result.appliedCount,
    alreadyAppliedCount: result.noOpCount,
    updatedInvoices: result.updatedInvoices,
  };
}
