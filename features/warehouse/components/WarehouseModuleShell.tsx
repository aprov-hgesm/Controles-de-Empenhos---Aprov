'use client';

import { useState } from 'react';
import { signOut } from 'firebase/auth';

import { AppBackground } from '../../../components/layout/AppBackground';
import { AppHeader } from '../../../components/layout/AppHeader';
import { auth } from '../../../lib/firebase';
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
import { getWarehouseSection, type WarehouseSectionId } from '../navigation';
import { WarehouseSectionContent } from './WarehouseSectionContent';
import { WarehouseSidebar } from './WarehouseSidebar';

export function WarehouseModuleShell({
  section,
  workspaceContext,
}: {
  section: WarehouseSectionId;
  workspaceContext: SectorWorkspaceContext;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { customLogo } = usePlatformBranding();
  const activeSection = getWarehouseSection(section);
  const currentUser = auth.currentUser;
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
      className="min-h-screen bg-gradient-to-br from-[#f0f4f8] via-[#e8ecf3] to-[#f4f6fa] text-[#0b1c30] antialiased relative overflow-x-hidden selection:bg-blue-500 selection:text-white"
      data-testid="warehouse-module-shell"
      data-warehouse-section={section}
    >
      <AppBackground />

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
          onClose={() => setSidebarOpen(false)}
          onLogout={handleLogout}
        />

        <main className="flex-1 w-full overflow-hidden lg:pl-6 pb-24 md:pb-12 pt-6 px-4 max-w-7xl mx-auto">
          <section
            className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/82 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.35)] backdrop-blur-xl"
            data-testid="warehouse-surface"
          >
            <div className="border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.08),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] px-5 py-5 sm:px-7 sm:py-6 lg:px-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-[#00288e]/60">
                    ADM Depósito · {activeSection.eyebrow}
                  </p>
                  <h1 className="mt-2 text-2xl font-black tracking-tight text-[#0b1c30] sm:text-3xl">
                    {activeSection.label}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">
                    {activeSection.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/80 px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" aria-hidden="true" />
                  <span className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-[#00288e]/70">
                    Módulo operacional
                  </span>
                </div>
              </div>
            </div>

            <div className="warehouse-emprovex-content bg-white px-5 pb-7 sm:px-7 lg:px-8">
              <WarehouseSectionContent
                section={section}
                workspaceId={workspaceContext.workspaceId}
              />
            </div>
          </section>

          <footer className="px-2 pb-2 pt-5 text-center text-[11px] font-medium leading-5 text-slate-400">
            EMPROVEX · ADM Depósito · ambiente operacional integrado
          </footer>
        </main>
      </div>
    </div>
  );
}
