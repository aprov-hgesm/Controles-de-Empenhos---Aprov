'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';

import { db } from '../lib/firebase';
import {
  WORKSPACE_BACKUP_STATUS_COLLECTION,
  type WorkspaceBackupStatus,
} from '../lib/workspaceBackup';

export function usePlatformAdminBackups(adminUser: User | null) {
  const [statuses, setStatuses] = useState<WorkspaceBackupStatus[]>([]);
  const [loading, setLoading] = useState(Boolean(adminUser));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminUser) {
      setStatuses([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    return onSnapshot(
      collection(db, WORKSPACE_BACKUP_STATUS_COLLECTION),
      (snapshot) => {
        setStatuses(
          snapshot.docs
            .map((item) => item.data() as WorkspaceBackupStatus)
            .sort((a, b) => a.ug.localeCompare(b.ug))
        );
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setLoading(false);
        setError(snapshotError.message || 'Não foi possível carregar a saúde dos backups.');
      }
    );
  }, [adminUser]);

  const summary = useMemo(() => {
    const now = Date.now();
    const healthy = statuses.filter((status) => {
      const successAt = Date.parse(status.lastSuccessAt || '');
      return status.status === 'success'
        && Number.isFinite(successAt)
        && now - successAt < 36 * 60 * 60 * 1000;
    }).length;
    const failed = statuses.filter((status) => status.status === 'failed').length;
    return {
      totalTracked: statuses.length,
      healthy,
      overdue: Math.max(0, statuses.length - healthy),
      failed,
    };
  }, [statuses]);

  return { statuses, summary, loading, error };
}
