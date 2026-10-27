'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  grantBillingTrial,
  offerProgressiveBilling,
  prepareBillingEnforcement,
  resolveBillingRefund, recoverBillingCheckout,
  setBillingCommercialStatus,
  setBillingExemption,
  setBillingCycleStatus,
  getPlatformBillingDirectory,
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
  _workspaces: Workspace[],
  _directoryReady: boolean
) {
  const adminEmail = adminUser?.email || null;
  const [config, setConfig] = useState<PlatformBillingConfig | null>(null);
  const [accounts, setAccounts] = useState<BillingAccount[]>([]);
  const [cycles, setCycles] = useState<BillingCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);

  // No Firestore listener and no implicit price migration on page load.
  const refresh = useCallback(async (): Promise<void> => {
    const directory = await getPlatformBillingDirectory();
    setConfig(directory.config);
    setAccounts(directory.accounts);
    setCycles(directory.cycles);
  }, []);

  useEffect(() => {
    if (!adminEmail) {
      setConfig(null); setAccounts([]); setCycles([]); setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void getPlatformBillingDirectory()
      .then((directory) => {
        if (!active) return;
        setConfig(directory.config);
        setAccounts(directory.accounts);
        setCycles(directory.cycles);
      })
      .catch((reason) => { if (active) setError(describeBillingError(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [adminEmail]);

  // Passive inbox refresh: no automatic mutations, client data is not cached indefinitely.
  useEffect(() => {
    if (!adminEmail) return;
    const id = setInterval(() => { void refresh().catch(() => undefined); }, 60_000);
    return () => clearInterval(id);
  }, [adminEmail, refresh]);

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
      const result = await mutation();
      // Refresh is read-only; don't disguise a successful commit if it fails.
      await refresh().catch((reason) => setError(describeBillingError(reason)));
      return result;
    } catch (mutationError) {
      const message = describeBillingError(mutationError);
      setError(message);
      throw new Error(message);
    } finally {
      setMutatingKey(null);
    }
  }, [refresh]);

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

  const prepareEnforcement = useCallback(() => {
    if (!adminEmail) throw new Error('Sessão administrativa inválida.');
    return runMutation('prepare-enforcement', () => prepareBillingEnforcement(adminEmail));
  }, [adminEmail, runMutation]);

  const resolveRefund = useCallback((workspace: Workspace, note: string) => {
    if (!adminEmail) throw new Error('Sessão administrativa inválida.');
    return runMutation(`refund:${workspace.id}`, () => resolveBillingRefund(workspace, note, adminEmail));
  }, [adminEmail, runMutation]);
  const recoverCheckout = useCallback((workspace: Workspace, month: string, note: string) => {
    if (!adminEmail) throw new Error('Sessão administrativa inválida.');
    return runMutation(`checkout:${workspace.id}:${month}`,
      () => recoverBillingCheckout(workspace, month, note, adminEmail));
  }, [adminEmail, runMutation]);

  const offerRamp = useCallback((workspace: Workspace) => {
    if (!adminEmail) throw new Error('Sessão administrativa inválida.');
    return runMutation(`offer-ramp:${workspace.id}`, () => offerProgressiveBilling(workspace, adminEmail));
  }, [adminEmail, runMutation]);

  const setExemption = useCallback((
    workspace: Workspace,
    exempt: boolean
  ) => {
    if (!adminEmail) throw new Error('Sessão administrativa inválida.');
    return runMutation(
      `exempt:${workspace.id}`,
      () => setBillingExemption(workspace, exempt, adminEmail)
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
    offerRamp,
    resolveRefund,
    recoverCheckout,
    prepareEnforcement,
    setExemption,
    setStatus,
    setCycleStatus,
  };
}
