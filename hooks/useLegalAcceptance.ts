'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  acceptCurrentLegalBundle,
  hasAcceptedCurrentLegalBundle,
  type LegalAcceptanceIdentity,
} from '../lib/legalAcceptance';

export type LegalAcceptanceStatus =
  | 'checking'
  | 'required'
  | 'accepted'
  | 'saving'
  | 'error';

export function useLegalAcceptance(identity: LegalAcceptanceIdentity) {
  const [status, setStatus] = useState<LegalAcceptanceStatus>('checking');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('checking');
    setError(null);

    try {
      const accepted = await hasAcceptedCurrentLegalBundle(identity);
      setStatus(accepted ? 'accepted' : 'required');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus('error');
    }
  }, [identity.email, identity.uid, identity.ug, identity.workspaceId]);

  useEffect(() => {
    let active = true;

    void hasAcceptedCurrentLegalBundle(identity)
      .then((accepted) => {
        if (!active) return;
        setError(null);
        setStatus(accepted ? 'accepted' : 'required');
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [identity.email, identity.uid, identity.ug, identity.workspaceId]);

  const accept = useCallback(async () => {
    setStatus('saving');
    setError(null);

    try {
      await acceptCurrentLegalBundle(identity);
      setStatus('accepted');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus('required');
      throw cause;
    }
  }, [identity.email, identity.uid, identity.ug, identity.workspaceId]);

  return {
    status,
    error,
    accepted: status === 'accepted',
    accept,
    refresh,
  };
}
