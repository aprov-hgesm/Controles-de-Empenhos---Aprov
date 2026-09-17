'use client';

import { useEffect, useState } from 'react';
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, LogIn, LogOut } from 'lucide-react';

import { auth, googleProvider } from '../../lib/firebase';
import { resolveWorkspaceContext } from '../../lib/workspaceContext';

interface AttemptResult {
  ok: boolean;
  email?: string | null;
  uid?: string;
  emailVerified?: boolean;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  capturedAt: string;
}

function getErrorCode(error: unknown): string {
  if (typeof error === 'object' && error && 'code' in error) {
    return String((error as { code?: unknown }).code || '');
  }
  return '';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export default function AuthDiagnosticPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [attempt, setAttempt] = useState<AttemptResult | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const currentContext = resolveWorkspaceContext(user?.email);

  const runGoogleLogin = async () => {
    if (testing) return;
    setTesting(true);
    setAttempt(null);

    try {
      await setPersistence(auth, browserLocalPersistence);
      const credential = await signInWithPopup(auth, googleProvider);
      const context = resolveWorkspaceContext(credential.user.email);

      setAttempt({
        ok: true,
        email: credential.user.email,
        uid: credential.user.uid,
        emailVerified: credential.user.emailVerified,
        status: context.status,
        capturedAt: new Date().toISOString(),
      });
    } catch (error) {
      setAttempt({
        ok: false,
        errorCode: getErrorCode(error),
        errorMessage: getErrorMessage(error),
        capturedAt: new Date().toISOString(),
      });
    } finally {
      setTesting(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setAttempt(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <Loader2 className="w-9 h-9 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.045] p-6 sm:p-8 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl border border-blue-400/20 bg-blue-500/10 flex items-center justify-center text-blue-300 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold">Diagnóstico isolado de autenticação</h1>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Esta página testa somente o Firebase Authentication. Nenhuma coleção do Firestore, empenho, nota fiscal ou documento operacional é consultado.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Sessão Firebase atual</div>
          {user ? (
            <div className="mt-3 space-y-1 font-mono text-xs text-slate-200">
              <div className="break-all">email: {user.email || 'sem e-mail'}</div>
              <div className="break-all">uid: {user.uid}</div>
              <div>emailVerified: {String(user.emailVerified)}</div>
              <div>status EMPROVEX: {currentContext.status}</div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-slate-400">Nenhuma sessão autenticada.</div>
          )}
        </div>

        {attempt && (
          <div className={`mt-4 rounded-2xl border p-5 ${attempt.ok ? 'border-emerald-400/20 bg-emerald-500/[0.06]' : 'border-red-400/20 bg-red-500/[0.06]'}`}>
            <div className="flex items-center gap-2 text-sm font-extrabold">
              {attempt.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <AlertTriangle className="w-4 h-4 text-red-300" />}
              {attempt.ok ? 'Autenticação concluída' : 'Firebase Auth retornou erro'}
            </div>
            <div className="mt-3 space-y-1 font-mono text-xs text-slate-200">
              {attempt.ok ? (
                <>
                  <div className="break-all">email: {attempt.email || 'sem e-mail'}</div>
                  <div className="break-all">uid: {attempt.uid}</div>
                  <div>emailVerified: {String(attempt.emailVerified)}</div>
                  <div>status EMPROVEX: {attempt.status}</div>
                </>
              ) : (
                <>
                  <div className="break-all">code: {attempt.errorCode || 'sem código'}</div>
                  <div className="break-all">message: {attempt.errorMessage || 'sem mensagem'}</div>
                </>
              )}
              <div className="text-slate-500">capturado: {attempt.capturedAt}</div>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void runGoogleLogin()}
            disabled={testing}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold transition hover:bg-blue-500 disabled:opacity-60"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {testing ? 'Testando...' : 'Testar login Google'}
          </button>

          <button
            type="button"
            onClick={() => window.location.assign('/admin')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold transition hover:bg-white/10"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir /admin
          </button>
        </div>

        {user && (
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/15 bg-red-500/[0.06] px-4 py-3 text-sm font-bold text-red-200 transition hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4" />
            Encerrar sessão de teste
          </button>
        )}
      </div>
    </div>
  );
}
