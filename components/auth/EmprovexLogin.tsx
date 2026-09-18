'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
} from 'lucide-react';

import { ToastNotification } from '../layout/ToastNotification';
import { LoginAtmosphere } from './LoginAtmosphere';
import { LoginBrandStage } from './LoginBrandStage';
import type { LoginLogoVisualState } from './LoginLogoCore';

type LoginToast = {
  message: string;
  type: 'success' | 'error' | 'info';
} | null;

interface EmprovexLoginProps {
  customLogo: string | null;
  isSigningIn: boolean;
  toast: LoginToast;
  onCloseToast: () => void;
  onSectorLogin: (email: string, password: string) => Promise<boolean>;
  onFounderLogin: () => Promise<void>;
}

/**
 * Presentation boundary for the public authentication experience.
 *
 * Security guardrail:
 * this component never decides authorization, workspace access or Firebase
 * provider policy. It only collects credentials and delegates authentication
 * to callbacks owned by the application/session layer.
 */
export function EmprovexLogin({
  customLogo,
  isSigningIn,
  toast,
  onCloseToast,
  onSectorLogin,
  onFounderLogin,
}: EmprovexLoginProps) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const logoVisualState: LoginLogoVisualState = isSigningIn
    ? 'authenticating'
    : toast?.type === 'success'
      ? 'success'
      : toast?.type === 'error'
        ? 'error'
        : 'idle';

  const handleSectorSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSigningIn) return;

    const authenticated = await onSectorLogin(loginEmail, loginPassword);
    if (authenticated) setLoginPassword('');
  };

  return (
    <div className="emprovex-login-shell relative min-h-[100svh] overflow-x-hidden bg-[#020817] font-sans text-white selection:bg-blue-500 selection:text-white">
      <ToastNotification toast={toast} onClose={onCloseToast} />
      <LoginAtmosphere />

      <div className="relative z-10 mx-auto grid min-h-[100svh] w-full max-w-[1600px] lg:grid-cols-[minmax(0,1.12fr)_minmax(460px,0.88fr)]">
        <div className="border-b border-white/[0.07] lg:border-b-0 lg:border-r">
          <LoginBrandStage customLogo={customLogo} visualState={logoVisualState} />
        </div>

        <motion.main
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.72, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex items-center justify-center px-4 py-8 sm:px-8 sm:py-10 lg:px-10 xl:px-14"
        >
          <div className="w-full max-w-[540px]">
            <section className="emprovex-login-panel relative overflow-hidden rounded-[2rem] border border-white/[0.10] bg-[#071225]/78 p-5 shadow-[0_40px_120px_rgba(0,7,28,0.62)] backdrop-blur-2xl sm:p-8 lg:p-9">
              <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/55 to-transparent" />
              <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-blue-500/[0.09] blur-3xl" />

              <div className="relative">
                <div className="flex items-center justify-between gap-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/[0.12] bg-blue-400/[0.055] px-3 py-1.5">
                    <LockKeyhole className="h-3.5 w-3.5 text-blue-300" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100/80">
                      Acesso seguro
                    </span>
                  </div>
                  <div className="hidden items-center gap-2 text-[10px] font-medium text-slate-500 sm:flex">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                    EMPROVEX
                  </div>
                </div>

                <div className="mt-7">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300/80">
                    Acesso do setor
                  </p>
                  <h2 className="mt-2 font-montserrat text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl">
                    Bem-vindo de volta.
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                    Entre com as credenciais cadastradas pela Administração EMPROVEX para acessar seu workspace.
                  </p>
                </div>

                <form onSubmit={handleSectorSubmit} className="mt-7 space-y-5">
                  <label className="group block text-left">
                    <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.11em] text-slate-400">
                      E-mail institucional
                    </span>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-blue-300" />
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(event) => setLoginEmail(event.target.value)}
                        autoComplete="email"
                        inputMode="email"
                        required
                        disabled={isSigningIn}
                        placeholder="setor@exemplo.mil.br"
                        className="emprovex-login-input h-14 w-full rounded-2xl border border-white/[0.09] bg-slate-950/35 pl-11 pr-4 text-sm font-medium text-white outline-none transition-all placeholder:text-slate-600 hover:border-white/[0.15] focus:border-blue-400/45 focus:bg-slate-950/50 focus:ring-4 focus:ring-blue-500/[0.08] disabled:opacity-60"
                      />
                    </div>
                  </label>

                  <label className="group block text-left">
                    <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.11em] text-slate-400">
                      Senha
                    </span>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-blue-300" />
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(event) => setLoginPassword(event.target.value)}
                        autoComplete="current-password"
                        required
                        disabled={isSigningIn}
                        placeholder="Digite sua senha"
                        className="emprovex-login-input h-14 w-full rounded-2xl border border-white/[0.09] bg-slate-950/35 pl-11 pr-13 text-sm font-medium text-white outline-none transition-all placeholder:text-slate-600 hover:border-white/[0.15] focus:border-blue-400/45 focus:bg-slate-950/50 focus:ring-4 focus:ring-blue-500/[0.08] disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((current) => !current)}
                        disabled={isSigningIn}
                        aria-label={showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                      >
                        {showLoginPassword
                          ? <EyeOff className="h-4 w-4" />
                          : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={isSigningIn || !loginEmail.trim() || !loginPassword}
                    aria-busy={isSigningIn}
                    className="emprovex-login-primary group relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-blue-300/10 bg-gradient-to-r from-[#063db4] via-[#0345c9] to-[#0a55dc] px-5 text-sm font-extrabold text-white shadow-[0_18px_45px_rgba(0,54,180,0.28)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(0,72,210,0.36)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
                  >
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.12] to-transparent opacity-70" />
                    {isSigningIn
                      ? <Loader2 className="relative h-5 w-5 animate-spin" />
                      : <LogIn className="relative h-5 w-5" />}
                    <span className="relative">
                      {isSigningIn ? 'Autenticando…' : 'Entrar com e-mail e senha'}
                    </span>
                    {!isSigningIn && (
                      <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    )}
                  </button>
                </form>

                <div className="my-7 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/[0.10]" />
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600">
                    Acesso institucional
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/[0.10]" />
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.045]">
                      <ShieldCheck className="h-4 w-4 text-slate-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-200">Conta fundadora HGeSM</p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">
                        A conta fundadora do HGeSM continua utilizando exclusivamente o Google.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onFounderLogin()}
                    disabled={isSigningIn}
                    className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.045] text-xs font-bold text-slate-200 transition hover:border-white/[0.16] hover:bg-white/[0.075] hover:text-white disabled:cursor-wait disabled:opacity-60"
                  >
                    {isSigningIn
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <LogIn className="h-4 w-4" />}
                    Entrar com Google — HGeSM
                  </button>
                </div>
              </div>
            </section>

            <section className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.018] px-5 py-4 text-left">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-300/80" />
                <div>
                  <h3 className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-slate-300">
                    Sobre o EMPROVEX
                  </h3>
                  <p className="mt-1.5 text-[11px] leading-5 text-slate-500">
                    Plataforma de gestão logística e financeira para setores autorizados, com workspace isolado,
                    organização documental e integração opcional ao Google Drive.
                  </p>
                </div>
              </div>
            </section>

            <footer className="mt-5 flex flex-col items-center justify-between gap-3 px-1 text-[10px] font-semibold text-slate-600 sm:flex-row">
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-start">
                <Link href="/privacy" className="transition hover:text-blue-200">
                  Política de Privacidade
                </Link>
                <Link href="/terms" className="transition hover:text-blue-200">
                  Termos de Serviço
                </Link>
                <a href="mailto:aprov1hgesm@gmail.com" className="transition hover:text-blue-200">
                  Suporte
                </a>
              </div>
              <span className="text-center uppercase tracking-[0.12em] text-slate-700">
                Ministério da Defesa • Exército Brasileiro
              </span>
            </footer>
          </div>
        </motion.main>
      </div>
    </div>
  );
}
