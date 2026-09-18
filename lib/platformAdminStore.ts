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
import {
  createInitialWorkspaceTermCounter,
  WORKSPACE_TERM_COUNTER_SETTINGS_ID,
} from './workspaceProvisioning';

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
 * Cria workspace, conta de setor e o estado operacional mínimo na mesma transação.
 * O contador de Termos de Recebimento nasce em zero; Drive e documentos somente
 * são materializados pelo próprio setor nas etapas de onboarding correspondentes.
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
  if (authorizedEmail === HGESM_SECTOR_EMAIL) {
    throw new Error('A conta institucional fundadora já está vinculada ao workspace HGeSM.');
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
  const termCounterRef = doc(
    db,
    WORKSPACES_COLLECTION,
    workspaceId,
    'settings',
    WORKSPACE_TERM_COUNTER_SETTINGS_ID
  );
  const initialTermCounter = createInitialWorkspaceTermCounter();

  await runTransaction(db, async (transaction) => {
    const [workspaceSnapshot, accountSnapshot, termCounterSnapshot] = await Promise.all([
      transaction.get(workspaceRef),
      transaction.get(accountRef),
      transaction.get(termCounterRef),
    ]);

    if (workspaceSnapshot.exists()) {
      throw new Error('Já existe um setor com este identificador.');
    }
    if (accountSnapshot.exists()) {
      throw new Error('Esta conta Google já está vinculada a um perfil do EMPROVEX.');
    }
    if (termCounterSnapshot.exists()) {
      throw new Error('Já existe configuração operacional residual para este identificador de setor.');
    }

    // Bloco 17: diretório administrativo e estado operacional mínimo nascem
    // atomicamente. As demais coleções permanecem vazias e o Google Drive só é
    // materializado quando o próprio setor concluir o onboarding do Bloco 18.
    transaction.set(workspaceRef, workspace);
    transaction.set(accountRef, account);
    transaction.set(termCounterRef, initialTermCounter);
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
