'use client';

import type { User } from 'firebase/auth';
import { doc, runTransaction } from 'firebase/firestore';

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

interface ResolvedExternalIdentity {
  account: SectorAccount;
  workspace: Workspace;
}

/**
 * Bloco 16 — valida conta + workspace e vincula a identidade Firebase na mesma
 * transação. O primeiro login grava firebaseUid/firstLoginAt; logins posteriores
 * exigem o mesmo UID e atualizam somente lastLoginAt/updatedAt.
 *
 * As Firestore Rules repetem as mesmas invariantes e impedem que o próprio setor
 * altere e-mail, workspaceId, status, createdAt, createdBy ou firebaseUid.
 */
async function resolveAndBindExternalIdentity(
  user: User,
  normalizedEmail: string
): Promise<ResolvedExternalIdentity | null> {
  const now = new Date().toISOString();
  const accountRef = doc(db, PLATFORM_ACCOUNTS_COLLECTION, normalizedEmail);

  return runTransaction(db, async (transaction) => {
    const accountSnapshot = await transaction.get(accountRef);
    if (!accountSnapshot.exists()) return null;

    const account = accountSnapshot.data() as PlatformAccount;
    if (validatePlatformAccount(account).length > 0) return null;
    if (!isActiveSectorAccount(account)) return null;
    if (normalizePlatformEmail(account.email) !== normalizedEmail) return null;

    // Depois do primeiro vínculo, e-mail idêntico não é suficiente: o UID precisa
    // continuar sendo exatamente o mesmo.
    if (account.firebaseUid && account.firebaseUid !== user.uid) {
      return null;
    }

    const workspaceRef = doc(db, WORKSPACES_COLLECTION, account.workspaceId);
    const workspaceSnapshot = await transaction.get(workspaceRef);
    if (!workspaceSnapshot.exists()) return null;

    const workspace = workspaceSnapshot.data() as Workspace;
    if (validateWorkspace(workspace).length > 0) return null;
    if (workspace.status !== 'active') return null;
    if (workspace.id !== account.workspaceId) return null;
    if (normalizePlatformEmail(workspace.authorizedEmail) !== normalizedEmail) {
      return null;
    }

    const firstLoginAt = account.firstLoginAt || now;
    const boundAccount: SectorAccount = {
      ...account,
      firebaseUid: account.firebaseUid || user.uid,
      firstLoginAt,
      lastLoginAt: now,
      updatedAt: now,
    };

    transaction.update(accountRef, {
      firebaseUid: boundAccount.firebaseUid,
      firstLoginAt,
      lastLoginAt: now,
      updatedAt: now,
    });

    return {
      account: boundAccount,
      workspace,
    };
  });
}

/**
 * Resolve uma sessão Google para um contexto operacional EMPROVEX.
 *
 * A conta fundadora preserva a lógica multiperfil consolidada. Setores externos
 * passam obrigatoriamente pelo diretório, pelo workspace e pelo vínculo de UID
 * antes que qualquer subscription operacional seja aberta.
 */
export async function resolveAuthenticatedWorkspaceContext(
  user: User,
  requestedProfile?: EmprovexProfileMode
): Promise<ResolvedWorkspaceContext> {
  if (!user.email || !user.emailVerified) {
    return unauthorized(user.email);
  }

  const normalizedEmail = normalizePlatformEmail(user.email);

  if (normalizedEmail === HGESM_SECTOR_EMAIL) {
    const founderContext = resolveWorkspaceContext(normalizedEmail, requestedProfile);
    if (founderContext.status === 'sector') {
      rememberResolvedWorkspaceContext(user.uid, founderContext);
    }
    return founderContext;
  }

  try {
    const resolvedIdentity = await resolveAndBindExternalIdentity(user, normalizedEmail);
    if (!resolvedIdentity) return unauthorized(normalizedEmail);

    const { workspace } = resolvedIdentity;
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
    // Fail closed: qualquer conflito de UID, regra, leitura ou transação mantém o
    // usuário fora do workspace e impede subscriptions operacionais.
    console.warn('Não foi possível validar/vincular a identidade no EMPROVEX.', error);
    return unauthorized(normalizedEmail);
  }
}
