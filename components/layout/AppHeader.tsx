'use client';

import { type ChangeEvent, type MouseEvent, type ReactNode } from 'react';
import { Loader2, Menu, ShieldCheck, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { auth } from '../../lib/firebase';
import { hasDualProfileAccess, setActiveProfileMode } from '../../lib/profileMode';
import type { ResolvedWorkspaceContext } from '../../lib/workspaceContext';
import { WorkspaceDriveControl } from './WorkspaceDriveControl';
import { AppShellLogo } from './chrome/AppShellLogo';
import { AppShellSignature } from './chrome/AppShellSignature';

interface AppHeaderProps {
  customLogo: string | null;
  syncing: boolean;
  userDisplayName: string;
  driveControl?: ReactNode;
  workspaceContext: ResolvedWorkspaceContext;
  onOpenSidebar: () => void;
  onLogoUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveLogo: (event: MouseEvent) => void;
}

export function AppHeader({
  customLogo,
  syncing,
  userDisplayName,
  driveControl,
  workspaceContext,
  onOpenSidebar,
  onLogoUpload,
  onRemoveLogo,
}: AppHeaderProps) {
  const router = useRouter();
  const currentUser = auth.currentUser;
  const currentEmail = currentUser?.email || null;
  const canSwitchProfile = hasDualProfileAccess(currentEmail);
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
          <Menu className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-2.5">
          <AppShellLogo
            customLogo={customLogo}
            onLogoUpload={onLogoUpload}
            onRemoveLogo={onRemoveLogo}
          />

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
            <Loader2 className="emprovex-header-control__icon h-3.5 w-3.5 animate-spin" />
            <span className="hidden sm:inline">Sincronizando</span>
            <span className="emprovex-header-control__dot" aria-hidden="true" />
          </div>
        )}

        {resolvedDriveControl}

        {canSwitchProfile && (
          <button
            type="button"
            onClick={openAdministration}
            className="emprovex-header-control emprovex-header-control--admin"
            title="Alternar para o perfil de Administração EMPROVEX"
          >
            <ShieldCheck className="emprovex-header-control__icon h-4 w-4" />
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
