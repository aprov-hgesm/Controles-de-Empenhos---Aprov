'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';

import type { FirebaseGlobalUsageSnapshot } from '../lib/platformCapacity';

interface GlobalUsageApiSuccess {
  configured: true;
  snapshot: FirebaseGlobalUsageSnapshot;
  observedAt: string;
  dataThrough: string | null;
}

interface GlobalUsageApiError {
  code?: string;
  message?: string;
}

export function usePlatformAdminGlobalUsage(adminUser: User | null) {
  const [snapshot, setSnapshot] = useState<FirebaseGlobalUsageSnapshot | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [observedAt, setObservedAt] = useState<string | null>(null);
  const [dataThrough, setDataThrough] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestSequence.current;

    if (!adminUser) {
      setSnapshot(null);
      setConfigured(null);
      setObservedAt(null);
      setDataThrough(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await adminUser.getIdToken();
      const response = await fetch('/api/admin/firebase-global-usage', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const payload = await response.json() as GlobalUsageApiSuccess | GlobalUsageApiError;

      if (
        response.status === 503
        && 'code' in payload
        && payload.code === 'CLOUD_MONITORING_NOT_CONFIGURED'
      ) {
        if (requestSequence.current !== requestId) return;
        setSnapshot(null);
        setConfigured(false);
        setObservedAt(null);
        setDataThrough(null);
        return;
      }

      if (!response.ok || !('snapshot' in payload)) {
        throw new Error(
          ('message' in payload && payload.message)
            ? payload.message
            : 'Não foi possível consultar o consumo global real do Firebase.'
        );
      }

      if (requestSequence.current !== requestId) return;
      setSnapshot(payload.snapshot);
      setConfigured(true);
      setObservedAt(payload.observedAt);
      setDataThrough(payload.dataThrough);
    } catch (loadError) {
      if (requestSequence.current !== requestId) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível consultar o consumo global real do Firebase.'
      );
    } finally {
      if (requestSequence.current === requestId) setLoading(false);
    }
  }, [adminUser]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    snapshot,
    configured,
    observedAt,
    dataThrough,
    loading,
    error,
    refresh,
  };
}
