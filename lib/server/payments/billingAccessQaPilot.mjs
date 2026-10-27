/**
 * GOV-SIMP-01: isolated functional QA of the existing server billing decision.
 * This is ONLY a pilot workspace's login/UX gate; it is NOT a substitute for
 * production authorization of direct Firestore SDK reads.
 *
 * Inactive unless an explicit QA workspace, enabled provider, and the SAME
 * single-workspace checkout allowlist are all configured.
 */
export function billingQaPilotEnabledFor({ workspaceId, env }) {
  return typeof workspaceId === 'string'
    && /^[a-z0-9][a-z0-9-]{2,47}$/.test(workspaceId)
    && env.EMPROVEX_BILLING_QA_WORKSPACE_ID === workspaceId
    && env.INFINITEPAY_BILLING_ENABLED === '1'
    && env.INFINITEPAY_BILLING_SCOPE === 'pilot'
    && env.INFINITEPAY_BILLING_PILOT_WORKSPACE_ID === workspaceId;
}
