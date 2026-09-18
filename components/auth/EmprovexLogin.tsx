'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Eye, EyeOff, KeyRound, Loader2, LogIn, Mail } from 'lucide-react';

import { ToastNotification } from '../layout/ToastNotification';

type LoginToast = {
  message: string;
  type: 'success' | 'error' | 'info';
} | null;

interface EmprovexLoginProps {
  customLogo: string | null;
  isSigningIn: boolean;
  toast: LoginToast;
  onCloseToast: () => void;
  onSectorLogin: (email: string, password: string) => Promise<void>;
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

  const handleSectorSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSigningIn) return;

    await onSectorLogin(loginEmail, loginPassword);
    setLoginPassword('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1c30] via-[#001453] to-[#0a1a2e] flex flex-col items-center justify-center p-6 text-white font-sans selection:bg-blue-500 selection:text-white">
      <ToastNotification toast={toast} onClose={onCloseToast} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/10 shadow-2xl"
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-gradient-to-tr from-[#00288e] to-[#1e4fc2] rounded-2xl flex items-center justify-center shadow-xl border border-white/25 overflow-hidden p-2">
            {customLogo ? (
              <img src={customLogo} alt="Logotipo EMPROVEX" className="w-full h-full object-contain" />
            ) : (
              <span className="text-2xl font-extrabold text-white tracking-widest font-montserrat">EMP</span>
            )}
          </div>

          <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-wider text-white uppercase font-montserrat">
            EMPROVEX
          </h2>
          <p className="text-xs sm:text-sm font-bold text-blue-200 uppercase tracking-widest mt-1.5 font-montserrat">
            Gestão Logística e Financeira
          </p>
          <p className="mt-2 text-xs text-gray-300 font-medium">
            Plataforma de Gestão dos Setores de Aprovisionamento
          </p>
        </div>

        <div className="my-6 h-px bg-white/10" />

        <form onSubmit={handleSectorSubmit} className="space-y-4">
          <div className="text-left">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-blue-200">
              <KeyRound className="h-4 w-4" />
              Acesso do setor
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Use o e-mail e a senha cadastrados pela Administração EMPROVEX.
            </p>
          </div>

          <label className="block text-left">
            <span className="mb-1.5 block text-xs font-bold text-slate-300">E-mail</span>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                autoComplete="email"
                inputMode="email"
                required
                disabled={isSigningIn}
                placeholder="setor@exemplo.mil.br"
                className="h-12 w-full rounded-xl border border-white/10 bg-slate-950/30 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/50 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
              />
            </div>
          </label>

          <label className="block text-left">
            <span className="mb-1.5 block text-xs font-bold text-slate-300">Senha</span>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showLoginPassword ? 'text' : 'password'}
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                autoComplete="current-password"
                required
                disabled={isSigningIn}
                placeholder="Digite sua senha"
                className="h-12 w-full rounded-xl border border-white/10 bg-slate-950/30 pl-10 pr-12 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/50 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword((current) => !current)}
                disabled={isSigningIn}
                aria-label={showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
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
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#00288e] text-sm font-bold text-white shadow-md transition-all hover:bg-[#001e6a] hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
          >
            {isSigningIn
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : <LogIn className="h-5 w-5" />}
            {isSigningIn ? 'Autenticando…' : 'Entrar com e-mail e senha'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Acesso institucional</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="text-left">
          <p className="text-xs leading-relaxed text-slate-400">
            A conta fundadora do HGeSM continua utilizando exclusivamente o Google.
          </p>
          <button
            type="button"
            onClick={() => void onFounderLogin()}
            disabled={isSigningIn}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
          >
            {isSigningIn
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <LogIn className="h-4 w-4" />}
            Entrar com Google — HGeSM
          </button>
        </div>
      </motion.div>

      <section className="mt-6 w-full max-w-3xl rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-5 text-left backdrop-blur-sm">
        <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-blue-100">
          Sobre o EMPROVEX
        </h3>
        <p className="mt-2 text-xs leading-6 text-slate-300 sm:text-sm">
          O EMPROVEX é uma plataforma de gestão logística e financeira para setores autorizados,
          com recursos para empenhos, notas fiscais, recebimentos, liquidação, cronogramas,
          relatórios e organização documental. Cada setor opera em workspace isolado e pode,
          quando habilitado, conectar seu próprio Google Drive para os documentos utilizados pelo sistema.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold">
          <Link href="/privacy" className="text-blue-200 transition hover:text-white hover:underline">
            Política de Privacidade
          </Link>
          <Link href="/terms" className="text-blue-200 transition hover:text-white hover:underline">
            Termos de Serviço
          </Link>
          <a href="mailto:aprov1hgesm@gmail.com" className="text-blue-200 transition hover:text-white hover:underline">
            Suporte
          </a>
        </div>
      </section>

      <p className="mt-5 text-center text-[10px] font-semibold uppercase tracking-widest text-gray-500">
        Ministério da Defesa • Exército Brasileiro
      </p>
    </div>
  );
}
