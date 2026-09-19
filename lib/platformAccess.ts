'use client';

import type { User } from 'firebase/auth';
import { doc, runTransaction } from 'firebase/firestore';

import { db } from './firebase';
import { HGESM_SECTOR_EMAIL } from './hgesmWorkspace';
import {
  FOUNDER_AUTH_PROVIDER,
  SECTOR_AUTH_PROVIDER,
  normalizePlatformEmail,
  normalizeUnitUg,
  validatePlatformAccount,
  validateWorkspace,
  type PlatformAccount,
  type PlatformAuthProvider,
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

class ExternalIdentityResolutionError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'ExternalIdentityResolutionError';
  }
}

function failIdentityResolution(code: string): never {
  throw new ExternalIdentityResolutionError(code);
}

async function resolveSessionAuthProvider(
  user: User
): Promise<PlatformAuthProvider | null> {
  const tokenResult = await user.getIdTokenResult();
  const provider = tokenResult.signInProvider;

  if (provider === FOUNDER_AUTH_PROVIDER || provider === SECTOR_AUTH_PROVIDER) {
    return provider;
  }

  return null;
}

/**
 * Valida conta + workspace e a identidade Firebase na mesma transação.
 * Contas novas do Bloco 2 já possuem firebaseUid; o bootstrap de primeiro vínculo
 * permanece somente para registros legados sem UID.
 *
 * As Firestore Rules repetem as mesmas invariantes e impedem que o próprio setor
 * altere e-mail, workspaceId, status, createdAt, createdBy ou firebaseUid.
 */
