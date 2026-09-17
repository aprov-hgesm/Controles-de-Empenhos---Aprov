'use client';

import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { db } from './firebase';
import { HGESM_SECTOR_EMAIL } from './hgesmWorkspace';
import {
  normalizePlatformEmail,
  validatePlatformAccount,
  validateWorkspace,
  type PlatformAccount,
  type SectorAccount,
  type Workspace,
} from './platformIdentity';
import type { EmprovexProfileMode } from './profileMode';
import {
  rememberResolvedWorkspaceContext,
  resolveWorkspaceContext,
  type ResolvedWorkspaceContext,
  type SectorWorkspaceContext,
  type UnauthorizedWorkspaceContext,
} from './workspaceContext';

const PLATFORM_ACCOUNTS_COLLECTION = 'platformAccounts';
const WORKSPACES_COLLECTION = 'workspaces';

function unauthorized(email?: string | null): UnauthorizedWorkspaceContext {
  return {
    status: 'unauthorized',
    email: normalizePlatformEmail(email || 'conta-sem-email@invalid.local'),
    canLoadOperationalData: false,
    resolutionSource: 'none',
  };
}

function isActiveSectorAccount(account: PlatformAccount): account is SectorAccount {
  return account.accountType === 'sector' && account.status === 'active';
}

/**
 * Bloco 15 — resolve um login Google externo usando somente os diretórios
 * administrativos já protegidos pelas Firestore Rules.
 *
 * Esta função não grava firebaseUid, firstLoginAt ou lastLoginAt. A vinculação
 * persistente da identidade pertence ao Bloco 16.
 */
export async function resolveAuthenticatedWorkspaceContext(
  user: User,
  requestedProfile?: EmprovexProfileMode
): Promise<ResolvedWorkspaceContext> {
  if (!user.email || !user.emailVerified) {
    return unauthorized(user.email);
  }

  const normalizedEmail = normalizePlatformEmail(user.email);

  // A conta fundadora mantém a lógica multiperfil já consolidada.
  if (normalizedEmail === HGESM_SECTOR_EMAIL) {
    const founderContext = resolveWorkspaceContext(normalizedEmail, requestedProfile);
    if (founderContext.status === 'sector') {
      rememberResolvedWorkspaceContext(user.uid, founderContext);
    }
    return founderContext;
  }

  try {
    const accountSnapshot = await getDoc(
      doc(db, PLATFORM_ACCOUNTS_COLLECTION, normalizedEmail)
    );

    if (!accountSnapshot.exists()) return unauthorized(normalizedEmail);

    const account = accountSnapshot.data() as PlatformAccount;
    if (validatePlatformAccount(account).length > 0) return unauthorized(normalizedEmail);
    if (!isActiveSectorAccount(account)) return unauthorized(normalizedEmail);
    if (normalizePlatformEmail(account.email) !== normalizedEmail) return unauthorized(normalizedEmail);

    // Se o UID já estiver vinculado por uma etapa futura, nunca aceitar outro UID.
    if (account.firebaseUid && account.firebaseUid !== user.uid) {
      return unauthorized(normalizedEmail);
    }

    const workspaceSnapshot = await getDoc(
      doc(db, WORKSPACES_COLLECTION, account.workspaceId)
    );

    if (!workspaceSnapshot.exists()) return unauthorized(normalizedEmail);

    const workspace = workspaceSnapshot.data() as Workspace;
    if (validateWorkspace(workspace).length > 0) return unauthorized(normalizedEmail);
    if (workspace.status !== 'active') return unauthorized(normalizedEmail);
    if (workspace.id !== account.workspaceId) return unauthorized(normalizedEmail);
    if (normalizePlatformEmail(workspace.authorizedEmail) !== normalizedEmail) {
      return unauthorized(normalizedEmail);
    }

    const context: SectorWorkspaceContext = {
      status: 'sector',
      email: normalizedEmail,
      accountType: 'sector',
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      institutionalProfile: {
        ...workspace.institutionalProfile,
        documentHeaderLines: [...(workspace.institutionalProfile.documentHeaderLines || [])],
      },
      legacyDataMode: false,
      legacySettingsMode: false,
      canLoadOperationalData: true,
      resolutionSource: 'platform-directory',
    };

    rememberResolvedWorkspaceContext(user.uid, context);
    return context;
  } catch (error) {
    // Fail closed: falhas de leitura/autorização nunca abrem subscriptions operacionais.
    console.warn('Não foi possível resolver a conta externa no diretório EMPROVEX.', error);
    return unauthorized(normalizedEmail);
  }
}
