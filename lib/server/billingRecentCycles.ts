import firebaseConfig from '../../firebase-applet-config.json';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import type { BillingCycle } from '../billing';

/**
 * A bounded, tenant-specific list of recent materialized monthly cycles.
 * Canonical document IDs are workspaceId__YYYY-MM; sort the document names
 * descending BEFORE limit, not the limited results afterward. A single
 * __name__ range avoids requiring a compound billing index deployment.
 * The caller must already have verified the user's workspace.
 * This function never widens Firestore Rules or changes documents.
 */
export function buildBillingHistoryQuery(workspaceId: string, projectId: string, databaseId: string) {
  if (!/^[a-z0-9-]{3,48}$/.test(workspaceId)) throw new Error('INVALID_HISTORY_WORKSPACE');
  const prefix = `projects/${projectId}/databases/${databaseId}/documents/billingCycles/${workspaceId}__`;
  return {
    structuredQuery: {
      from: [{ collectionId: 'billingCycles' }],
      where: { compositeFilter: { op: 'AND', filters: [
        { fieldFilter: { field: { fieldPath: '__name__' }, op: 'GREATER_THAN_OR_EQUAL',
          value: { referenceValue: prefix + '0000-00' } } },
        { fieldFilter: { field: { fieldPath: '__name__' }, op: 'LESS_THAN_OR_EQUAL',
          value: { referenceValue: prefix + '9999-12' } } },
      ] } },
      orderBy: [{ field: { fieldPath: '__name__' }, direction: 'DESCENDING' }],
      limit: 24,
    },
  };
}

export async function readBillingCycleHistory(workspaceId: string): Promise<{
  available: boolean;
  cycles: Array<Pick<BillingCycle, 'referenceMonth' | 'amountCents' | 'dueDate' | 'status' | 'confirmedAt'>>;
}> {
  if (!/^[a-z0-9-]{3,48}$/.test(workspaceId)) return { available: false, cycles: [] };
  let token: string;
  try { token = await getGoogleAccessToken(); }
  catch { return { available: false, cycles: [] }; }

  const parent = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId)}/databases/${encodeURIComponent(firebaseConfig.firestoreDatabaseId)}/documents:runQuery`;
  const response = await fetch(parent, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildBillingHistoryQuery(
      workspaceId, firebaseConfig.projectId, firebaseConfig.firestoreDatabaseId,
    )),
    cache: 'no-store',
  });
  if (!response.ok) return { available: false, cycles: [] };
  const results = await response.json() as Array<{
    document?: {
      name?: string;
      fields?: Record<string, {
        stringValue?: string;
        integerValue?: string;
      }>;
    };
  }>;
  const cycles: Array<Pick<BillingCycle, 'referenceMonth' | 'amountCents' | 'dueDate' | 'status' | 'confirmedAt'>> = [];
  for (const item of results) {
    const document = item.document;
    const fields = document?.fields;
    const referenceMonth = fields?.referenceMonth?.stringValue || '';
    const amountCents = Number(fields?.amountCents?.integerValue);
    const status = fields?.status?.stringValue || '';
    const name = document?.name || '';
    if (fields?.workspaceId?.stringValue !== workspaceId
      || !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(referenceMonth)
      || !name.endsWith('/' + workspaceId + '__' + referenceMonth)
      || !Number.isSafeInteger(amountCents) || amountCents < 0
      || !['open', 'pending', 'paid', 'waived'].includes(status)) continue;
    cycles.push({
      referenceMonth,
      amountCents,
      dueDate: fields?.dueDate?.stringValue || '',
      status: status as BillingCycle['status'],
      confirmedAt: fields?.confirmedAt?.stringValue || '',
    });
  }
  cycles.sort((a, b) => b.referenceMonth.localeCompare(a.referenceMonth));
  return { available: true, cycles };
}
