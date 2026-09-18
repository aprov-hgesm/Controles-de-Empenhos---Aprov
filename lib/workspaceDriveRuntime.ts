'use client';

import {
  isWorkspaceGoogleDriveSessionExpired,
  WORKSPACE_DRIVE_RECONNECT_REQUIRED_MESSAGE,
  type WorkspaceGoogleDriveSession,
} from './googleDriveWorkspace';
import type { WorkspaceDriveSettings } from './workspaceDriveSettings';

export interface WorkspaceDriveRuntime {
  session: WorkspaceGoogleDriveSession;
  settings: WorkspaceDriveSettings;
}

export type WorkspaceDriveRuntimeClearReason = 'manual' | 'context-change' | 'expired';

type WorkspaceDriveRuntimeListener = (
  runtime: WorkspaceDriveRuntime | null,
  reason: 'set' | WorkspaceDriveRuntimeClearReason
) => void;

let activeRuntime: WorkspaceDriveRuntime | null = null;
const listeners = new Set<WorkspaceDriveRuntimeListener>();

function emitRuntimeChange(reason: 'set' | WorkspaceDriveRuntimeClearReason): void {
  for (const listener of listeners) {
    listener(activeRuntime, reason);
  }
}

/**
 * Mantém a autorização do Drive somente em memória do módulo. Nunca persiste
 * access token em storage do navegador ou Firestore.
 */
export function setWorkspaceDriveRuntime(runtime: WorkspaceDriveRuntime): void {
  if (runtime.session.workspaceId !== runtime.settings.workspaceId) {
    throw new Error('Sessão e configuração do Google Drive pertencem a workspaces diferentes.');
  }
  if (isWorkspaceGoogleDriveSessionExpired(runtime.session)) {
    throw new Error(WORKSPACE_DRIVE_RECONNECT_REQUIRED_MESSAGE);
  }
  activeRuntime = runtime;
  emitRuntimeChange('set');
}

export function clearWorkspaceDriveRuntime(
  reason: WorkspaceDriveRuntimeClearReason = 'manual'
): void {
  activeRuntime = null;
  emitRuntimeChange(reason);
}

export function subscribeWorkspaceDriveRuntime(
  listener: WorkspaceDriveRuntimeListener
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWorkspaceDriveRuntime(): WorkspaceDriveRuntime | null {
  if (activeRuntime && isWorkspaceGoogleDriveSessionExpired(activeRuntime.session)) {
    clearWorkspaceDriveRuntime('expired');
    return null;
  }
  return activeRuntime;
}

export function requireWorkspaceDriveRuntime(expectedWorkspaceId?: string): WorkspaceDriveRuntime {
  if (!activeRuntime) {
    throw new Error('Google Drive desconectado. Reconecte o Drive do setor antes de acessar documentos.');
  }
  if (isWorkspaceGoogleDriveSessionExpired(activeRuntime.session)) {
    clearWorkspaceDriveRuntime('expired');
    throw new Error(WORKSPACE_DRIVE_RECONNECT_REQUIRED_MESSAGE);
  }
  if (expectedWorkspaceId && activeRuntime.session.workspaceId !== expectedWorkspaceId) {
    throw new Error('A sessão do Google Drive pertence a outro workspace. Reconecte a conta correta.');
  }
  return activeRuntime;
}
