'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

import { db } from '../lib/firebase';
import {
  createWorkspaceBackup,
  listWorkspaceBackupHistory,
  planWorkspaceRestore,
  restoreWorkspaceBackupMissingOnly,
  WORKSPACE_BACKUP_STATUS_COLLECTION,
  type WorkspaceBackupStatus,
  type WorkspaceRestorePlan,
  type WorkspaceRestoreResult,
} from '../lib/workspaceBackup';
import type { WorkspaceBackupDriveFile } from '../lib/workspaceBackupDrive';
import type { WorkspaceGoogleDriveSession } from '../lib/googleDriveWorkspace';
import type { WorkspaceDriveSettings } from '../lib/workspaceDriveSettings';
import {
  isOperationalSectorContext,
  type ResolvedWorkspaceContext,
} from '../lib/workspaceContext';

interface UseWorkspaceBackupInput {
  user: User | null;
  workspaceContext: ResolvedWorkspaceContext;
  session: WorkspaceGoogleDriveSession | null;
  settings: WorkspaceDriveSettings | null;
}

export function useWorkspaceBackup({
  user,
  workspaceContext,
  session,
  settings,
}: UseWorkspaceBackupInput) {
  const [status, setStatus] = useState<WorkspaceBackupStatus | null>(null);
  const [history, setHistory] = useState<WorkspaceBackupDriveFile[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoAttemptKeyRef = useRef('');

  useEffect(() => {
    if (!isOperationalSectorContext(workspaceContext)) {
      setStatus(null);
      return;
    }

    return onSnapshot(
      doc(db, WORKSPACE_BACKUP_STATUS_COLLECTION, workspaceContext.workspaceId),
      (snapshot) => {
        setStatus(snapshot.exists() ? snapshot.data() as WorkspaceBackupStatus : null);
      },
      (snapshotError) => {
        setError(snapshotError.message || 'Não foi possível acompanhar o estado do backup.');
      }
    );
  }, [workspaceContext]);

  const refreshHistory = useCallback(async () => {
    if (!session || !settings || !isOperationalSectorContext(workspaceContext)) {
      setHistory([]);
      return [];
    }

    setLoadingHistory(true);
    setError(null);
    try {
      const files = await listWorkspaceBackupHistory({
        context: workspaceContext,
        session,
        settings,
      });
      setHistory(files);
      return files;
    } catch (historyError) {
      const message = historyError instanceof Error
        ? historyError.message
        : 'Não foi possível listar os backups no Google Drive.';
      setError(message);
      throw historyError;
    } finally {
      setLoadingHistory(false);
    }
  }, [session, settings, workspaceContext]);

  const createBackup = useCallback(async (trigger: 'manual' | 'automatic' = 'manual') => {
    if (!user || !session || !settings || !isOperationalSectorContext(workspaceContext)) {
      throw new Error('Conecte o Google Drive deste workspace antes de gerar o backup.');
    }

    setBackingUp(true);
    if (trigger === 'manual') setError(null);
    try {
      const result = await createWorkspaceBackup({
        user,
        context: workspaceContext,
        session,
        settings,
        trigger,
      });
      setStatus(result.status);
      await refreshHistory();
      return result;
    } catch (backupError) {
      const message = backupError instanceof Error
        ? backupError.message
        : 'Não foi possível gerar o backup do workspace.';
      if (!message.includes('Já existe um backup')) setError(message);
      throw backupError;
    } finally {
      setBackingUp(false);
    }
  }, [refreshHistory, session, settings, user, workspaceContext]);

  useEffect(() => {
    if (!user || !session || !settings || !isOperationalSectorContext(workspaceContext)) return;

    const dayKey = new Date().toISOString().slice(0, 10);
    const attemptKey = `${workspaceContext.workspaceId}:${dayKey}:${session.connectedAt}`;
    if (autoAttemptKeyRef.current === attemptKey) return;
    autoAttemptKeyRef.current = attemptKey;

    void createBackup('automatic').catch(() => undefined);
  }, [createBackup, session, settings, user, workspaceContext]);

  useEffect(() => {
    if (!session || !settings || !isOperationalSectorContext(workspaceContext)) {
      setHistory([]);
      return;
    }
    void refreshHistory().catch(() => undefined);
  }, [refreshHistory, session, settings, workspaceContext]);

  const simulateRestore = useCallback(async (fileId: string): Promise<WorkspaceRestorePlan> => {
    if (!session || !isOperationalSectorContext(workspaceContext)) {
      throw new Error('Reconecte o Google Drive antes de validar este backup.');
    }
    setError(null);
    try {
      return await planWorkspaceRestore({
        context: workspaceContext,
        session,
        fileId,
      });
    } catch (planError) {
      const message = planError instanceof Error
        ? planError.message
        : 'Não foi possível validar o backup.';
      setError(message);
      throw planError;
    }
  }, [session, workspaceContext]);

  const restoreMissing = useCallback(async (fileId: string): Promise<WorkspaceRestoreResult> => {
    if (!user || !session || !isOperationalSectorContext(workspaceContext)) {
      throw new Error('Reconecte o Google Drive antes de restaurar este backup.');
    }

    setRestoring(true);
    setError(null);
    try {
      const result = await restoreWorkspaceBackupMissingOnly({
        user,
        context: workspaceContext,
        session,
        fileId,
      });
      return result;
    } catch (restoreError) {
      const message = restoreError instanceof Error
        ? restoreError.message
        : 'Não foi possível restaurar o backup.';
      setError(message);
      throw restoreError;
    } finally {
      setRestoring(false);
    }
  }, [session, user, workspaceContext]);

  return {
    status,
    history,
    loadingHistory,
    backingUp,
    restoring,
    error,
    refreshHistory,
    createBackup,
    simulateRestore,
    restoreMissing,
    clearError: () => setError(null),
  };
}
