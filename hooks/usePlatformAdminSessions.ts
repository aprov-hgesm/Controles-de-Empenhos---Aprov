'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';

import {
  subscribePlatformAdminSessions,
  terminatePlatformWorkspaceSession,
  type AdminWorkspaceSession,
} from '../lib/platformAdminSessions';

export function usePlatformAdminSessions(adminUser: User | null) {
  const [sessions, setSessions] = useState<AdminWorkspaceSession[]>([]);
  const [loading, setLoading] = useState(Boolean(adminUser));
  const [error, setError] = useState<string | null>(null);
  const [terminatingSessionId, setTerminatingSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!adminUser?.email) {
      setSessions([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribePlatformAdminSessions(
      (nextSessions) => {
        setSessions(nextSessions);
        setLoading(false);
        setError(null);
      },
      (subscriptionError) => {
        setLoading(false);
        setError(subscriptionError.message || 'Não foi possível carregar as sessões ativas.');
      }
    );

    return unsubscribe;
  }, [adminUser]);

  const terminateSession = useCallback(async (session: AdminWorkspaceSession) => {
    if (!adminUser?.email) {
      throw new Error('Sessão administrativa inválida.');
    }

    setTerminatingSessionId(session.sessionId);
    setError(null);
    try {
      await terminatePlatformWorkspaceSession(session, adminUser.email);
    } catch (terminationError) {
      const message = terminationError instanceof Error
        ? terminationError.message
        : 'Não foi possível encerrar a sessão.';
      setError(message);
      throw new Error(message);
    } finally {
      setTerminatingSessionId(null);
    }
  }, [adminUser]);

  return {
    sessions,
    loading,
    error,
    terminatingSessionId,
    terminateSession,
  };
}
