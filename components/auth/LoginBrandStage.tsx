'use client';

import Image from 'next/image';
import { Boxes, FileCheck2, LineChart, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginBrandStageProps {
  customLogo: string | null;
}

const capabilities = [
  { icon: Boxes, label: 'Empenhos', detail: 'Controle e execução' },
  { icon: FileCheck2, label: 'Documentos', detail: 'Recebimento e liquidação' },
  { icon: LineChart, label: 'Gestão', detail: 'Visão logística e financeira' },
];

export function LoginBrandStage({ customLogo }: LoginBrandStageProps) {
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
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.045] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-blue-100/80 backdrop-blur-sm">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-300" />
          Plataforma integrada de gestão
        </div>

        <div className="mt-8 flex items-center gap-4 sm:mt-12 sm:gap-5 lg:mt-20">
          <div className="relative">
            <div className="absolute inset-[-18px] rounded-[2rem] bg-blue-500/10 blur-2xl" />
            <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/[0.16] bg-gradient-to-br from-white/[0.13] to-white/[0.035] p-2.5 shadow-[0_28px_80px_rgba(0,17,65,0.42)] backdrop-blur-xl sm:h-28 sm:w-28 sm:rounded-[1.75rem] sm:p-3">
              {customLogo ? (
                <Image
                  src={customLogo}
                  alt="Logotipo EMPROVEX"
                  width={112}
                  height={112}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="font-montserrat text-2xl font-black tracking-[0.14em] text-white sm:text-3xl">
                  EMP
                </span>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-blue-300/70">
              Sistema operacional
            </p>
            <h1
              id="emprovex-login-title"
              className="mt-1 font-montserrat text-3xl font-black tracking-[0.08em] text-white sm:text-5xl xl:text-6xl"
            >
              EMPROVEX
            </h1>
          </div>
        </div>

        <div className="mt-7 max-w-2xl sm:mt-10 lg:mt-12">
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
        </div>
      </div>

      <div className="relative z-10 mt-8 hidden sm:block sm:mt-10">
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
      </div>
    </motion.section>
  );
}
