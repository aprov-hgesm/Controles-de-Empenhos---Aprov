'use client';

import type { WorkspaceGoogleDriveSession } from './googleDriveWorkspace';
import type { WorkspaceDriveSettings } from './workspaceDriveSettings';

export interface WorkspaceDriveRuntime {
  session: WorkspaceGoogleDriveSession;
  settings: WorkspaceDriveSettings;
}

let activeRuntime: WorkspaceDriveRuntime | null = null;

/**
 * Mantém a autorização do Drive somente em memória do módulo. Nunca persiste
 * access token em storage do navegador ou Firestore.
 */
export function setWorkspaceDriveRuntime(runtime: WorkspaceDriveRuntime): void {
  if (runtime.session.workspaceId !== runtime.settings.workspaceId) {
    throw new Error('Sessão e configuração do Google Drive pertencem a workspaces diferentes.');
  }
  activeRuntime = runtime;
}

export function clearWorkspaceDriveRuntime(): void {
  activeRuntime = null;
}

export function getWorkspaceDriveRuntime(): WorkspaceDriveRuntime | null {
  return activeRuntime;
}

export function requireWorkspaceDriveRuntime(expectedWorkspaceId?: string): WorkspaceDriveRuntime {
  if (!activeRuntime) {
    throw new Error('Google Drive desconectado. Reconecte o Drive do setor antes de acessar documentos.');
  }
  if (expectedWorkspaceId && activeRuntime.session.workspaceId !== expectedWorkspaceId) {
    throw new Error('A sessão do Google Drive pertence a outro workspace. Reconecte a conta correta.');
  }
  return activeRuntime;
}
