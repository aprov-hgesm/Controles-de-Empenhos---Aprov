'use client';

import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  createHgesmFoundingWorkspace,
  createHgesmSectorAccount,
  HGESM_SECTOR_EMAIL,
  HGESM_WORKSPACE_ID,
} from './hgesmWorkspace';
import {
  isValidWorkspaceId,
  normalizePlatformEmail,
  normalizeWorkspaceId,
  validateWorkspace,
  type PlatformAccount,
  type SectorAccount,
  type Workspace,
} from './platformIdentity';
import { buildSectorInstitutionalProfile } from './sectorProvisioning';
export type { CreateSectorWorkspaceInput } from './sectorProvisioning';

const PLATFORM_ACCOUNTS_COLLECTION = 'platformAccounts';
const WORKSPACES_COLLECTION = 'workspaces';

export interface UpdateSectorWorkspaceInput {
  workspaceId: string;
  workspaceName: string;
  organizationName: string;
  organizationShortName?: string;
  sectionName: string;
  defaultDeliveryLocation?: string;
  defaultResponsibleRole?: string;
}

export type SectorLifecycleStatus = 'active' | 'disabled';

export interface PlatformAdminDirectory {
  workspaces: Workspace[];
  accounts: PlatformAccount[];
}

function accountDocumentId(email: string): string {
  return normalizePlatformEmail(email);
}


export function suggestWorkspaceId(name: string): string {
  return normalizeWorkspaceId(
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
  );
}

/**
 * Materializa somente o workspace fundador e sua conta operacional. A capacidade
 * administrativa da mesma identidade é resolvida pelo contexto de perfil e pelas
 * Rules; não é necessário manter um segundo documento de conta administrativa.
 */
export async function ensureFoundingPlatformMetadata(): Promise<void> {
  const now = new Date().toISOString();
  const workspace = createHgesmFoundingWorkspace(now);
  const sectorAccount = createHgesmSectorAccount(now);

  await runTransaction(db, async (transaction) => {
    const workspaceRef = doc(db, WORKSPACES_COLLECTION, HGESM_WORKSPACE_ID);
    const sectorRef = doc(db, PLATFORM_ACCOUNTS_COLLECTION, accountDocumentId(HGESM_SECTOR_EMAIL));

    const [workspaceSnapshot, sectorSnapshot] = await Promise.all([
      transaction.get(workspaceRef),
      transaction.get(sectorRef),
    ]);

    if (!workspaceSnapshot.exists()) transaction.set(workspaceRef, workspace);
    if (!sectorSnapshot.exists()) transaction.set(sectorRef, sectorAccount);
  });
}

/**
 * Atualiza apenas metadados editáveis do setor. workspaceId, conta autorizada,
 * status e campos de auditoria de criação permanecem imutáveis.
 */
export async function updateSectorWorkspaceProfile(
  input: UpdateSectorWorkspaceInput,
  updatedByEmail: string
): Promise<Workspace> {
  const workspaceId = normalizeWorkspaceId(input.workspaceId);
  const updatedBy = normalizePlatformEmail(updatedByEmail);

  if (updatedBy !== HGESM_SECTOR_EMAIL) {
    throw new Error('A sessão atual não possui permissão administrativa para alterar setores.');
  }
  if (!isValidWorkspaceId(workspaceId)) {
    throw new Error('O identificador do setor é inválido.');
  }
  if (workspaceId === HGESM_WORKSPACE_ID) {
    throw new Error('O workspace fundador não pode ser alterado por este fluxo administrativo.');
  }

  const workspaceRef = doc(db, WORKSPACES_COLLECTION, workspaceId);

  return runTransaction(db, async (transaction) => {
    const workspaceSnapshot = await transaction.get(workspaceRef);
    if (!workspaceSnapshot.exists()) {
      throw new Error('O setor informado não existe.');
    }

    const current = workspaceSnapshot.data() as Workspace;
    if (validateWorkspace(current).length > 0 || current.id !== workspaceId) {
      throw new Error('Os metadados atuais do setor são inválidos.');
    }

    const accountRef = doc(
      db,
      PLATFORM_ACCOUNTS_COLLECTION,
      accountDocumentId(current.authorizedEmail)
    );
    const accountSnapshot = await transaction.get(accountRef);
    if (!accountSnapshot.exists()) {
      throw new Error('A conta operacional vinculada ao setor não existe.');
    }

    const account = accountSnapshot.data() as PlatformAccount;
    if (
      account.accountType !== 'sector'
      || account.workspaceId !== workspaceId
      || normalizePlatformEmail(account.email) !== normalizePlatformEmail(current.authorizedEmail)
      || account.status !== current.status
    ) {
      throw new Error('Workspace e conta operacional estão inconsistentes.');
    }

    const now = new Date().toISOString();
    const updated: Workspace = {
      ...current,
      name: input.workspaceName.trim(),
      institutionalProfile: buildSectorInstitutionalProfile(
        input,
        current.institutionalProfile.documentHeaderLines
      ),
      updatedAt: now,
    };

    const errors = validateWorkspace(updated);
    if (errors.length > 0) throw new Error(errors[0]);

    transaction.update(workspaceRef, {
      name: updated.name,
      institutionalProfile: updated.institutionalProfile,
      updatedAt: now,
    });

    return updated;
  });
}