async function resolveAndBindExternalIdentity(
  user: User,
  normalizedEmail: string,
  signInProvider: PlatformAuthProvider
): Promise<ResolvedExternalIdentity | null> {
  const now = new Date().toISOString();
  const accountRef = doc(db, PLATFORM_ACCOUNTS_COLLECTION, normalizedEmail);

  return runTransaction(db, async (transaction) => {
    const accountSnapshot = await transaction.get(accountRef);
    if (!accountSnapshot.exists()) failIdentityResolution('ACCOUNT_NOT_FOUND');

    const account = accountSnapshot.data() as PlatformAccount;
    if (validatePlatformAccount(account).length > 0) failIdentityResolution('ACCOUNT_INVALID');
    if (!isActiveSectorAccount(account)) failIdentityResolution('ACCOUNT_DISABLED_OR_WRONG_TYPE');
    if (normalizePlatformEmail(account.email) !== normalizedEmail) failIdentityResolution('ACCOUNT_EMAIL_MISMATCH');

    // Nova arquitetura híbrida: setores externos entram exclusivamente pelo
    // provider email/password. Documentos legados sem authProvider são tratados
    // como password até que o Bloco 2 materialize o campo explicitamente.
    const expectedProvider = account.authProvider || SECTOR_AUTH_PROVIDER;
    if (expectedProvider !== SECTOR_AUTH_PROVIDER) failIdentityResolution('ACCOUNT_PROVIDER_MISMATCH');
    if (signInProvider !== SECTOR_AUTH_PROVIDER) failIdentityResolution('SESSION_PROVIDER_MISMATCH');

    // Depois do primeiro vínculo, e-mail idêntico não é suficiente: o UID precisa
    // continuar sendo exatamente o mesmo.
    if (account.firebaseUid && account.firebaseUid !== user.uid) {
      failIdentityResolution('UID_MISMATCH');
    }

    const workspaceRef = doc(db, WORKSPACES_COLLECTION, account.workspaceId);
    const workspaceSnapshot = await transaction.get(workspaceRef);
    if (!workspaceSnapshot.exists()) failIdentityResolution('WORKSPACE_NOT_FOUND');

    const workspace = workspaceSnapshot.data() as Workspace;
    if (validateWorkspace(workspace).length > 0) failIdentityResolution('WORKSPACE_INVALID');
    if (workspace.status !== 'active') failIdentityResolution('WORKSPACE_DISABLED');
    if (workspace.id !== account.workspaceId) failIdentityResolution('WORKSPACE_ID_MISMATCH');
    if (normalizePlatformEmail(workspace.authorizedEmail) !== normalizedEmail) {
      failIdentityResolution('WORKSPACE_EMAIL_MISMATCH');
    }

    const workspaceUg = normalizeUnitUg(workspace.ug);
    const accountUg = normalizeUnitUg(account.ug);
    if ((workspaceUg || accountUg) && workspaceUg !== accountUg) {
      failIdentityResolution('UG_MISMATCH');
    }

    // Novos setores do Bloco 2 já chegam pré-vinculados ao UID pelo servidor.
    // Apenas contas legadas sem UID executam o bootstrap histórico de primeiro acesso.
    let boundAccount: SectorAccount;

    if (account.firebaseUid) {
      const firstLoginAt = account.firstLoginAt || now;

      boundAccount = {
        ...account,
        firstLoginAt,
        lastLoginAt: now,
        updatedAt: now,
      };

      transaction.update(accountRef, {
        ...(account.firstLoginAt ? {} : { firstLoginAt }),
        lastLoginAt: now,
        updatedAt: now,
      });
    } else {
      const firstLoginAt = account.firstLoginAt || now;
      boundAccount = {
        ...account,
        firebaseUid: user.uid,
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
    }

    return {
      account: boundAccount,
      workspace,
    };
  });
}

/**
 * Resolve uma sessão Firebase para um contexto operacional EMPROVEX.
 *
 * Modelo híbrido:
 * - fundador HGeSM: exclusivamente Google (google.com);
 * - setores externos: exclusivamente e-mail/senha (password).
 *
 * A conta fundadora preserva a lógica multiperfil consolidada. Setores externos
 * passam obrigatoriamente pelo diretório, pelo workspace, pelo provider esperado
 * e pelo vínculo de UID antes que qualquer subscription operacional seja aberta.
 */
export async function resolveAuthenticatedWorkspaceContext(
  user: User,
  requestedProfile?: EmprovexProfileMode
): Promise<ResolvedWorkspaceContext> {
  if (!user.email || !user.emailVerified) {
    return unauthorized(user.email);
  }

  const normalizedEmail = normalizePlatformEmail(user.email);

  let signInProvider: PlatformAuthProvider | null = null;
  try {
    signInProvider = await resolveSessionAuthProvider(user);
  } catch (error) {
    console.warn('Não foi possível identificar o provedor da sessão EMPROVEX.', error);
    return unauthorized(normalizedEmail);
  }

  if (normalizedEmail === HGESM_SECTOR_EMAIL) {
    // O perfil fundador preserva exclusivamente o login federado Google.
    if (signInProvider !== FOUNDER_AUTH_PROVIDER) {
      return unauthorized(normalizedEmail);
    }

    const founderContext = resolveWorkspaceContext(normalizedEmail, requestedProfile);
    if (founderContext.status === 'sector') {
      rememberResolvedWorkspaceContext(user.uid, founderContext);
    }
    return founderContext;
  }

  try {
    if (signInProvider !== SECTOR_AUTH_PROVIDER) return unauthorized(normalizedEmail);

    const resolvedIdentity = await resolveAndBindExternalIdentity(
      user,
      normalizedEmail,
      signInProvider
    );
    if (!resolvedIdentity) return unauthorized(normalizedEmail);

    const { workspace } = resolvedIdentity;
    const context: SectorWorkspaceContext = {
      status: 'sector',
      email: normalizedEmail,
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

    rememberResolvedWorkspaceContext(user.uid, context);
    return context;
  } catch (error) {
    // Fail closed: qualquer conflito de UID, regra, leitura ou transação mantém o
    // usuário fora do workspace e impede subscriptions operacionais.
    const diagnosticCode = error instanceof ExternalIdentityResolutionError
      ? error.code
      : (
          typeof error === 'object'
          && error
          && 'code' in error
            ? `FIRESTORE_${String((error as { code?: unknown }).code || 'UNKNOWN').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`
            : 'UNEXPECTED_RESOLUTION_ERROR'
        );

    console.warn(
      'Não foi possível validar/vincular a identidade no EMPROVEX.',
      diagnosticCode,
      error
    );

    return {
      ...unauthorized(normalizedEmail),
      diagnosticCode,
    } as UnauthorizedWorkspaceContext & { diagnosticCode: string };
  }
}
