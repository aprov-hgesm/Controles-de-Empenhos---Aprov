'use client';

import { Boxes, FileCheck2, LineChart, ShieldCheck } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

import { LoginLogoCore, type LoginLogoVisualState } from './LoginLogoCore';

interface LoginBrandStageProps {
  customLogo: string | null;
  visualState: LoginLogoVisualState;
}

const capabilities = [
  { icon: Boxes, label: 'Empenhos', detail: 'Controle e execução' },
  { icon: FileCheck2, label: 'Documentos', detail: 'Recebimento e liquidação' },
  { icon: LineChart, label: 'Gestão', detail: 'Visão logística e financeira' },
];

const brandLetters = 'EMPROVEX'.split('');

export function LoginBrandStage({ customLogo, visualState }: LoginBrandStageProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex min-h-[23rem] flex-col justify-between overflow-hidden px-6 pb-7 pt-8 sm:min-h-[28rem] sm:px-10 sm:pb-9 sm:pt-10 lg:min-h-0 lg:px-12 lg:py-12 xl:px-16 xl:py-16"
      aria-labelledby="emprovex-login-title"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[8%] top-[10%] h-64 w-64 rounded-full bg-blue-500/[0.12] blur-3xl" />
        <div className="absolute bottom-[12%] right-[4%] h-80 w-80 rounded-full bg-cyan-400/[0.07] blur-3xl" />
        <div className="absolute left-[12%] top-[32%] h-px w-[68%] bg-gradient-to-r from-transparent via-blue-300/20 to-transparent" />
      </div>

      <div className="relative z-10">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.045] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-blue-100/80 backdrop-blur-sm"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-blue-300" />
          Plataforma integrada de gestão
        </motion.div>

        <div className="mt-8 flex items-center gap-5 sm:mt-12 sm:gap-7 lg:mt-20">
          <LoginLogoCore customLogo={customLogo} state={visualState} />

          <div className="min-w-0">
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-blue-300/70"
            >
              Sistema operacional
            </motion.p>

            <h1
              id="emprovex-login-title"
              aria-label="EMPROVEX"
              className="emprovex-brand-wordmark mt-1 flex font-montserrat text-3xl font-black text-white sm:text-5xl xl:text-6xl"
            >
              {brandLetters.map((letter, index) => (
                <motion.span
                  key={`${letter}-${index}`}
                  aria-hidden="true"
                  initial={
                    reduceMotion
                      ? false
                      : { opacity: 0, y: 14, filter: 'blur(7px)', letterSpacing: '0.22em' }
                  }
                  animate={{
                    opacity: 1,
                    y: 0,
                    filter: 'blur(0px)',
                    letterSpacing: '0.08em',
                  }}
                  transition={{
                    duration: 0.72,
                    delay: 0.26 + index * 0.045,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="inline-block"
                >
                  {letter}
                </motion.span>
              ))}
            </h1>

            <motion.div
              initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.62, ease: [0.16, 1, 0.3, 1] }}
              className="emprovex-brand-wordmark-line mt-2 h-px w-24 origin-left sm:w-32"
            />
          </div>
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-7 max-w-2xl sm:mt-10 lg:mt-12"
        >
          <p className="font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-blue-200 sm:text-base">
            Gestão Logística e Financeira
          </p>
          <p className="mt-3 max-w-xl text-base font-medium leading-relaxed text-slate-100/90 sm:mt-4 sm:text-xl lg:text-2xl">
            Inteligência operacional para transformar execução, documentos e controle em uma visão única.
          </p>
          <p className="mt-3 hidden max-w-xl text-sm leading-6 text-slate-400 sm:block sm:text-[15px]">
            Uma plataforma para setores de aprovisionamento trabalharem com mais rastreabilidade,
            organização e clareza em cada etapa do processo.
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.66 }}
        className="relative z-10 mt-8 hidden sm:block sm:mt-10"
      >
        <div className="grid gap-3 sm:grid-cols-3 lg:max-w-2xl">
          {capabilities.map(({ icon: Icon, label, detail }) => (
            <div
              key={label}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-4 backdrop-blur-sm"
            >
              <Icon className="h-4 w-4 text-blue-300" />
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.13em] text-white">{label}</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">{detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2 text-[11px] font-medium text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_12px_rgba(52,211,153,0.45)]" />
          Acesso protegido por identidade autenticada e workspace autorizado
        </div>
      </motion.div>
    </motion.section>
  );
}
