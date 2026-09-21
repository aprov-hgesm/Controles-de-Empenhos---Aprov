'use client';

import { type ReactNode } from 'react';
import { Loader2, Menu, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { auth } from '../../lib/firebase';
import { hasDualProfileAccess, setActiveProfileMode } from '../../lib/profileMode';
import type { ResolvedWorkspaceContext } from '../../lib/workspaceContext';
import { WorkspaceDriveControl } from './WorkspaceDriveControl';
import { AppShellLogo } from './chrome/AppShellLogo';
import { AppShellSignature } from './chrome/AppShellSignature';
import { useWorkspaceBillingAccount } from '../../hooks/useWorkspaceBillingAccount';
import { calculateTrialDaysRemaining, isTrialExpired } from '../../lib/billing';

interface AppHeaderProps {
  customLogo: string | null;
  syncing: boolean;
  userDisplayName: string;
  driveControl?: ReactNode;
  workspaceContext: ResolvedWorkspaceContext;
  onOpenSidebar: () => void;
}

export function AppHeader({
  customLogo,
  syncing,
  userDisplayName,
  driveControl,
  workspaceContext,
  onOpenSidebar,
}: AppHeaderProps) {
  const router = useRouter();
  const currentUser = auth.currentUser;
  const currentEmail = currentUser?.email || null;
  const canSwitchProfile = hasDualProfileAccess(currentEmail);
  const { account: billingAccount } = useWorkspaceBillingAccount(workspaceContext);
  const trialExpired = billingAccount?.status === 'trial'
    ? isTrialExpired(billingAccount)
    : false;
  const trialDaysRemaining = billingAccount?.status === 'trial'
    ? calculateTrialDaysRemaining(billingAccount)
    : null;
  const resolvedDriveControl = driveControl ?? (
    <WorkspaceDriveControl
      user={currentUser}
      workspaceContext={workspaceContext}
    />
  );

  const openAdministration = () => {
    if (!canSwitchProfile) return;
    setActiveProfileMode('platformAdmin');
    router.push('/admin');
  };

  return (
    <header className="emprovex-app-header fixed top-0 z-40 flex h-16 w-full items-center justify-between px-4 transition-all duration-300 sm:px-6">
      <AppShellSignature variant="header" />
      <div className="emprovex-header-brand-zone flex items-center gap-4">
        <button
          onClick={onOpenSidebar}
          className="emprovex-header-menu lg:hidden p-1.5 rounded-lg active:scale-95 duration-150 transition-all"
          id="menu-toggle-btn"
          aria-label="Abrir menu principal"
          title="Abrir menu principal"
        >
          <Menu className="w-6 h-6" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2.5">
          <AppShellLogo customLogo={customLogo} />

          <div className="emprovex-header-brand-copy flex flex-col">
            <span className="emprovex-header-brand-kicker hidden font-mono text-[8px] font-bold uppercase tracking-[0.22em] sm:block">
              Central Operacional
            </span>
            <h1 className="emprovex-header-brand-title font-extrabold text-base sm:text-lg tracking-wider uppercase font-montserrat leading-none">
              EMPROVEX
            </h1>
            <span className="emprovex-header-brand-subtitle text-[9px] sm:text-[10px] font-bold tracking-wider uppercase font-montserrat mt-0.5">
              Gestão Logística e Financeira
            </span>
          </div>
        </div>
      </div>

      <div className="emprovex-header-controls flex items-center gap-2 sm:gap-3">
        {syncing && (
          <div
            role="status"
            aria-live="polite"
            className="emprovex-header-control emprovex-header-control--sync"
          >
            <Loader2 className="emprovex-header-control__icon h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            <span className="hidden sm:inline">Sincronizando</span>
            <span className="emprovex-header-control__dot" aria-hidden="true" />
          </div>
        )}

        {resolvedDriveControl}

        {billingAccount?.status === 'trial' && (
          <div
            data-testid="billing-trial-badge"
            className="emprovex-header-control border-violet-300/15 bg-violet-400/[0.07] text-violet-100"
            title={
              trialExpired
                ? 'Período de teste encerrado. O acesso permanece liberado durante a fase de testes.'
                : `Período de teste: ${trialDaysRemaining ?? 0} dia(s) restante(s). Acesso completo.`
            }
          >
            <Sparkles className="emprovex-header-control__icon h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">
              {trialExpired
                ? 'Teste encerrado'
                : `Período de Teste · ${trialDaysRemaining ?? 0}d`}
            </span>
          </div>
        )}

        {canSwitchProfile && (
          <button
            type="button"
            onClick={openAdministration}
            className="emprovex-header-control emprovex-header-control--admin"
            title="Alternar para o perfil de Administração EMPROVEX"
            aria-label="Abrir Administração EMPROVEX"
          >
            <ShieldCheck className="emprovex-header-control__icon h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Administração</span>
          </button>
        )}

        <div className="emprovex-header-identity hidden items-center md:flex" title={userDisplayName}>
          <span className="emprovex-header-identity__avatar" aria-hidden="true">
            <UserRound className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">
            <span className="emprovex-header-identity__label">Operador</span>
            <span className="emprovex-header-identity__name">{userDisplayName}</span>
          </span>
        </div>
      </div>

      <span className="emprovex-header-energy-line" aria-hidden="true">
        <span className="emprovex-header-energy-line__beam" />
      </span>
    </header>
  );
}
