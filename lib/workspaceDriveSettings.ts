'use client';

import { onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';

import {
  operationalScopeFromContext,
  operationalSettingsDocRef,
} from './operationalPaths';
import { normalizePlatformEmail } from './platformIdentity';
import type { SectorWorkspaceContext } from './workspaceContext';
import type { WorkspaceGoogleDriveFolders } from './googleDriveWorkspace';

export const WORKSPACE_DOCUMENT_STORAGE_SETTINGS_ID = 'documentStorage';

export interface WorkspaceDriveSettings {
  provider: 'google-drive';
  status: 'configured';
  workspaceId: string;
  accountEmail: string;
  rootFolderId: string;
  empenhosFolderId: string;
  invoicesFolderId: string;
  configuredAt: string;
  updatedAt: string;
}

function assertWorkspaceDriveSettings(
  context: SectorWorkspaceContext,
  value: unknown
): WorkspaceDriveSettings {
  if (!value || typeof value !== 'object') {
    throw new Error('A configuração do Google Drive deste workspace é inválida.');
  }

  const settings = value as Partial<WorkspaceDriveSettings>;
  const expectedEmail = normalizePlatformEmail(context.email);
  const storedEmail = normalizePlatformEmail(settings.accountEmail || '');
  const validFolderIds = [
    settings.rootFolderId,
    settings.empenhosFolderId,
    settings.invoicesFolderId,
  ].every((folderId) => typeof folderId === 'string' && folderId.length > 5);

  if (
    settings.provider !== 'google-drive'
    || settings.status !== 'configured'
    || settings.workspaceId !== context.workspaceId
    || storedEmail !== expectedEmail
    || !validFolderIds
    || typeof settings.configuredAt !== 'string'
    || typeof settings.updatedAt !== 'string'
  ) {
    throw new Error('A configuração do Google Drive não pertence ao workspace autenticado ou está incompleta.');
  }

  return settings as WorkspaceDriveSettings;
}

export function subscribeWorkspaceDriveSettings(
  context: SectorWorkspaceContext,
  onChange: (settings: WorkspaceDriveSettings | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const scope = operationalScopeFromContext(context);
  const ref = operationalSettingsDocRef(scope, WORKSPACE_DOCUMENT_STORAGE_SETTINGS_ID);

  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }

      try {
        onChange(assertWorkspaceDriveSettings(context, snapshot.data()));
      } catch (validationError) {
        onChange(null);
        onError(
          validationError instanceof Error
            ? validationError
            : new Error('Falha ao validar a configuração do Google Drive.')
        );
      }
    },
    (error) => onError(error)
  );
}

export async function saveWorkspaceDriveSettings(
  context: SectorWorkspaceContext,
  folders: WorkspaceGoogleDriveFolders
): Promise<WorkspaceDriveSettings> {
  const scope = operationalScopeFromContext(context);
  const ref = operationalSettingsDocRef(scope, WORKSPACE_DOCUMENT_STORAGE_SETTINGS_ID);
  const now = new Date().toISOString();

  const settings: WorkspaceDriveSettings = {
    provider: 'google-drive',
    status: 'configured',
    workspaceId: context.workspaceId,
    accountEmail: normalizePlatformEmail(context.email),
    rootFolderId: folders.rootFolderId,
    empenhosFolderId: folders.empenhosFolderId,
    invoicesFolderId: folders.invoicesFolderId,
    configuredAt: now,
    updatedAt: now,
  };

  await setDoc(ref, settings, { merge: false });
  return settings;
}
