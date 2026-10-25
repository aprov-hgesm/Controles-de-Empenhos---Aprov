/**
 * Readonly contract for the billing screen. Does not provide access to data:
 * Firestore Rules continue to enforce tenant read permissions.
 */
export function validateBillingIdentity({ uid, email, verifiedEmail, provider, account, workspace }) {
  if (!uid || !email || !verifiedEmail || provider !== 'password') return false;
  if (!account || account.accountType !== 'sector' || account.status !== 'active') return false;
  if (account.authProvider && account.authProvider !== 'password') return false;
  if (account.email !== email || account.firebaseUid !== uid || !account.workspaceId) return false;
  if (!workspace || workspace.id !== account.workspaceId || workspace.status !== 'active') return false;
  if (workspace.authorizedEmail !== email) return false;
  const accountHasUg = Object.prototype.hasOwnProperty.call(account, 'ug');
  const workspaceHasUg = Object.prototype.hasOwnProperty.call(workspace, 'ug');
  if (accountHasUg !== workspaceHasUg) return false;
  if (accountHasUg && (!/^[0-9]{6}$/.test(account.ug) || account.ug !== workspace.ug)) return false;
  return true;
}
