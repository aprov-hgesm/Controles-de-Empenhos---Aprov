'use client';

import { Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

import { LoginAtmosphere } from './LoginAtmosphere';
import { LoginStatusRail } from './LoginStatusRail';

interface EmprovexAuthLoadingProps {
  hasAuthenticatedIdentity: boolean;
}

export function EmprovexAuthLoading({
  hasAuthenticatedIdentity,
}: EmprovexAuthLoadingProps) {
  const reduceMotion = useReducedMotion();
  const phase = hasAuthenticatedIdentity ? 'workspace' : 'session';

  return (
    <div className="emprovex-login-shell relative min-h-[100svh] overflow-hidden bg-[#020817] font-sans text-white">
      <LoginAtmosphere state="authenticating" />

      <div className="relative z-10 flex min-h-[100svh] items-center justify-center px-5 py-10">
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          className="emprovex-auth-loading-panel relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/[0.10] bg-[#071225]/82 p-6 shadow-[0_35px_110px_rgba(0,7,28,0.62)] backdrop-blur-2xl sm:p-8"
        >
          <div className="emprovex-auth-loading-panel__edge pointer-events-none absolute inset-0 rounded-[inherit]" />
          <div className="emprovex-auth-scanner pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
            <span />
          </div>

          <div className="relative z-[2]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.20em] text-blue-300/65">
                  EMPROVEX
                </p>
                <h1 className="mt-1 font-montserrat text-2xl font-black tracking-[0.08em] text-white">
                  ACESSO
                </h1>
              </div>

              <div className="emprovex-auth-loading-spinner flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-300/[0.11] bg-blue-400/[0.055]">
                <Loader2 className="h-5 w-5 animate-spin text-blue-200" />
              </div>
            </div>

            <div className="my-6 h-px bg-gradient-to-r from-transparent via-white/[0.09] to-transparent" />

            <LoginStatusRail phase={phase} />

            <p className="mt-5 text-center text-[10px] font-medium leading-5 text-slate-600">
              {hasAuthenticatedIdentity
                ? 'A aplicação só será liberada depois que o contexto de acesso for resolvido.'
                : 'Nenhuma ação é necessária enquanto a sessão é verificada.'}
            </p>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
