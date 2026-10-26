import firebaseConfig from '../../firebase-applet-config.json';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import type { BillingCycle } from '../billing';

/**
 * Read latest 24 materialized cycles only AFTER a verified Firebase session
 * has selected its own workspace. Single equality query, no global listing.
 * If the server lacks privileged Firebase config, portal still works without
 * history rather than leaking information or widening Firestore Rules.
 */
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
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'billingCycles' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'workspaceId' },
            op: 'EQUAL',
            value: { stringValue: workspaceId },
          },
        },
        limit: 24,
      },
    }),
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
