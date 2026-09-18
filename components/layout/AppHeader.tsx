'use client';

import { type ChangeEvent, type MouseEvent, type ReactNode } from 'react';
import { Loader2, Menu, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { auth } from '../../lib/firebase';
import { hasDualProfileAccess, setActiveProfileMode } from '../../lib/profileMode';
import type { ResolvedWorkspaceContext } from '../../lib/workspaceContext';
import { WorkspaceDriveControl } from './WorkspaceDriveControl';
import { AppShellLogo } from './chrome/AppShellLogo';

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
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenSidebar}
          className="emprovex-header-menu lg:hidden p-1.5 rounded-lg active:scale-95 duration-150 transition-all"
          id="menu-toggle-btn"
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

      <div className="flex items-center gap-2 sm:gap-3">
        {syncing && (
          <div role="status" aria-live="polite" className="flex items-center gap-1 text-xs font-semibold text-blue-600 animate-pulse bg-blue-50/70 backdrop-blur-sm px-3 py-1 rounded-full">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Sincronizando...
          </div>
        )}

        {resolvedDriveControl}

        {canSwitchProfile && (
          <button
            type="button"
            onClick={openAdministration}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200/80 bg-blue-50/80 px-3 py-2 text-[11px] font-extrabold text-[#00288e] transition hover:bg-blue-100 active:scale-95"
            title="Alternar para o perfil de Administração EMPROVEX"
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Administração</span>
          </button>
        )}

        <div className="flex items-center gap-2">
          <span className="emprovex-header-user text-xs font-semibold hidden md:inline">
            {userDisplayName}
          </span>
        </div>
      </div>
    </header>
  );
}
