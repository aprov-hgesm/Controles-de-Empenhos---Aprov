'use client';

import { useState, type ReactNode } from 'react';
import { signOut } from 'firebase/auth';
import { usePathname } from 'next/navigation';

import { AppBackground } from '../../../components/layout/AppBackground';
import { AppHeader } from '../../../components/layout/AppHeader';
import { auth } from '../../../lib/firebase';
import { HGESM_SECTOR_EMAIL } from '../../../lib/hgesmWorkspace';
import { normalizePlatformEmail } from '../../../lib/platformIdentity';
import { resetActiveProfileMode } from '../../../lib/profileMode';
import {
  clearResolvedWorkspaceContext,
  type SectorWorkspaceContext,
} from '../../../lib/workspaceContext';
import {
  clearLocalWorkspaceSessionLease,
  releaseWorkspaceSessionLease,
} from '../../../lib/platformSessionLease';
import { flushWorkspaceUsageTelemetry } from '../../../lib/workspaceUsageTelemetry';
import { usePlatformBranding } from '../../../hooks/usePlatformBranding';
import { getWarehouseSectionForPathname } from '../navigation';
import { WarehouseSidebar } from './WarehouseSidebar';

export function WarehouseModuleShell({
  children,
  workspaceContext,
}: {
  children: ReactNode;
  workspaceContext: SectorWorkspaceContext;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { customLogo } = usePlatformBranding();
  const activeSection = getWarehouseSectionForPathname(pathname);
  const section = activeSection.id;
  const isImmersive = section === 'home' || section === 'overview';
  const currentUser = auth.currentUser;
  const showMobileAccess =
    normalizePlatformEmail(workspaceContext.email) === HGESM_SECTOR_EMAIL;
  const userDisplayName =
    currentUser?.displayName
    || workspaceContext.workspaceName
    || 'Aprovisionamento HGeSM';

  const handleLogout = async () => {
    const user = auth.currentUser;

    if (user && workspaceContext.resolutionSource === 'platform-directory') {
      try {
        await releaseWorkspaceSessionLease(user, workspaceContext);
      } catch (error) {
        console.warn('Não foi possível liberar imediatamente o lease da sessão.', error);
        clearLocalWorkspaceSessionLease(workspaceContext.workspaceId, user.uid);
      }
    }

    try {
      await flushWorkspaceUsageTelemetry({
        workspaceId: workspaceContext.workspaceId,
        ug: workspaceContext.ug,
      });
    } catch (error) {
      console.warn('Não foi possível consolidar a telemetria antes do logout.', error);
    }

    resetActiveProfileMode();
    clearResolvedWorkspaceContext();
    await signOut(auth);
    window.location.assign('/');
  };

  return (
    <div
      className={`min-h-screen antialiased relative overflow-x-hidden selection:bg-blue-500 selection:text-white ${isImmersive
        ? 'bg-[#02040b] text-white'
        : 'bg-gradient-to-br from-[#f0f4f8] via-[#e8ecf3] to-[#f4f6fa] text-[#0b1c30]'
      }`}
      data-testid="warehouse-module-shell"
      data-warehouse-section={section}
    >
      <AppBackground immersive={isImmersive} />

      <AppHeader
        customLogo={customLogo}
        syncing={false}
        userDisplayName={userDisplayName}
        workspaceContext={workspaceContext}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      <div className="flex min-h-screen flex-1 pt-16 z-10 relative lg:pl-72">
        <WarehouseSidebar
          activeSection={section}
          open={sidebarOpen}
          userDisplayName={userDisplayName}
          showMobileAccess={showMobileAccess}
          onClose={() => setSidebarOpen(false)}
          onLogout={handleLogout}
        />

        <main
          className={`flex-1 w-full overflow-x-hidden pb-24 md:pb-12 mx-auto ${isImmersive
            ? 'lg:pl-5 pt-4 px-3 max-w-[1600px]'
            : 'lg:pl-6 pt-6 px-4 max-w-7xl'
          }`}
        >
          {isImmersive ? (
            <section
              data-testid="warehouse-surface"
              className="warehouse-emprovex-content min-w-0"
            >
              {children}
            </section>
          ) : (
            <section
              className="warehouse-emprovex-surface space-y-4"
              data-testid="warehouse-surface"
            >
              <div className="rounded-2xl border border-slate-200/80 bg-white/88 px-5 py-5 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:px-7 sm:py-6 lg:px-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-[#00288e]/70">
                      Central de Depósitos · {activeSection.eyebrow}
                    </p>
                    <h1 className="mt-2 text-2xl font-black tracking-tight text-[#0b1c30] sm:text-3xl">
                      {activeSection.label}
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                      {activeSection.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-blue-200/80 bg-blue-50/90 px-3 py-2 shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" aria-hidden="true" />
                    <span className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-[#00288e]/80">
                      Módulo operacional
                    </span>
                  </div>
                </div>
              </div>

              <div className="warehouse-emprovex-content min-w-0">
                {children}
              </div>
            </section>
          )}

          <footer className={`px-2 pb-2 pt-5 text-center text-[11px] font-medium leading-5 ${isImmersive ? 'text-slate-600' : 'text-slate-400'}`}>
            EMPROVEX · Central de Depósitos · ambiente operacional integrado
          </footer>
        </main>
      </div>
    </div>
  );
}
