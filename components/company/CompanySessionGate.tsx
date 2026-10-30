'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Menu, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

import { auth } from '../../lib/firebase';
import {
  resolveCompanySession,
  type AuthorizedCompanySession,
} from '../../lib/company/companySessionClient';
import { CompanyNavigation } from './CompanyNavigation';
import { CompanySessionContext } from './CompanySessionContext';

type CompanyGateState =
  | { stage: 'checking' }
  | { stage: 'authorized'; session: AuthorizedCompanySession }
  | { stage: 'denied' }
  | { stage: 'unavailable' };

export function CompanySessionGate({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<CompanyGateState>({ stage: 'checking' });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const sequenceRef = useRef(0);

  const validate = useCallback(async () => {
    const user = auth.currentUser;
    const sequence = ++sequenceRef.current;
    if (!user) {
      setGate({ stage: 'denied' });
      return;
    }
    try {
      const result = await resolveCompanySession(user);
      if (sequence !== sequenceRef.current || auth.currentUser?.uid !== user.uid) return;
      if (result.kind === 'company') setGate({ stage: 'authorized', session: result.session });
      else setGate({ stage: 'denied' });
    } catch {
      if (sequence === sequenceRef.current) setGate({ stage: 'unavailable' });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        ++sequenceRef.current;
        setGate({ stage: 'denied' });
        return;
      }
      setGate({ stage: 'checking' });
      void validate();
    });
    const onFocus = () => {
      if (auth.currentUser) void validate();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      ++sequenceRef.current;
      unsubscribe();
      window.removeEventListener('focus', onFocus);
    };
  }, [validate]);

  const onSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut(auth);
      window.location.replace('/login');
    } catch {
      setSigningOut(false);
    }
  };

  if (gate.stage !== 'authorized') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#071225] px-6 text-center text-white">
        <img src="/emprovex-logo.png" alt="EMPROVEX" className="h-16 w-16 object-contain" />
        {gate.stage === 'checking' ? (
          <p role="status" className="text-sm text-slate-300">Validando identidade e workspace empresarial...</p>
        ) : (
          <>
            <ShieldAlert size={28} className="text-blue-300" />
            <h1 className="text-xl font-bold">{gate.stage === 'denied' ? 'Acesso empresarial não autorizado' : 'Validação temporariamente indisponível'}</h1>
            <p className="max-w-md text-sm text-slate-300">
              {gate.stage === 'denied'
                ? 'Entre com uma conta empresarial ativa e vinculada ao workspace cadastrado.'
                : 'Por segurança, nenhuma informação empresarial foi carregada.'}
            </p>
            <Link href="/login" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold">Ir para o login</Link>
            {gate.stage === 'unavailable' && (
              <button type="button" onClick={() => void validate()} className="text-sm underline">Tentar novamente</button>
            )}
          </>
        )}
      </main>
    );
  }

  return (
    <CompanySessionContext.Provider value={gate.session}>
    <div className="min-h-screen bg-[#f2f5fa] text-[#10243c] lg:flex">
      <CompanyNavigation
        companyName={gate.session.companyName}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onSignOut={() => void onSignOut()}
        signingOut={signingOut}
      />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[76px] items-center gap-4 border-b border-slate-200 bg-white/95 px-5 backdrop-blur lg:px-10">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Abrir menu empresarial"
            className="rounded-xl border border-slate-200 p-2 text-slate-700 lg:hidden"><Menu size={22} /></button>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[.15em] text-blue-600">EMPROVEX / Empresas</p>
            <p className="truncate text-sm font-semibold text-slate-600">{gate.session.companyName}</p>
          </div>
          <span className="ml-auto hidden rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 sm:inline-block">
            Ambiente empresarial
          </span>
        </header>
        <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-10 lg:py-10">{children}</div>
      </div>
    </div>
    </CompanySessionContext.Provider>
  );
}
