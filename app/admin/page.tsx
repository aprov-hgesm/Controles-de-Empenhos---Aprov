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

// Firebase Auth is the only asynchronous prerequisite for the admin shell.
// Directory, telemetry, billing and 3D must never gate the founder's sign-in.
const AUTH_WAIT_LIMIT_MS = 12000;
type AdminAuthPhase = 'checking' | 'authenticated' | 'signedOut' | 'error';

function AdminAccessStatus({ failed }: { failed: boolean }) {
  return (
    <main role={failed ? 'alert' : 'status'}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#020817] px-6 text-center text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(37,99,235,0.16),transparent_32%),linear-gradient(145deg,#020817_0%,#061126_55%,#071a34_100%)]" />
      <div className="relative mb-5 grid h-16 w-16 place-items-center rounded-[1.35rem] border border-blue-300/15 bg-blue-400/[0.06]">
        <span className="text-[10px] font-black tracking-[0.12em]">EMP</span>
        {!failed && <Loader2 aria-hidden="true" className="absolute -bottom-2 -right-2 h-5 w-5 animate-spin rounded-full bg-[#071225] p-1 text-blue-300" />}
      </div>
      <p className="relative font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-blue-300/80">EMPROVEX // ADMIN</p>
      {failed ? (
        <>
          <h1 className="relative mt-3 text-base font-extrabold">Não foi possível confirmar a sessão</h1>
          <p className="relative mt-2 max-w-md text-sm text-slate-300">
            A autenticação não respondeu normalmente. Nenhuma permissão foi concedida e seus dados não foram alterados.
          </p>
          <div className="relative mt-5 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => window.location.reload()}
              className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white">Tentar novamente</button>
            <a href="/central-empenhos"
              className="rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-slate-100">Voltar ao acesso</a>
          </div>
        </>
      ) : (
        <p className="relative mt-2 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-300">
          Validando perfil administrativo...
        </p>
      )}
    </main>
  );
}

export default function PlatformAdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [phase, setPhase] = useState<AdminAuthPhase>('checking');

  useEffect(() => {
    let active = true;
    let completed = false;
    // Deterministic timeout: never trap the founder in an endless loader.
    const deadline = window.setTimeout(() => {
      if (!active || completed) return;
      console.error('EMPROVEX_ADMIN_AUTH_TIMEOUT');
      setPhase('error');
    }, AUTH_WAIT_LIMIT_MS);
    let unsubscribe: () => void = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (!active) return;
        completed = true;
        window.clearTimeout(deadline);
        setUser(currentUser);
        setPhase(currentUser ? 'authenticated' : 'signedOut');
      }, (error) => {
        if (!active) return;
        completed = true;
        window.clearTimeout(deadline);
        console.error('EMPROVEX_ADMIN_AUTH_ERROR', error.code ?? 'unknown');
        setPhase('error');
      });
    } catch (error) {
      completed = true;
      window.clearTimeout(deadline);
      console.error('EMPROVEX_ADMIN_AUTH_SUBSCRIBE_ERROR', error);
      setPhase('error');
    }
    return () => {
      active = false;
      window.clearTimeout(deadline);
      unsubscribe();
    };
  }, []);

  // /admin is an explicit request for the administrative profile. Session
  // storage is only an interface preference, not an authorization gate.
  const context = resolveWorkspaceContext(user?.email, 'platformAdmin');
  const authorized = phase === 'authenticated' && user !== null && context.status === 'platformAdmin';

  useEffect(() => {
    if (phase === 'signedOut') {
      resetActiveProfileMode();
      window.location.replace('/central-empenhos');
      return;
    }
    if (phase !== 'authenticated' || !user) return;
    if (context.status !== 'platformAdmin') {
      window.location.replace('/central-empenhos');
      return;
    }
    setActiveProfileMode('platformAdmin');
  }, [phase, user, context.status]);

  if (phase === 'error') return <AdminAccessStatus failed />;
  if (!authorized) return <AdminAccessStatus failed={false} />;

  return <AuthorizedAdminContent user={user} adminEmail={context.email} />;
}

// No administrative hooks mount until Firebase has supplied the founder identity.
function AuthorizedAdminContent({ user, adminEmail }: { user: User; adminEmail: string }) {
  const { customLogo } = usePlatformBranding();
  const adminUser = user;
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


  const handleLogout = async () => {
    resetActiveProfileMode();
    await signOut(auth);
    window.location.replace('/central-empenhos');
  };

  return (
    <PlatformAdminView
      adminUser={user}
      adminEmail={adminEmail}
      customLogo={customLogo}
      workspaces={adminWorkspaces}
      accounts={adminDirectory.directory.accounts}
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
      globalUsageMetricDataThrough={adminGlobalUsage.metricDataThrough}
      globalUsageCredentialSource={adminGlobalUsage.credentialSource}
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
