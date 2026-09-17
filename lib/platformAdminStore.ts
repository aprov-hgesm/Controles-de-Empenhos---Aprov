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
  BOOTSTRAP_PLATFORM_ADMIN_EMAIL,
  createBootstrapPlatformAdminAccount,
} from './platformBootstrap';
import {
  isValidPlatformEmail,
  isValidWorkspaceId,
  normalizePlatformEmail,
  normalizeWorkspaceId,
  validatePlatformAccount,
  validateWorkspace,
  type PlatformAccount,
  type SectorAccount,
  type Workspace,
} from './platformIdentity';

const PLATFORM_ACCOUNTS_COLLECTION = 'platformAccounts';
const WORKSPACES_COLLECTION = 'workspaces';

export interface CreateSectorWorkspaceInput {
  workspaceId: string;
  workspaceName: string;
  authorizedEmail: string;
  organizationName: string;
  organizationShortName?: string;
  sectionName: string;
  defaultDeliveryLocation?: string;
  defaultResponsibleRole?: string;
}

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
 * Materializa, de forma idempotente, os registros administrativos já definidos
 * nos blocos anteriores. Não toca nas coleções operacionais legadas do HGeSM.
 */
export async function ensureFoundingPlatformMetadata(): Promise<void> {
  const now = new Date().toISOString();
  const admin = createBootstrapPlatformAdminAccount(now);
  const workspace = createHgesmFoundingWorkspace(now);
  const sectorAccount = createHgesmSectorAccount(now);

  await runTransaction(db, async (transaction) => {
    const adminRef = doc(db, PLATFORM_ACCOUNTS_COLLECTION, accountDocumentId(BOOTSTRAP_PLATFORM_ADMIN_EMAIL));
    const workspaceRef = doc(db, WORKSPACES_COLLECTION, HGESM_WORKSPACE_ID);
    const sectorRef = doc(db, PLATFORM_ACCOUNTS_COLLECTION, accountDocumentId(HGESM_SECTOR_EMAIL));

    const [adminSnapshot, workspaceSnapshot, sectorSnapshot] = await Promise.all([
      transaction.get(adminRef),
      transaction.get(workspaceRef),
      transaction.get(sectorRef),
    ]);

    if (!adminSnapshot.exists()) transaction.set(adminRef, admin);
    if (!workspaceSnapshot.exists()) transaction.set(workspaceRef, workspace);
    if (!sectorSnapshot.exists()) transaction.set(sectorRef, sectorAccount);
  });
}

/**
 * Cria workspace e conta de setor na mesma transação. Não permite sobrescrever
 * IDs ou e-mails já cadastrados.
 */
export async function createSectorWorkspace(
  input: CreateSectorWorkspaceInput,
  createdByEmail: string
): Promise<{ workspace: Workspace; account: SectorAccount }> {
  const now = new Date().toISOString();
  const workspaceId = normalizeWorkspaceId(input.workspaceId);
  const authorizedEmail = normalizePlatformEmail(input.authorizedEmail);
  const createdBy = normalizePlatformEmail(createdByEmail);

  if (!isValidWorkspaceId(workspaceId)) {
    throw new Error('O identificador do setor é inválido. Use letras minúsculas, números e hífens.');
  }
  if (!isValidPlatformEmail(authorizedEmail)) {
    throw new Error('Informe uma conta Google válida para o setor.');
  }
  if (authorizedEmail === BOOTSTRAP_PLATFORM_ADMIN_EMAIL) {
    throw new Error('A conta administrativa da plataforma não pode ser usada como conta operacional de setor.');
  }

  const workspace: Workspace = {
    id: workspaceId,
    name: input.workspaceName.trim(),
    status: 'active',
    authorizedEmail,
    institutionalProfile: {
      organizationName: input.organizationName.trim(),
      organizationShortName: input.organizationShortName?.trim() || undefined,
      sectionName: input.sectionName.trim(),
      defaultDeliveryLocation: input.defaultDeliveryLocation?.trim() || undefined,
      defaultResponsibleRole: input.defaultResponsibleRole?.trim() || undefined,
    },
    createdAt: now,
    updatedAt: now,
    createdBy,
  };

  const account: SectorAccount = {
    email: authorizedEmail,
    accountType: 'sector',
    workspaceId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    createdBy,
  };

  const validationErrors = [...validateWorkspace(workspace), ...validatePlatformAccount(account)];
  if (validationErrors.length > 0) {
    throw new Error(validationErrors[0]);
  }

  const workspaceRef = doc(db, WORKSPACES_COLLECTION, workspaceId);
  const accountRef = doc(db, PLATFORM_ACCOUNTS_COLLECTION, accountDocumentId(authorizedEmail));

  await runTransaction(db, async (transaction) => {
    const [workspaceSnapshot, accountSnapshot] = await Promise.all([
      transaction.get(workspaceRef),
      transaction.get(accountRef),
    ]);

    if (workspaceSnapshot.exists()) {
      throw new Error('Já existe um setor com este identificador.');
    }
    if (accountSnapshot.exists()) {
      throw new Error('Esta conta Google já está vinculada a um perfil do EMPROVEX.');
    }

    transaction.set(workspaceRef, workspace);
    transaction.set(accountRef, account);
  });

  return { workspace, account };
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
