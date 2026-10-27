/** Cross-database warehouse entitlement mirror.
 * A second Firestore database cannot be committed atomically with Core.
 * This idempotent IAM write is replayed on authenticated access and cutover.
 * No browser writes to warehouseAccess; the lifecycle document is preserved.
 */
import firebaseConfig from '../../firebase-applet-config.json';
import { type Workspace } from '../platformIdentity';

const ROOT = 'https://firestore.googleapis.com/v1/projects/'
  + encodeURIComponent(firebaseConfig.projectId)
  + '/databases/emprovex-warehouse/documents/warehouseAccess';
function encoded(value: string) { return { stringValue: value }; }

export async function syncWarehouseBillingMirror(
  token: string, workspace: Workspace, enabled: boolean,
): Promise<void> {
  if (!/^[a-z0-9][a-z0-9-]{2,47}$/.test(workspace.id)
    || !/^\d{6}$/.test(workspace.ug || ''))
    throw new Error('BILLING_MIRROR_WORKSPACE_INVALID');
  const billingPolicyId = workspace.billingPolicyId || '';
  const billingEntitlementUntil = workspace.billingEntitlementUntil || '';
  if (billingPolicyId === 'emprovex_individual_ramp_v1'
    && (!billingEntitlementUntil || !Number.isFinite(Date.parse(billingEntitlementUntil))))
    throw new Error('BILLING_MIRROR_ENTITLEMENT_INVALID');
  const url = ROOT + '/' + encodeURIComponent(workspace.id);
  const headers = { authorization: 'Bearer ' + token, 'content-type': 'application/json' };
  const original = await fetch(url, { headers: { authorization: 'Bearer ' + token }, cache: 'no-store' });
  if (!original.ok && original.status !== 404) throw new Error('BILLING_MIRROR_READ_UNAVAILABLE');
  const previous = original.ok ? await original.json() as {
    fields?: Record<string, {stringValue?: string}>;
  } : null;
  if (previous && (previous.fields?.workspaceId?.stringValue !== workspace.id
    || previous.fields?.ug?.stringValue !== workspace.ug))
    throw new Error('BILLING_MIRROR_TENANT_CONFLICT');
  const fields = {
    billingPolicyId: encoded(billingPolicyId),
    billingEntitlementUntil: encoded(billingEntitlementUntil),
    billingEnforcementStatus: encoded(enabled && billingPolicyId ? 'enforce' : 'observe'),
  };
  if (!previous) {
    const result = await fetch(ROOT + '?documentId=' + encodeURIComponent(workspace.id), {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({ fields: {
        schemaVersion: encoded('warehouse_workspace_access_v1'),
        workspaceId: encoded(workspace.id), ug: encoded(workspace.ug!),
        status: encoded('active'), ...fields,
        updatedAt: encoded(new Date().toISOString()), updatedBy: encoded('billing-server'),
      } }),
    });
    if (result.ok) return;
    // Concurrent lifecycle creation can race the initial mirror write.
    if (result.status !== 409) throw new Error('BILLING_MIRROR_CREATE_UNAVAILABLE');
  }
  const params = new URLSearchParams();
  for (const name of Object.keys(fields)) params.append('updateMask.fieldPaths', name);
  const update = await fetch(url + '?' + params, {
    method: 'PATCH', headers, cache: 'no-store',
    body: JSON.stringify({ fields }),
  });
  if (!update.ok) throw new Error('BILLING_MIRROR_UPDATE_UNAVAILABLE');
}
