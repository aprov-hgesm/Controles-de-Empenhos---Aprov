'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { PlatformAdminView } from '../../components/admin/PlatformAdminView';
import { usePlatformAdminDirectory } from '../../hooks/usePlatformAdminDirectory';
import { auth } from '../../lib/firebase';
import { resolveWorkspaceContext } from '../../lib/workspaceContext';

const AUTH_DIAGNOSTIC_STORAGE_KEY = 'emprovex_auth_diagnostic_v1';

interface StoredAuthDiagnostic {
  email: string | null;
  uid: string;
  status: string;
  capturedAt: string;
}

export default function PlatformAdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastDiagnostic, setLastDiagnostic] = useState<StoredAuthDiagnostic | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(AUTH_DIAGNOSTIC_STORAGE_KEY);
      if (raw) setLastDiagnostic(JSON.parse(raw) as StoredAuthDiagnostic);
    } catch {
      setLastDiagnostic(null);
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const context = resolveWorkspaceContext(user?.email);
  const adminDirectory = usePlatformAdminDirectory(
    context.status === 'platformAdmin' ? context.email : null
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-4" />
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
          Validando acesso administrativo...
        </p>
      </div>
    );
  }

  if (!user || context.status !== 'platformAdmin') {
    const returnedEmail = user?.email || 'nenhum e-mail — sessão Firebase ausente';
    const resolvedStatus = context.status;

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="w-full max-w-xl rounded-3xl border border-amber-400/20 bg-amber-500/[0.07] p-7 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl border border-amber-400/20 bg-amber-400/10 flex items-center justify-center text-amber-300 flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold">Diagnóstico de acesso administrativo</h1>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                A rota administrativa foi aberta, mas a sessão atual não foi reconhecida como administrador. O último login autenticado fica registrado apenas nesta aba para diagnóstico e não concede acesso a dados.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Sessão Firebase atual</div>
              <div className="mt-1 font-mono text-slate-100 break-all">{returnedEmail}</div>
              <div className="mt-1 font-mono text-xs text-slate-400">status: {resolvedStatus}</div>
            </div>

            <div className="rounded-xl border border-blue-400/15 bg-blue-500/[0.06] p-4">
              <div className="text-[10px] uppercase tracking-wider font-bold text-blue-300">Última identidade autenticada nesta aba</div>
              {lastDiagnostic ? (
                <div className="mt-2 space-y-1 font-mono text-xs text-slate-200">
                  <div>email: {lastDiagnostic.email || 'sem e-mail'}</div>
                  <div>status: {lastDiagnostic.status}</div>
                  <div className="break-all">uid: {lastDiagnostic.uid}</div>
                  <div>capturado: {lastDiagnostic.capturedAt}</div>
                </div>
              ) : (
                <div className="mt-2 text-xs text-slate-400">Nenhuma tentativa autenticada foi registrada nesta aba.</div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              await signOut(auth);
              window.location.assign('/');
            }}
            className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold transition hover:bg-blue-500"
          >
            Encerrar sessão e voltar ao login
          </button>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut(auth);
    window.location.replace('/');
  };

  return (
    <PlatformAdminView
      adminEmail={context.email}
      workspaces={adminDirectory.directory.workspaces}
      loadingDirectory={adminDirectory.loading}
      directoryError={adminDirectory.error}
      creatingSector={adminDirectory.creating}
      onCreateSector={async (input) => {
        await adminDirectory.createSector(input);
      }}
      onLogout={handleLogout}
    />
  );
}