/**
 * Suspende ou reativa um setor de forma atômica. O status do workspace e da conta
 * operacional nunca é alterado isoladamente.
 */
export async function setSectorWorkspaceStatus(
  workspaceIdInput: string,
  status: SectorLifecycleStatus,
  updatedByEmail: string
): Promise<{ workspace: Workspace; account: SectorAccount }> {
  const workspaceId = normalizeWorkspaceId(workspaceIdInput);
  const updatedBy = normalizePlatformEmail(updatedByEmail);

  if (updatedBy !== HGESM_SECTOR_EMAIL) {
    throw new Error('A sessão atual não possui permissão administrativa para alterar setores.');
  }
  if (!isValidWorkspaceId(workspaceId)) {
    throw new Error('O identificador do setor é inválido.');
  }
  if (workspaceId === HGESM_WORKSPACE_ID) {
    throw new Error('O workspace fundador HGeSM não pode ser suspenso por este painel.');
  }
  if (status !== 'active' && status !== 'disabled') {
    throw new Error('Status administrativo inválido.');
  }

  const workspaceRef = doc(db, WORKSPACES_COLLECTION, workspaceId);

  return runTransaction(db, async (transaction) => {
    const workspaceSnapshot = await transaction.get(workspaceRef);
    if (!workspaceSnapshot.exists()) {
      throw new Error('O setor informado não existe.');
    }

    const currentWorkspace = workspaceSnapshot.data() as Workspace;
    if (
      validateWorkspace(currentWorkspace).length > 0
      || currentWorkspace.id !== workspaceId
    ) {
      throw new Error('Os metadados atuais do setor são inválidos.');
    }

    const accountRef = doc(
      db,
      PLATFORM_ACCOUNTS_COLLECTION,
      accountDocumentId(currentWorkspace.authorizedEmail)
    );
    const accountSnapshot = await transaction.get(accountRef);
    if (!accountSnapshot.exists()) {
      throw new Error('A conta operacional vinculada ao setor não existe.');
    }

    const currentAccount = accountSnapshot.data() as PlatformAccount;
    if (
      currentAccount.accountType !== 'sector'
      || currentAccount.workspaceId !== workspaceId
      || normalizePlatformEmail(currentAccount.email)
        !== normalizePlatformEmail(currentWorkspace.authorizedEmail)
      || currentAccount.status !== currentWorkspace.status
    ) {
      throw new Error('Workspace e conta operacional estão inconsistentes.');
    }

    const now = new Date().toISOString();
    const workspace: Workspace = {
      ...currentWorkspace,
      status,
      updatedAt: now,
    };
    const account: SectorAccount = {
      ...currentAccount,
      status,
      updatedAt: now,
    };

    transaction.update(workspaceRef, {
      status,
      updatedAt: now,
    });
    transaction.update(accountRef, {
      status,
      updatedAt: now,
    });

    return { workspace, account };
  });
}

export function subscribePlatformAdminDirectory(
  onChange: (directory: PlatformAdminDirectory) => void,
  onError: (error: Error) => void
): Unsubscribe {
  let workspaces: Workspace[] = [];
  let accounts: PlatformAccount[] = [];

  const emit = () => onChange({ workspaces, accounts });

  const unsubscribeWorkspaces = onSnapshot(
    collection(db, WORKSPACES_COLLECTION),
    (snapshot) => {
      workspaces = snapshot.docs
        .map((item) => item.data() as Workspace)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      emit();
    },
    (error) => onError(error)
  );

  const unsubscribeAccounts = onSnapshot(
    collection(db, PLATFORM_ACCOUNTS_COLLECTION),
    (snapshot) => {
      accounts = snapshot.docs.map((item) => item.data() as PlatformAccount);
      emit();
    },
    (error) => onError(error)
  );

  return () => {
    unsubscribeWorkspaces();
    unsubscribeAccounts();
  };
}
