'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';

import { EmprovexAuthLoading } from '../../components/auth/EmprovexAuthLoading';
import { auth } from '../../lib/firebase';
import { resolveAuthenticatedWorkspaceContext } from '../../lib/platformAccess';
import { canAccessWarehouseModule } from '../../lib/warehouse/featureFlag';

type GateState = 'checking' | 'allowed' | 'unavailable';

export default function WarehouseModuleLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [gateState, setGateState] = useState<GateState>('checking');

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      let founderContextConfirmed = false;

      if (!currentUser) {
        if (active) router.replace('/');
        return;
      }

      try {
        const context = await resolveAuthenticatedWorkspaceContext(currentUser);
        if (!active) return;

        if (!canAccessWarehouseModule(context)) {
          router.replace('/');
          return;
        }

        founderContextConfirmed = true;
        const idToken = await currentUser.getIdToken();
        const response = await fetch('/api/adm-deposito/status', {
          method: 'GET',
          headers: { Authorization: 'Bearer ' + idToken },
          cache: 'no-store',
        });

        if (response.status === 401 || response.status === 403 || response.status === 404) {
          router.replace('/');
          return;
        }

        if (!response.ok) {
          setGateState('unavailable');
          return;
        }

        setGateState('allowed');
      } catch {
        if (!active) return;
        if (founderContextConfirmed) {
          setGateState('unavailable');
          return;
        }
        router.replace('/');
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  if (gateState === 'checking') {
    return <EmprovexAuthLoading hasAuthenticatedIdentity />;
  }

  if (gateState === 'unavailable') {
    return (
      <main className="grid min-h-screen place-items-center bg-[#020817] px-4 text-slate-100">
        <section className="w-full max-w-lg rounded-3xl border border-amber-300/15 bg-white/[0.035] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8" data-testid="warehouse-unavailable">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300/70">ADM Depósito</p>
              <h1 className="mt-2 text-xl font-black text-white">Módulo temporariamente indisponível</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                A identidade fundadora foi reconhecida, mas a confirmação segura do módulo não respondeu.
                Nenhuma operação logística foi executada.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/[0.09]">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </button>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
