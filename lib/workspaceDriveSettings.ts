'use client';

import { getDoc, setDoc } from 'firebase/firestore';

import {
  operationalScopeFromContext,
  operationalSettingsDocRef,
} from './operationalPaths';
import { normalizePlatformEmail } from './platformIdentity';
import type { SectorWorkspaceContext } from './workspaceContext';
import {
  assertWorkspaceGoogleDriveSessionActive,
  type WorkspaceGoogleDriveFolders,
  type WorkspaceGoogleDriveSession,
} from './googleDriveWorkspace';

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

function assertAuthorizedDriveSession(
  context: SectorWorkspaceContext,
  session: WorkspaceGoogleDriveSession
): void {
  assertWorkspaceGoogleDriveSessionActive(session);
  const expectedEmail = normalizePlatformEmail(context.email);
  const sessionEmail = normalizePlatformEmail(session.email);

  if (
    session.workspaceId !== context.workspaceId
    || sessionEmail !== expectedEmail
    || !session.accessToken
  ) {
    throw new Error('A sessão Google Drive não pertence ao workspace autenticado.');
  }
}

export async function loadWorkspaceDriveSettings(
  context: SectorWorkspaceContext
): Promise<WorkspaceDriveSettings | null> {
  const scope = operationalScopeFromContext(context);
  const ref = operationalSettingsDocRef(scope, WORKSPACE_DOCUMENT_STORAGE_SETTINGS_ID);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;
  return assertWorkspaceDriveSettings(context, snapshot.data());
}

export async function saveWorkspaceDriveSettings(
  context: SectorWorkspaceContext,
  session: WorkspaceGoogleDriveSession,
  folders: WorkspaceGoogleDriveFolders,
  existingSettings?: WorkspaceDriveSettings | null
): Promise<WorkspaceDriveSettings> {
  assertAuthorizedDriveSession(context, session);

  const scope = operationalScopeFromContext(context);
  const ref = operationalSettingsDocRef(scope, WORKSPACE_DOCUMENT_STORAGE_SETTINGS_ID);
  const now = new Date().toISOString();

  const settings: WorkspaceDriveSettings = {
    provider: 'google-drive',
    status: 'configured',
    workspaceId: context.workspaceId,
    accountEmail: normalizePlatformEmail(session.email),
    rootFolderId: folders.rootFolderId,
    empenhosFolderId: folders.empenhosFolderId,
    invoicesFolderId: folders.invoicesFolderId,
    configuredAt: existingSettings?.configuredAt || now,
    updatedAt: now,
  };

  await setDoc(ref, settings, { merge: false });
  return settings;
}
