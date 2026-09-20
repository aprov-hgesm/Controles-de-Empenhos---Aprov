'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';

import type { Workspace } from '../lib/platformIdentity';
import {
  loadPlatformWorkspaceUsage,
  type AdminWorkspaceUsageEstimate,
} from '../lib/platformAdminUsage';

export function usePlatformAdminUsage(
  adminUser: User | null,
  workspaces: Workspace[],
  directoryReady: boolean
) {
  const [usage, setUsage] = useState<AdminWorkspaceUsageEstimate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!adminUser?.email || !directoryReady) {
      setUsage([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setUsage(await loadPlatformWorkspaceUsage(workspaces));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar a telemetria estimada por UG.'
      );
    } finally {
      setLoading(false);
    }
  }, [adminUser, directoryReady, workspaces]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    usage,
    loading,
    error,
    refresh,
  };
}
