'use client';

import { useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
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
import { LoginAtmosphere, type LoginAmbientState } from './LoginAtmosphere';
import { LoginBrandStage } from './LoginBrandStage';
import type { LoginLogoVisualState } from './LoginLogoCore';
import { LoginStatusRail, type LoginNarrativePhase } from './LoginStatusRail';

type LoginToast = {
  message: string;
  type: 'success' | 'error' | 'info';
} | null;

type FocusedField = 'email' | 'password' | null;
type AuthMode = 'sector' | 'founder' | null;

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
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [authMode, setAuthMode] = useState<AuthMode>(null);

  const credentialsReady = Boolean(loginEmail.trim() && loginPassword);

  const logoVisualState: LoginLogoVisualState = isSigningIn
    ? 'authenticating'
    : toast?.type === 'success'
      ? 'success'
      : toast?.type === 'error'
        ? 'error'
        : 'idle';

  const panelVisualState: LoginAmbientState = isSigningIn
    ? 'authenticating'
    : toast?.type === 'error'
      ? 'error'
      : credentialsReady
        ? 'ready'
        : 'idle';

  const narrativePhase: LoginNarrativePhase = isSigningIn
    ? 'identity'
    : toast?.type === 'error'
      ? 'error'
      : 'idle';

  const handleSectorSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSigningIn) return;

    setAuthMode('sector');
    try {
      const authenticated = await onSectorLogin(loginEmail, loginPassword);
      if (authenticated) setLoginPassword('');
    } finally {
      setAuthMode(null);
    }
  };

  const handleFounderSubmit = async () => {
    if (isSigningIn) return;

    setAuthMode('founder');
    try {
      await onFounderLogin();
    } finally {
      setAuthMode(null);
    }
  };

  const handlePanelPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch') return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 100;
    const y = ((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 100;

    event.currentTarget.style.setProperty('--panel-x', `${x.toFixed(2)}%`);
    event.currentTarget.style.setProperty('--panel-y', `${y.toFixed(2)}%`);
  };

  const resetPanelPointer = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--panel-x', '50%');
    event.currentTarget.style.setProperty('--panel-y', '22%');
  };

  return (
    <div className="emprovex-login-shell relative min-h-[100svh] overflow-x-hidden bg-[#020817] font-sans text-white selection:bg-blue-500 selection:text-white">
      <ToastNotification toast={toast} onClose={onCloseToast} />
      <LoginAtmosphere focus={focusedField} state={panelVisualState} />

      <div className="emprovex-signature-intro pointer-events-none fixed inset-0 z-[4]" aria-hidden="true">
        <span className="emprovex-signature-intro__aperture" />
        <span className="emprovex-signature-intro__line emprovex-signature-intro__line--h" />
        <span className="emprovex-signature-intro__line emprovex-signature-intro__line--v" />
      </div>

      <div
        className="emprovex-signature-conduit pointer-events-none fixed inset-0 z-[6] hidden lg:block"
        data-state={panelVisualState}
        data-focus={focusedField ?? 'none'}
        aria-hidden="true"
      >
        <span className="emprovex-signature-conduit__track" />
        <span className="emprovex-signature-conduit__pulse" />
      </div>

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
            <section
              className="emprovex-login-panel relative overflow-hidden rounded-[2rem] border border-white/[0.10] bg-[#071225]/78 p-5 backdrop-blur-2xl sm:p-8 lg:p-9"
              data-state={panelVisualState}
              data-focus={focusedField ?? 'none'}
              onPointerMove={handlePanelPointerMove}
              onPointerLeave={resetPanelPointer}
              aria-labelledby="emprovex-login-heading"
            >
              <div className="emprovex-login-panel__edge pointer-events-none absolute inset-0 rounded-[inherit]" />
              <div className="emprovex-login-panel__reflection pointer-events-none absolute inset-0 rounded-[inherit]" />
              <div className="emprovex-login-panel__refraction pointer-events-none absolute inset-0 rounded-[inherit]" />
              <div className="emprovex-login-panel__beam pointer-events-none absolute inset-x-10 top-0 h-px" />
              <div
                className="emprovex-auth-scanner pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
                data-active={isSigningIn ? 'true' : 'false'}
                aria-hidden="true"
              >
                <span />
              </div>
              <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-blue-500/[0.09] blur-3xl" />

              <div className="relative z-[2]">
                <div className="flex items-center justify-between gap-4">
                  <div className="emprovex-access-pill inline-flex items-center gap-2 rounded-full border border-blue-300/[0.12] bg-blue-400/[0.055] px-3 py-1.5">
                    <LockKeyhole className="h-3.5 w-3.5 text-blue-300" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100/80">
                      Identidade e acesso
                    </span>
                  </div>
                  <div className="hidden items-center gap-2 text-[10px] font-medium text-slate-500 sm:flex">
                    <span className="emprovex-panel-status-dot h-1.5 w-1.5 rounded-full bg-blue-400/80" />
                    EMPROVEX
                  </div>
                </div>

                <div className="mt-7">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300/80">
                    Acesso do setor
                  </p>
                  <h2
                    id="emprovex-login-heading"
                    className="mt-2 font-montserrat text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl"
                  >
                    Bem-vindo de volta.
                  </h2>
                  <p id="emprovex-login-guidance" className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                    Entre com as credenciais cadastradas pela Administração EMPROVEX para acessar seu workspace.
                  </p>
                </div>

                <LoginStatusRail
                  phase={narrativePhase}
                  mode={authMode}
                  className="mt-6"
                />

                <form
                  onSubmit={handleSectorSubmit}
                  className="mt-7 space-y-5"
                  aria-describedby="emprovex-login-guidance"
                >
                  <label
                    className="emprovex-login-field group block text-left"
                    data-active={focusedField === 'email' ? 'true' : 'false'}
                  >
                    <span className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-slate-400">
                        E-mail institucional
                      </span>
                      <span className="font-mono text-[9px] font-medium tracking-[0.14em] text-slate-500/70">
                        01
                      </span>
                    </span>
                    <div className="emprovex-login-field__control relative">
                      <span className="emprovex-login-field__glow pointer-events-none absolute inset-0 rounded-2xl" />
                      <Mail className="emprovex-login-field__icon pointer-events-none absolute left-4 top-1/2 z-[2] h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(event) => setLoginEmail(event.target.value)}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        autoComplete="email"
                        inputMode="email"
                        required
                        disabled={isSigningIn}
                        placeholder="setor@exemplo.mil.br"
                        className="emprovex-login-input relative z-[1] h-14 w-full rounded-2xl border border-white/[0.09] bg-slate-950/35 pl-11 pr-4 text-sm font-medium text-white outline-none placeholder:text-slate-600 disabled:opacity-60"
                      />
                      <span className="emprovex-login-field__line pointer-events-none absolute inset-x-4 bottom-0 z-[3] h-px origin-center" />
                    </div>
                  </label>

                  <label
                    className="emprovex-login-field group block text-left"
                    data-active={focusedField === 'password' ? 'true' : 'false'}
                  >
                    <span className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-slate-400">
                        Senha
                      </span>
                      <span className="font-mono text-[9px] font-medium tracking-[0.14em] text-slate-500/70">
                        02
                      </span>
                    </span>
                    <div className="emprovex-login-field__control relative">
                      <span className="emprovex-login-field__glow pointer-events-none absolute inset-0 rounded-2xl" />
                      <KeyRound className="emprovex-login-field__icon pointer-events-none absolute left-4 top-1/2 z-[2] h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(event) => setLoginPassword(event.target.value)}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                        autoComplete="current-password"
                        required
                        disabled={isSigningIn}
                        placeholder="Digite sua senha"
                        className="emprovex-login-input relative z-[1] h-14 w-full rounded-2xl border border-white/[0.09] bg-slate-950/35 pl-11 pr-13 text-sm font-medium text-white outline-none placeholder:text-slate-600 disabled:opacity-60"
                      />
                      <span className="emprovex-login-field__line pointer-events-none absolute inset-x-4 bottom-0 z-[3] h-px origin-center" />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((current) => !current)}
                        disabled={isSigningIn}
                        aria-label={showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        className="emprovex-password-toggle absolute right-1.5 top-1/2 z-[4] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 disabled:opacity-50"
                      >
                        {showLoginPassword
                          ? <EyeOff className="h-4 w-4" />
                          : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={isSigningIn || !credentialsReady}
                    aria-busy={isSigningIn && authMode === 'sector'}
                    data-state={isSigningIn && authMode === 'sector' ? 'authenticating' : credentialsReady ? 'ready' : 'idle'}
                    className="emprovex-login-primary group relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-blue-300/10 px-5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <span className="emprovex-login-primary__base pointer-events-none absolute inset-0" />
                    <span className="emprovex-login-primary__sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3" />
                    <span className="emprovex-login-primary__edge pointer-events-none absolute inset-0 rounded-[inherit]" />
                    {isSigningIn && authMode === 'sector'
                      ? <Loader2 className="relative h-5 w-5 animate-spin" />
                      : <LogIn className="relative h-5 w-5" />}
                    <span className="relative">
                      {isSigningIn && authMode === 'sector' ? 'Autenticando…' : 'Entrar com e-mail e senha'}
                    </span>
                    {!(isSigningIn && authMode === 'sector') && (
                      <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-1" />
                    )}
                  </button>
                </form>

                <div className="my-7 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/[0.10]" />
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500/80">
                    Acesso institucional
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/[0.10]" />
                </div>

                <div className="emprovex-institutional-card rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <div className="flex items-start gap-3">
                    <div className="emprovex-institutional-card__icon mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.045]">
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
                    onClick={() => void handleFounderSubmit()}
                    disabled={isSigningIn}
                    aria-busy={isSigningIn && authMode === 'founder'}
                    data-state={isSigningIn && authMode === 'founder' ? 'authenticating' : 'idle'}
                    className="emprovex-google-button group relative mt-4 flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-white/[0.10] bg-white/[0.045] text-xs font-bold text-slate-200 disabled:cursor-wait disabled:opacity-60"
                  >
                    <span className="emprovex-google-button__sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3" />
                    {isSigningIn && authMode === 'founder'
                      ? <Loader2 className="relative h-4 w-4 animate-spin" />
                      : <LogIn className="relative h-4 w-4" />}
                    <span className="relative">Entrar com Google — HGeSM</span>
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

            <footer className="mt-5 flex flex-col items-center justify-between gap-3 px-1 text-[10px] font-semibold text-slate-500 sm:flex-row">
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-start">
                <Link href="/privacy" className="emprovex-login-footer-link transition hover:text-blue-200">
                  Política de Privacidade
                </Link>
                <Link href="/terms" className="emprovex-login-footer-link transition hover:text-blue-200">
                  Termos de Serviço
                </Link>
                <a href="mailto:aprov1hgesm@gmail.com" className="emprovex-login-footer-link transition hover:text-blue-200">
                  Suporte
                </a>
              </div>
              <span className="text-center uppercase tracking-[0.12em] text-slate-500/75">
                Ministério da Defesa • Exército Brasileiro
              </span>
            </footer>
          </div>
        </motion.main>
      </div>
    </div>
  );
}
