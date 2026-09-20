'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { auth } from '../lib/firebase';
import type { UsageAlertPolicy } from '../lib/usageAlerts';

interface UsageAlertPolicyResponse {
  configured: true;
  policy: UsageAlertPolicy;
}

interface UsageAlertPolicyError {
  code?: string;
  message?: string;
}

export function usePlatformAdminUsageAlertPolicy() {
  const [policy, setPolicy] = useState<UsageAlertPolicy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestSequence.current;
    const user = auth.currentUser;
    if (!user) {
      setPolicy(null);
      setLoading(false);
      setError('Sessão administrativa indisponível para carregar os alertas de consumo.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/usage-alert-policy', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const payload = await response.json() as UsageAlertPolicyResponse | UsageAlertPolicyError;
      if (!response.ok || !('policy' in payload)) {
        throw new Error(
          ('message' in payload && payload.message)
            ? payload.message
            : 'Não foi possível carregar as referências dos alertas de consumo.'
        );
      }

      if (requestSequence.current !== requestId) return;
      setPolicy(payload.policy);
    } catch (loadError) {
      if (requestSequence.current !== requestId) return;
      setPolicy(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar as referências dos alertas de consumo.'
      );
    } finally {
      if (requestSequence.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    policy,
    loading,
    error,
    refresh,
  };
}
