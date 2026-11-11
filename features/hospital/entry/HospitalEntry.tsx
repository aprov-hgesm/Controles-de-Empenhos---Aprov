'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ArrowRight, LogOut, Mail, RefreshCw, ShieldCheck } from 'lucide-react';

import { auth } from '@/lib/firebase';
import { checkHospitalEntry, type HospitalEntryDecision } from './action';

type AccessState =
  | { phase: 'checking' }
  | { phase: 'signed-out' }
  | { phase: 'allowed'; decision: Extract<HospitalEntryDecision, { status: 200 }> }
  | { phase: 'denied'; status: number; message: string };

export function HospitalEntry() {
  const [state, setState] = useState<AccessState>({ phase: 'checking' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signing, setSigning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const version = ++requestVersion.current;
      setMessage(null);
      if (!user) {
        if (mounted) setState({ phase: 'signed-out' });
        return;
      }
      setState({ phase: 'checking' });
      try {
        const token = await user.getIdToken(true);
        const decision = await checkHospitalEntry(token);
        if (!mounted || version !== requestVersion.current) return;
        if (decision.status === 200) {
          setState({ phase: 'allowed', decision });
        } else {
          setState({ phase: 'denied', status: decision.status, message: decision.message });
        }
      } catch {
        if (mounted && version === requestVersion.current) {
          setState({ phase: 'denied', status: 503, message: 'Não foi possível verificar o vínculo hospitalar no servidor.' });
        }
      }
    });
    return () => {
      mounted = false;
      requestVersion.current += 1;
      unsubscribe();
    };
  }, []);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (signing || !email.trim() || !password) return;
    setSigning(true);
    setMessage(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword('');
    } catch {
      setMessage('Não foi possível autenticar. Confira suas credenciais ou tente novamente.');
    } finally {
      setSigning(false);
    }
  };

  const resetPassword = async () => {
    if (!email.trim() || signing) {
      setMessage('Informe seu e-mail institucional para solicitar recuperação de acesso.');
      return;
    }
    setSigning(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch {
      // Same response to avoid disclosing whether an account exists.
    } finally {
      setMessage('Se o e-mail estiver cadastrado, você receberá instruções de recuperação.');
      setSigning(false);
    }
  };

  const logout = async () => {
    setState({ phase: 'checking' });
    setMessage(null);
    try {
      await signOut(auth);
    } catch {
      setState({ phase: 'denied', status: 503, message: 'Não foi possível encerrar a sessão.' });
    }
  };

  return (
    <section className="rounded-2xl border border-white/15 bg-[#0b2037] p-5 sm:p-7" aria-labelledby="qa-auth-title">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-sky-300">Somente ambiente de testes autorizado</p>
      <h2 id="qa-auth-title" className="mt-2 text-xl font-bold">Verificação de identidade hospitalar</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">Uma conta Firebase autenticada não garante acesso. O servidor precisa confirmar seu vínculo hospitalar e o papel autorizado.</p>

      {state.phase === 'checking' && (
        <p role="status" className="mt-6 flex items-center gap-2 text-sm text-sky-100">
          <RefreshCw size={18} className="animate-spin" aria-hidden="true" /> Verificando identidade e permissões...
        </p>
      )}

      {state.phase === 'signed-out' && (
        <form onSubmit={login} className="mt-6 space-y-4">
          <div>
            <label htmlFor="hospital-email" className="mb-2 block text-sm font-semibold">E-mail institucional</label>
            <input id="hospital-email" type="email" autoComplete="username" required value={email}
              onChange={(event) => setEmail(event.target.value)} disabled={signing}
              className="w-full rounded-xl border border-white/20 bg-[#061324] px-4 py-3 text-white outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300" />
          </div>
          <div>
            <label htmlFor="hospital-password" className="mb-2 block text-sm font-semibold">Senha</label>
            <input id="hospital-password" type="password" autoComplete="current-password" required value={password}
              onChange={(event) => setPassword(event.target.value)} disabled={signing}
              className="w-full rounded-xl border border-white/20 bg-[#061324] px-4 py-3 text-white outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300" />
          </div>
          <button type="submit" disabled={signing} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sky-300 px-5 py-3 font-bold text-slate-950 disabled:opacity-60">
            {signing ? 'Entrando...' : 'Entrar e validar vínculo'} <ArrowRight size={17} aria-hidden="true" />
          </button>
          <div>
            <button type="button" onClick={resetPassword} disabled={signing}
              className="inline-flex items-center gap-2 rounded-lg px-1 py-2 text-sm text-sky-200 underline underline-offset-4 disabled:opacity-60">
              <Mail size={16} aria-hidden="true" /> Recuperar acesso
            </button>
          </div>
        </form>
      )}

      {state.phase === 'denied' && (
        <div role="alert" className="mt-6 rounded-xl border border-amber-400/30 bg-amber-300/10 p-4 text-sm text-amber-100">
          <p className="font-bold">Verificação não autorizada ({state.status})</p>
          <p className="mt-2">{state.message}</p>
          <button type="button" onClick={logout} className="mt-3 inline-flex gap-2 rounded-lg border border-amber-200/30 px-3 py-2 font-semibold">
            <LogOut size={16} aria-hidden="true" /> Trocar de conta
          </button>
        </div>
      )}

      {state.phase === 'allowed' && (
        <div role="status" className="mt-6 rounded-xl border border-sky-300/30 bg-sky-300/10 p-4 text-sm text-sky-100">
          <p className="flex items-center gap-2 font-bold"><ShieldCheck size={19} aria-hidden="true" /> Vínculo verificado pelo servidor</p>
          <p className="mt-2">Perfis: {state.decision.roles.join(', ')}. Unidades autorizadas: {state.decision.unitCount}.</p>
          {state.decision.nextPath ? (
            <a href={state.decision.nextPath} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-300 px-4 py-2 font-bold text-slate-950">
              Acessar módulo hospitalar <ArrowRight size={16} aria-hidden="true" />
            </a>
          ) : (
            <p className="mt-3 text-slate-200">O módulo operacional está em integração pelo W9. Nenhum dado clínico foi carregado nesta entrada.</p>
          )}
          <div>
            <button type="button" onClick={logout} className="mt-4 inline-flex items-center gap-2 text-sky-200 underline underline-offset-4">
              <LogOut size={16} aria-hidden="true" /> Encerrar sessão
            </button>
          </div>
        </div>
      )}

      {message && <p className="mt-4 text-sm text-amber-200" role="status">{message}</p>}
    </section>
  );
}
