'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';

import type {
  BillingAccount,
  BillingAccountStatus,
  BillingCycle,
  BillingCycleStatus,
  PlatformBillingConfig,
} from '../lib/billing';
import type { Workspace } from '../lib/platformIdentity';
import {
  ensurePlatformBillingFoundation,
  grantBillingTrial,
  setBillingCommercialStatus,
  setBillingCycleStatus,
  subscribePlatformBillingAccounts,
  subscribePlatformBillingConfig,
  subscribePlatformBillingCycles,
  updatePlatformBillingConfig,
  type UpdatePlatformBillingConfigInput,
} from '../lib/platformBillingStore';

function describeBillingError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';

  if (code.includes('permission-denied')) {
    return 'O Firestore recusou a operação de cobrança. Verifique as Rules publicadas e a sessão administrativa.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Não foi possível atualizar o controle administrativo de assinaturas.';
}

export function usePlatformAdminBilling(
  adminUser: User | null,
  workspaces: Workspace[],
  directoryReady: boolean
) {
  const adminEmail = adminUser?.email || null;
  const [config, setConfig] = useState<PlatformBillingConfig | null>(null);
  const [accounts, setAccounts] = useState<BillingAccount[]>([]);
  const [cycles, setCycles] = useState<BillingCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);
  const foundationSignatureRef = useRef<string>('');

  useEffect(() => {
    if (!adminEmail) {
      setConfig(null);
      setAccounts([]);
      setCycles([]);
      setLoading(false);
      return;
    }

    let configReady = false;
    let accountsReady = false;
    let cyclesReady = false;
    const settle = () => {
      if (configReady && accountsReady && cyclesReady) setLoading(false);
    };
    const fail = (subscriptionError: unknown) => {
      setError(describeBillingError(subscriptionError));
      setLoading(false);
    };

    setLoading(true);
    setError(null);

    const unsubscribers = [
      subscribePlatformBillingConfig((next) => {
        configReady = true;
        setConfig(next);
        settle();
      }, fail),
      subscribePlatformBillingAccounts((next) => {
        accountsReady = true;
        setAccounts(next);
        settle();
      }, fail),
      subscribePlatformBillingCycles((next) => {
        cyclesReady = true;
        setCycles(next);
        settle();
      }, fail),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [adminEmail]);

  useEffect(() => {
    if (!adminEmail || !directoryReady || workspaces.length === 0) return;

    const signature = workspaces
      .map((workspace) => `${workspace.id}:${workspace.updatedAt}`)
      .sort()
      .join('|');
    if (foundationSignatureRef.current === signature) return;
    foundationSignatureRef.current = signature;

    void ensurePlatformBillingFoundation(workspaces, adminEmail).catch((foundationError) => {
      foundationSignatureRef.current = '';
      setError(describeBillingError(foundationError));
    });
  }, [adminEmail, directoryReady, workspaces]);

  const accountsByWorkspace = useMemo(
    () => new Map(accounts.map((account) => [account.workspaceId, account])),
    [accounts]
  );

  const cyclesByWorkspace = useMemo(() => {
    const result = new Map<string, BillingCycle[]>();
    for (const cycle of cycles) {
      const current = result.get(cycle.workspaceId) || [];
      current.push(cycle);
      result.set(cycle.workspaceId, current);
    }
    for (const value of result.values()) {
      value.sort((a, b) => b.referenceMonth.localeCompare(a.referenceMonth));
    }
    return result;
  }, [cycles]);

  const runMutation = useCallback(async <T,>(
    key: string,
    mutation: () => Promise<T>
  ): Promise<T> => {
    setMutatingKey(key);
    setError(null);
    try {
      return await mutation();
    } catch (mutationError) {
      const message = describeBillingError(mutationError);
      setError(message);
      throw new Error(message);
    } finally {
      setMutatingKey(null);
    }
  }, []);

  const updateConfig = useCallback((
    input: UpdatePlatformBillingConfigInput
  ) => {
    if (!adminEmail) throw new Error('Sessão administrativa inválida.');
    return runMutation('config', () => updatePlatformBillingConfig(input, adminEmail));
  }, [adminEmail, runMutation]);

  const grantTrial = useCallback((
    workspace: Workspace,
    trialDays?: number
  ) => {
    if (!adminEmail) throw new Error('Sessão administrativa inválida.');
    return runMutation(
      `trial:${workspace.id}`,
      () => grantBillingTrial(workspace, adminEmail, trialDays)
    );
  }, [adminEmail, runMutation]);

  const setStatus = useCallback((
    workspace: Workspace,
    status: Exclude<BillingAccountStatus, 'exempt'>
  ) => {
    if (!adminEmail) throw new Error('Sessão administrativa inválida.');
    return runMutation(
      `status:${workspace.id}`,
      () => setBillingCommercialStatus(workspace, status, adminEmail)
    );
  }, [adminEmail, runMutation]);

  const setCycleStatus = useCallback((
    workspace: Workspace,
    referenceMonth: string,
    status: BillingCycleStatus,
    note = ''
  ) => {
    if (!adminEmail || !config) throw new Error('Configuração de cobrança indisponível.');
    const account = accountsByWorkspace.get(workspace.id);
    if (!account) throw new Error('A assinatura deste workspace ainda não foi materializada.');

    return runMutation(
      `cycle:${workspace.id}:${referenceMonth}`,
      () => setBillingCycleStatus(
        workspace,
        account,
        config,
        referenceMonth,
        status,
        adminEmail,
        note
      )
    );
  }, [accountsByWorkspace, adminEmail, config, runMutation]);

  return {
    config,
    accounts,
    cycles,
    accountsByWorkspace,
    cyclesByWorkspace,
    loading,
    error,
    mutatingKey,
    updateConfig,
    grantTrial,
    setStatus,
    setCycleStatus,
  };
}
