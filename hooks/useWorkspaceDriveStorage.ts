'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';

import {
  connectGoogleDriveForWorkspace,
  ensureWorkspaceGoogleDriveFolders,
  type WorkspaceGoogleDriveSession,
} from '../lib/googleDriveWorkspace';
import {
  saveWorkspaceDriveSettings,
  subscribeWorkspaceDriveSettings,
  type WorkspaceDriveSettings,
} from '../lib/workspaceDriveSettings';
import {
  clearWorkspaceDriveRuntime,
  setWorkspaceDriveRuntime,
} from '../lib/workspaceDriveRuntime';
import {
  isOperationalSectorContext,
  type ResolvedWorkspaceContext,
} from '../lib/workspaceContext';

export type WorkspaceDriveRuntimeStatus =
  | 'unavailable'
  | 'loading'
  | 'not-configured'
  | 'configured-disconnected'
  | 'connected';

export function useWorkspaceDriveStorage(
  user: User | null,
  workspaceContext: ResolvedWorkspaceContext
) {
  const [settings, setSettings] = useState<WorkspaceDriveSettings | null>(null);
  const [session, setSession] = useState<WorkspaceGoogleDriveSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSession(null);
    setError(null);
    clearWorkspaceDriveRuntime();

    if (!user || !isOperationalSectorContext(workspaceContext)) {
      setSettings(null);
      setSettingsLoading(false);
      return;
    }

    setSettingsLoading(true);
    const unsubscribe = subscribeWorkspaceDriveSettings(
      workspaceContext,
      (nextSettings) => {
        setSettings(nextSettings);
        setSettingsLoading(false);
      },
      (subscriptionError) => {
        setError(subscriptionError.message || 'Falha ao carregar a configuração do Google Drive.');
        setSettingsLoading(false);
      }
    );

    return () => {
      unsubscribe();
      clearWorkspaceDriveRuntime();
    };
  }, [settings, user, workspaceContext]);

  const connect = useCallback(async () => {
    if (!user || !isOperationalSectorContext(workspaceContext)) {
      throw new Error('Não existe um workspace operacional ativo para conectar ao Google Drive.');
    }

    setLoading(true);
    setError(null);
    try {
      const connectedSession = await connectGoogleDriveForWorkspace(user, workspaceContext);
      const folders = await ensureWorkspaceGoogleDriveFolders(connectedSession);
      const savedSettings = await saveWorkspaceDriveSettings(
        workspaceContext,
        connectedSession,
        folders,
        settings
      );
      setSession(connectedSession);
      setSettings(savedSettings);
      setWorkspaceDriveRuntime({ session: connectedSession, settings: savedSettings });
      return { session: connectedSession, settings: savedSettings };
    } catch (connectionError) {
      clearWorkspaceDriveRuntime();
      const message = connectionError instanceof Error
        ? connectionError.message
        : 'Falha ao conectar o Google Drive deste workspace.';
      setError(message);
      throw connectionError;
    } finally {
      setLoading(false);
    }
  }, [user, workspaceContext]);

  const disconnect = useCallback(() => {
    clearWorkspaceDriveRuntime();
    setSession(null);
    setError(null);
  }, []);

  const status: WorkspaceDriveRuntimeStatus = !user || !isOperationalSectorContext(workspaceContext)
    ? 'unavailable'
    : settingsLoading
      ? 'loading'
      : session
        ? 'connected'
        : settings
          ? 'configured-disconnected'
          : 'not-configured';

  return {
    settings,
    session,
    status,
    loading,
    error,
    connect,
    disconnect,
    clearError: () => setError(null),
  };
}
