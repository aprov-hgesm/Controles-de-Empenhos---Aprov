'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  const requestSequence = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestSequence.current;

    if (!adminUser?.email || !directoryReady) {
      setUsage([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextUsage = await loadPlatformWorkspaceUsage(workspaces);
      if (requestSequence.current !== requestId) return;
      setUsage(nextUsage);
    } catch (loadError) {
      if (requestSequence.current !== requestId) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar a telemetria estimada por UG.'
      );
    } finally {
      if (requestSequence.current === requestId) setLoading(false);
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
