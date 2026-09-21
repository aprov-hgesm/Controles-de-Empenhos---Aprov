'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { db } from '../lib/firebase';
import type { BillingAccount } from '../lib/billing';
import type { ResolvedWorkspaceContext } from '../lib/workspaceContext';

export function useWorkspaceBillingAccount(
  workspaceContext: ResolvedWorkspaceContext
) {
  const workspaceId = workspaceContext.status === 'sector'
    ? workspaceContext.workspaceId
    : null;
  const [account, setAccount] = useState<BillingAccount | null>(null);
  const [loading, setLoading] = useState(Boolean(workspaceId));

  useEffect(() => {
    if (!workspaceId) {
      setAccount(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, 'billingAccounts', workspaceId),
      (snapshot) => {
        setAccount(snapshot.exists() ? snapshot.data() as BillingAccount : null);
        setLoading(false);
      },
      (error) => {
        console.warn('Não foi possível consultar o estado comercial do workspace.', error);
        setAccount(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [workspaceId]);

  return { account, loading };
}
