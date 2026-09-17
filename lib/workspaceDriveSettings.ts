'use client';

import { onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';

import {
  operationalScopeFromContext,
  operationalSettingsDocRef,
} from './operationalPaths';
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
      onChange(snapshot.data() as WorkspaceDriveSettings);
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
    accountEmail: context.email,
    rootFolderId: folders.rootFolderId,
    empenhosFolderId: folders.empenhosFolderId,
    invoicesFolderId: folders.invoicesFolderId,
    configuredAt: now,
    updatedAt: now,
  };

  await setDoc(ref, settings, { merge: false });
  return settings;
}
