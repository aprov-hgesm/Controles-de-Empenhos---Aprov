'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  browserSessionPersistence, onAuthStateChanged, setPersistence,
  signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import { companyAuth } from '../../lib/company/firebaseProjectClient';

export default function CompanyLoginPage() {
  const [checking,setChecking] = useState(true);
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => {
    const unsub = onAuthStateChanged(companyAuth, user => {
      setChecking(false);
      if (user && user.emailVerified) window.location.replace('/empresa');
    });
    return () => unsub();
  }, []);
  const login = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);setError('');
    try {
      await setPersistence(companyAuth, browserSessionPersistence);
      const response = await signInWithEmailAndPassword(companyAuth,email.trim().toLowerCase(),password);
      if (!response.user.emailVerified) {
        await signOut(companyAuth);
        throw new Error('Confirme o e-mail antes de acessar o portal empresarial.');
      }
      window.location.replace('/empresa');
    } catch (reason) {
      setError(reason instanceof Error && reason.message.startsWith('Confirme')
        ? reason.message : 'Não foi possível entrar. Verifique suas credenciais e o acesso autorizado.');
      setBusy(false);
    }
  };
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-900">
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl sm:p-9"
      aria-label="Acesso exclusivo EMPROVEX Empresas">
      <p className="text-sm font-bold tracking-widest text-blue-700">EMPROVEX EMPRESAS</p>
      <h1 className="mt-3 text-2xl font-bold">Acessar meu espaço empresarial</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Sua conta empresarial é independente dos acessos militares e administrativos.
      </p>
      {error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      <form onSubmit={login} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold">E-mail empresarial
          <input type="email" autoComplete="username" required disabled={busy || checking}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3 outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            value={email} onChange={e=>setEmail(e.target.value)} />
        </label>
        <label className="block text-sm font-semibold">Senha
          <input type="password" autoComplete="current-password" required disabled={busy || checking}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3 outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            value={password} onChange={e=>setPassword(e.target.value)} />
        </label>
        <button disabled={busy || checking} type="submit" className="w-full rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50">
          {checking ? 'Verificando acesso…' : busy ? 'Autenticando…' : 'Entrar no EMPROVEX Empresas'}
        </button>
      </form>
      <a href="/login" className="mt-6 block text-center text-sm font-medium text-blue-700 underline">
        Voltar ao acesso institucional
      </a>
      <p className="mt-4 text-xs text-slate-500">
        Ambiente empresarial com acesso restrito. A conta deve ser cadastrada por administração autorizada.
      </p>
    </section>
  </main>;
}
