'use client';

import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { db } from '../firebase';
import { HGESM_SECTOR_EMAIL } from '../hgesmWorkspace';
import {
  isFounderSignInProvider,
  normalizePlatformEmail,
  normalizeUnitUg,
  validatePlatformAccount,
  validateWorkspace,
  type PlatformAccount,
  type Workspace,
} from '../platformIdentity';
import { resolveWorkspaceContext, type ResolvedWorkspaceContext } from '../workspaceContext';
import { validateBillingIdentity } from './billingWorkspaceIdentity.mjs';

/**
 * Recover the workspace for the read-only subscription screen, including after
 * a hard refresh that clears the application's in-memory context.
 *
 * No session lease, login mutation, billing write, or cross-tenant list query.
 * Every external-sector lookup is derived solely from the signed-in identity.
 */
export async function resolveBillingWorkspaceContext(user: User): Promise<ResolvedWorkspaceContext> {
  if (!user.email || !user.emailVerified || !user.uid) {
    throw new Error('BILLING_AUTH_UNVERIFIED');
  }

  const email = normalizePlatformEmail(user.email);
  const token = await user.getIdTokenResult();
  const tokenEmail = typeof token.claims.email === 'string'
    ? normalizePlatformEmail(token.claims.email)
    : '';

  if (tokenEmail !== email || token.claims.email_verified !== true) {
    throw new Error('BILLING_TOKEN_IDENTITY_MISMATCH');
  }

  if (email === HGESM_SECTOR_EMAIL) {
    // Identidade fundadora validada: dois provedores vinculados, perfil setor
    // nesta tela mesmo quando o perfil operacional ativo for Admin.
    if (!isFounderSignInProvider(token.signInProvider)) {
      throw new Error('BILLING_FOUNDER_PROVIDER_MISMATCH');
    }
    return resolveWorkspaceContext(email, 'sector');
  }

  if (token.signInProvider !== 'password') {
    throw new Error('BILLING_SECTOR_PROVIDER_MISMATCH');
  }

  const accountSnapshot = await getDoc(doc(db, 'platformAccounts', email));
  if (!accountSnapshot.exists()) throw new Error('BILLING_ACCOUNT_NOT_FOUND');
  const account = accountSnapshot.data() as PlatformAccount;
  if (validatePlatformAccount(account).length) throw new Error('BILLING_ACCOUNT_INVALID');
  if (account.accountType !== 'sector') throw new Error('BILLING_NOT_SECTOR');

  const workspaceSnapshot = await getDoc(doc(db, 'workspaces', account.workspaceId));
  if (!workspaceSnapshot.exists()) throw new Error('BILLING_WORKSPACE_NOT_FOUND');
  const workspace = workspaceSnapshot.data() as Workspace;
  if (validateWorkspace(workspace).length) throw new Error('BILLING_WORKSPACE_INVALID');

  if (!validateBillingIdentity({
    uid: user.uid,
    email,
    verifiedEmail: user.emailVerified,
    provider: token.signInProvider,
    account,
    workspace,
  })) {
    throw new Error('BILLING_DIRECTORY_MISMATCH');
  }

  return {
    status: 'sector',
    email,
    accountType: 'sector',
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    ug: normalizeUnitUg(workspace.ug) || null,
    institutionalProfile: {
      ...workspace.institutionalProfile,
      documentHeaderLines: [...(workspace.institutionalProfile.documentHeaderLines || [])],
    },
    legacyDataMode: false,
    legacySettingsMode: false,
    canLoadOperationalData: true,
    resolutionSource: 'platform-directory',
  };
}
