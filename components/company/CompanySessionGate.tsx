'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Menu, ShieldAlert } from 'lucide-react';
import { companyAuth as auth } from '../../lib/company/firebaseProjectClient';
import { resolveCompanySession, type AuthorizedCompanySession } from '../../lib/company/companySessionClient';
import { CompanyNavigation } from './CompanyNavigation';
import { CompanyProfileSwitcher } from '../../features/company/profiles/CompanyProfileSwitcher';
import { CompanySessionContext, CompanyEssentialModeContext } from './CompanySessionContext';
import { CompanyErrorState, CompanyLoadingState } from './CompanyFeedback';

type CompanyGateState =
  | { stage: 'checking' }
  | { stage: 'authorized'; session: AuthorizedCompanySession }
  | { stage: 'select-profile' }
  | { stage: 'denied' }
  | { stage: 'unavailable' };

const MODE_KEY = 'emprovex.company.essential';

export function CompanySessionGate({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<CompanyGateState>({ stage: 'checking' });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [essential, setEssential] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const verifiedRef = useRef<AuthorizedCompanySession | null>(null);
  const sequenceRef = useRef(0);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try { setEssential(window.localStorage.getItem(MODE_KEY) === '1'); } catch { /* storage optional */ }
  }, []);

  const getIdToken = useCallback(async () => {
    if (!auth.currentUser) throw new Error('AUTH_REQUIRED');
    return auth.currentUser.getIdToken();
  }, []);

  // Focus revalidation keeps forms mounted only for the SAME verified tenant.
  // A generation and AbortController prevent old asynchronous results winning.
  const validate = useCallback(async (preserveView = false) => {
    const user = auth.currentUser;
    const sequence = ++sequenceRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!user) {
      verifiedRef.current = null;
      setRevalidating(false);
      setGate({ stage: 'denied' });
      return;
    }
    if (preserveView && verifiedRef.current?.firebaseUid === user.uid) {
      setRevalidating(true);
    } else {
      setGate({ stage: 'checking' });
    }
    try {
      const result = await resolveCompanySession(user, controller.signal);
      if (controller.signal.aborted || sequence !== sequenceRef.current || auth.currentUser?.uid !== user.uid) return;
      if (result.kind === 'company') {
        verifiedRef.current = result.session;
        setGate({ stage: 'authorized', session: result.session });
      } else {
        verifiedRef.current = null;
        setGate({ stage: result.kind === 'select-profile' ? 'select-profile' : 'denied' });
      }
    } catch {
      if (!controller.signal.aborted && sequence === sequenceRef.current) {
        verifiedRef.current = null;
        setGate({ stage: 'unavailable' });
      }
    } finally {
      if (sequence === sequenceRef.current) setRevalidating(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        ++sequenceRef.current;
        abortRef.current?.abort();
        verifiedRef.current = null;
        setRevalidating(false);
        setMobileOpen(false);
        setGate({ stage: 'denied' });
        return;
      }
      void validate();
    });
    const onFocus = () => {
      if (auth.currentUser) void validate(true);
    };
    window.addEventListener('focus', onFocus);
    const changedProfile = (event: StorageEvent) => {
      if (event.key === 'emprovex.company.profile.changed') window.location.reload();
    };
    window.addEventListener('storage', changedProfile);
    return () => {
      ++sequenceRef.current;
      abortRef.current?.abort();
      unsubscribe();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', changedProfile);
    };
  }, [validate]);

  const closeMenu = useCallback(() => {
    setMobileOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  const onSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut(auth);
      window.location.replace('/entrar-empresa');
    } catch {
      setSigningOut(false);
    }
  };

  const toggleEssential = () => {
    const next = !essential;
    setEssential(next);
    try { window.localStorage.setItem(MODE_KEY, next ? '1' : '0'); } catch { /* preference noncritical */ }
  };

  if (gate.stage !== 'authorized') {
    return <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#071225] px-6 text-center text-white">
      <img src="/emprovex-logo.png" alt="EMPROVEX" className="h-16 w-16 object-contain"/>
      {gate.stage === 'checking' ? <div className="w-full max-w-md text-left text-slate-800">
        <CompanyLoadingState label="Validando identidade e workspace empresarial..."/>
      </div> : <>
        <ShieldAlert size={28} className="text-blue-300" aria-hidden="true"/>
        <h1 className="text-xl font-bold">
          {gate.stage === 'select-profile' ? 'Selecione a empresa para continuar' : gate.stage === 'denied' ? 'Acesso empresarial não autorizado' : 'Validação temporariamente indisponível'}
        </h1>
        <p className="max-w-md text-sm leading-6 text-slate-300">
          {gate.stage === 'select-profile'
            ? 'A seleção anterior expirou ou foi alterada. Confirme explicitamente o CNPJ autorizado antes de acessar os dados.'
            : gate.stage === 'denied'
            ? 'Entre com uma conta empresarial ativa e vinculada ao workspace cadastrado.'
            : 'Por segurança, nenhuma informação empresarial foi carregada.'}
        </p>
        {gate.stage === 'select-profile' && <div className="w-full max-w-lg rounded-2xl bg-white p-5 text-left text-slate-900"><CompanyProfileSwitcher getIdToken={getIdToken} /></div>}
        {gate.stage === 'unavailable' && <div className="w-full max-w-md text-left">
          <CompanyErrorState message="O serviço de validação não respondeu. O acesso permanece bloqueado até nova verificação." onRetry={() => { setGate({ stage: 'checking' }); void validate(); }}/>
        </div>}
        <a href="/entrar-empresa" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">Ir para o login</a>
      </>}
    </main>;
  }

  return <CompanySessionContext.Provider key={gate.session.firebaseUid + ':' + gate.session.workspaceId} value={gate.session}>
    <CompanyEssentialModeContext.Provider value={essential}>
    <div className={`min-h-screen bg-[#f2f5fa] text-[#10243c] lg:flex ${essential ? 'motion-reduce:scroll-auto' : ''}`}>
      <a href="#company-main" className="sr-only fixed left-3 top-3 z-[90] rounded-lg bg-white px-4 py-3 font-semibold text-blue-900 shadow-lg focus:not-sr-only">
        Pular para o conteúdo
      </a>
      <CompanyNavigation companyName={gate.session.companyName} mobileOpen={mobileOpen}
        onClose={closeMenu} onSignOut={() => void onSignOut()} signingOut={signingOut}/>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex min-h-[76px] flex-wrap items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-9">
          <button ref={menuButtonRef} type="button" onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu empresarial" aria-expanded={mobileOpen}
            className="rounded-xl border border-slate-200 p-2 text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 lg:hidden">
            <Menu size={22} aria-hidden="true"/>
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[.15em] text-blue-700">EMPROVEX / Empresas</p>
            <p className="truncate text-sm font-semibold text-slate-700" title={gate.session.companyName}>{gate.session.companyName}</p>
          </div>
          <div className="order-4 w-full min-w-0 border-t border-slate-100 pt-2 sm:order-none sm:w-auto sm:max-w-[18rem] sm:border-0 sm:pt-0"><CompanyProfileSwitcher
            getIdToken={getIdToken}
            onBeforeProfileSwitch={() => { ++sequenceRef.current; abortRef.current?.abort(); verifiedRef.current=null; setGate({ stage: 'checking' }); }} />
          </div>
          <button type="button" role="switch" aria-checked={essential} onClick={toggleEssential}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
            <span className={`h-2.5 w-2.5 rounded-full ${essential ? 'bg-emerald-600' : 'bg-slate-400'}`} aria-hidden="true"/>
            <span className="hidden sm:inline">Modo Essencial</span><span className="sm:hidden">Essencial</span>
          </button>
        </header>
        <div data-company-mode={essential ? 'essential' : 'normal'}
          className={`mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-10 lg:py-9 ${essential ? '[&_a]:motion-reduce:transition-none [&_section]:shadow-none' : ''}`}>
          {revalidating && <div role="status" aria-live="polite" className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
            <p className="rounded-xl bg-white px-6 py-4 text-sm font-semibold text-slate-800 shadow-xl">Revalidando acesso à empresa…</p>
          </div>}
          {children}
        </div>
      </div>
    </div>
    </CompanyEssentialModeContext.Provider>
  </CompanySessionContext.Provider>;
}
