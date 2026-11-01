'use client';

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  browserLocalPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

import { auth } from '../../lib/firebase';
import { normalizePlatformEmail } from '../../lib/platformIdentity';
import { resolveCompanySession } from '../../lib/company/companySessionClient';
import { usePlatformBranding } from '../../hooks/usePlatformBranding';
import { EmprovexLogin } from '../../components/auth/EmprovexLogin';
import { EmprovexAuthLoading } from '../../components/auth/EmprovexAuthLoading';

// The operational tree (including Firestore listeners, sector leases and billing
// gates) is not imported/mounted for company sessions.
const OperationalEntry = lazy(() => import('./OperationalEntry'));
type Stage = 'checking' | 'login' | 'operational' | 'unavailable';
type Toast = { message: string; type: 'success' | 'error' | 'info' } | null;

export default function LoginEntryPage() {
  const [stage, setStage] = useState<Stage>('checking');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const resolutionSequence = useRef(0);
  const { customLogo } = usePlatformBranding();

  useEffect(() => {
    let alive = true;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const sequence = ++resolutionSequence.current;
      if (!user) {
        setStage('login');
        return;
      }
      setStage('checking');
      void resolveCompanySession(user).then(async (result) => {
        if (!alive || sequence !== resolutionSequence.current) return;
        if (result.kind === 'company') {
          window.location.replace('/empresa');
        } else if (result.kind === 'invalid-auth') {
          await signOut(auth);
        } else {
          setStage('operational');
        }
      }).catch(() => {
        if (alive && sequence === resolutionSequence.current) setStage('unavailable');
      });
    });
    return () => {
      alive = false;
      resolutionSequence.current += 1;
      unsubscribe();
    };
  }, []);

  const onCredentials = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setToast(null);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const credential = await signInWithEmailAndPassword(auth, normalizePlatformEmail(email), password);
      if (!credential.user.emailVerified) {
        await signOut(auth);
        throw new Error('Confirme seu e-mail antes de entrar. Contate a Administração EMPROVEX se precisar de ajuda.');
      }
      return true; // onAuthStateChanged resolves the account on the trusted server.
    } catch (error) {
      await signOut(auth).catch(() => undefined);
      setToast({
        message: error instanceof Error && !('code' in error)
          ? error.message
          : 'Não foi possível autenticar as credenciais. Confira e-mail e senha.',
        type: 'error',
      });
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const onReset = useCallback(async (email: string) => {
    const normalized = normalizePlatformEmail(email);
    if (!normalized) throw new Error('Informe seu e-mail cadastrado.');
    await sendPasswordResetEmail(auth, normalized);
    return 'Se o e-mail estiver cadastrado para acesso por senha, você receberá as instruções de redefinição.';
  }, []);

  if (stage === 'operational') {
    return (
      <Suspense fallback={<EmprovexAuthLoading hasAuthenticatedIdentity />}>
        <OperationalEntry />
      </Suspense>
    );
  }

  if (stage === 'checking') {
    return <EmprovexAuthLoading hasAuthenticatedIdentity={Boolean(auth.currentUser)} />;
  }

  if (stage === 'unavailable') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-950 p-6 text-center text-white">
        <h1 className="text-xl font-bold">Não foi possível verificar sua sessão.</h1>
        <p className="max-w-md text-sm text-slate-300">Por segurança, nenhum ambiente foi aberto. Verifique sua conexão e tente novamente.</p>
        <button className="rounded-xl bg-blue-600 px-5 py-3 font-semibold" onClick={() => window.location.reload()}>Tentar novamente</button>
        <button className="text-sm underline" onClick={() => void signOut(auth)}>Sair desta conta</button>
      </main>
    );
  }

  return (
    <EmprovexLogin
      customLogo={customLogo}
      isSigningIn={busy}
      toast={toast}
      onCloseToast={() => setToast(null)}
      onSectorLogin={onCredentials}
      onFounderLogin={async () => { /* Login do fundador por senha; Google não é exibido. */ }}
      onRequestPasswordReset={onReset}
    />
  );
}
