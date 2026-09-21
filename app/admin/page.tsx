'use client';

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

import { PlatformAdminView } from '../../components/admin/PlatformAdminView';
import { usePlatformBranding } from '../../hooks/usePlatformBranding';
import { usePlatformAdminDirectory } from '../../hooks/usePlatformAdminDirectory';
import { usePlatformAdminSessions } from '../../hooks/usePlatformAdminSessions';
import { usePlatformAdminUsage } from '../../hooks/usePlatformAdminUsage';
import { usePlatformAdminGlobalUsage } from '../../hooks/usePlatformAdminGlobalUsage';
import { usePlatformAdminBilling } from '../../hooks/usePlatformAdminBilling';
import { auth } from '../../lib/firebase';
import {
  createHgesmFoundingWorkspace,
  HGESM_WORKSPACE_ID,
} from '../../lib/hgesmWorkspace';
import { resetActiveProfileMode, setActiveProfileMode } from '../../lib/profileMode';
import { resolveWorkspaceContext } from '../../lib/workspaceContext';

export default function PlatformAdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { customLogo } = usePlatformBranding();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const context = resolveWorkspaceContext(user?.email);
  const adminUser = context.status === 'platformAdmin' ? user : null;
  const adminDirectory = usePlatformAdminDirectory(adminUser);
  const adminSessions = usePlatformAdminSessions(adminUser);
  const adminWorkspaces = useMemo(() => {
    const workspaces = adminDirectory.directory.workspaces;
    if (workspaces.some((workspace) => workspace.id === HGESM_WORKSPACE_ID)) {
      return workspaces;
    }

    return [
      createHgesmFoundingWorkspace(),
      ...workspaces,
    ];
  }, [adminDirectory.directory.workspaces]);

  const adminUsage = usePlatformAdminUsage(
    adminUser,
    adminWorkspaces,
    !adminDirectory.loading && !adminDirectory.error
  );
  const adminGlobalUsage = usePlatformAdminGlobalUsage(adminUser);
  const adminBilling = usePlatformAdminBilling(
    adminUser,
    adminWorkspaces,
    !adminDirectory.loading && !adminDirectory.error
  );

  useEffect(() => {
    if (loading) return;

    if (!user) {
      resetActiveProfileMode();
      window.location.replace('/');
      return;
    }

    if (context.status !== 'platformAdmin') {
      setActiveProfileMode('sector');
      window.location.replace('/');
    }
  }, [context.status, loading, user]);

  if (loading || !user || context.status !== 'platformAdmin') {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#020817] px-6 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(37,99,235,0.16),transparent_32%),linear-gradient(145deg,#020817_0%,#061126_55%,#071a34_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/35 to-transparent" />
        <div className="relative mb-5 grid h-16 w-16 place-items-center rounded-[1.35rem] border border-blue-300/15 bg-blue-400/[0.06] shadow-[0_0_45px_rgba(37,99,235,0.16)]">
          <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#071a3a]">
            {customLogo ? (
              <img src={customLogo} alt="Logo EMPROVEX" className="h-full w-full object-contain p-1" />
            ) : (
              <span className="text-[10px] font-black tracking-[0.12em]">EMP</span>
            )}
          </div>
          <Loader2 className="absolute -bottom-2 -right-2 h-5 w-5 animate-spin rounded-full bg-[#071225] p-1 text-blue-300" />
        </div>
        <p className="relative font-mono text-[8px] font-bold uppercase tracking-[0.22em] text-blue-300/55">EMPROVEX // ADMIN</p>
        <p className="relative mt-2 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-300">
          Validando perfil administrativo...
        </p>
      </div>
    );
  }

  const handleLogout = async () => {
    resetActiveProfileMode();
    await signOut(auth);
    window.location.replace('/');
  };

  return (
    <PlatformAdminView
      adminUser={user}
      adminEmail={context.email}
      customLogo={customLogo}
      workspaces={adminWorkspaces}
      loadingDirectory={adminDirectory.loading}
      directoryError={adminDirectory.error}
      creatingSector={adminDirectory.creating}
      updatingWorkspaceId={adminDirectory.updatingWorkspaceId}
      changingStatusWorkspaceId={adminDirectory.changingStatusWorkspaceId}
      deletingWorkspaceId={adminDirectory.deletingWorkspaceId}
      resettingPasswordWorkspaceId={adminDirectory.resettingPasswordWorkspaceId}
      sessions={adminSessions.sessions}
      loadingSessions={adminSessions.loading}
      sessionsError={adminSessions.error}
      terminatingSessionId={adminSessions.terminatingSessionId}
      usage={adminUsage.usage}
      loadingUsage={adminUsage.loading}
      usageError={adminUsage.error}
      globalUsage={adminGlobalUsage.snapshot}
      globalUsageConfigured={adminGlobalUsage.configured}
      globalUsageObservedAt={adminGlobalUsage.observedAt}
      globalUsageDataThrough={adminGlobalUsage.dataThrough}
      loadingGlobalUsage={adminGlobalUsage.loading}
      globalUsageError={adminGlobalUsage.error}
      billing={adminBilling}
      onCreateSector={async (input) => {
        await adminDirectory.createSector(input);
      }}
      onUpdateSector={async (input) => {
        await adminDirectory.updateSector(input);
      }}
      onChangeSectorStatus={async (workspaceId, status) => {
        await adminDirectory.changeSectorStatus(workspaceId, status);
      }}
      onDeleteSector={async (workspaceId, email) => {
        await adminDirectory.deleteSector(workspaceId, email);
      }}
      onResetSectorPassword={async (workspaceId, email, newPassword) => {
        await adminDirectory.resetSectorPassword(workspaceId, email, newPassword);
      }}
      onTerminateSession={async (session) => {
        await adminSessions.terminateSession(session);
      }}
      onRefreshUsage={adminUsage.refresh}
      onRefreshGlobalUsage={adminGlobalUsage.refresh}
      onLogout={handleLogout}
    />
  );
}
