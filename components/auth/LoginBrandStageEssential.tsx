'use client';

import { Boxes, FileCheck2, LineChart, ShieldCheck } from 'lucide-react';

interface LoginBrandStageEssentialProps {
  customLogo: string | null;
}

const CAPABILITIES = [
  { icon: Boxes, title: 'Empenhos', subtitle: 'Execução organizada' },
  { icon: FileCheck2, title: 'Documentos', subtitle: 'Controle e recebimento' },
  { icon: LineChart, title: 'Gestão', subtitle: 'Informação acessível' },
] as const;

/**
 * Alternativa estática ao palco animado de login.
 * Apenas apresentação: sem alterar autenticação, formulário ou identificação.
 */
export function LoginBrandStageEssential({ customLogo }: LoginBrandStageEssentialProps) {
  return (
    <section
      className="relative flex min-h-[19rem] flex-col justify-between gap-9 overflow-hidden bg-[linear-gradient(145deg,#061529,#0b2642)] px-6 py-9 sm:px-10 lg:min-h-full lg:px-12 lg:py-14 xl:px-16"
      aria-labelledby="emprovex-login-title"
      data-testid="login-brand-essential"
    >
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/15 bg-blue-300/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100/80">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-300" aria-hidden="true" />
          Plataforma integrada de gestão
        </div>
        <div className="mt-9 flex items-center gap-5">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-blue-300/20 bg-[#102f50] p-2 shadow-[0_10px_30px_rgba(0,0,0,0.20)] sm:h-24 sm:w-24">
            {customLogo ? (
              <img src={customLogo} alt="" className="h-full w-full object-contain" />
            ) : (
              <span className="font-montserrat text-xl font-black tracking-wider text-blue-100">EMP</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.23em] text-blue-300/80">Sistema operacional</p>
            <h1 id="emprovex-login-title" className="mt-1 font-montserrat text-3xl font-black tracking-tight text-white sm:text-4xl">
              EMPROVEX
            </h1>
            <div className="mt-3 h-px w-28 bg-blue-300/45" aria-hidden="true" />
          </div>
        </div>
        <h2 className="mt-9 font-montserrat text-sm font-bold uppercase tracking-[0.17em] text-blue-200">
          Gestão Logística e Financeira
        </h2>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-200">
          Execução, documentos e estoque organizados em uma única plataforma.
        </p>
      </div>
      <div className="relative z-10 grid gap-3 sm:grid-cols-3">
        {CAPABILITIES.map(({ icon: Icon, title, subtitle }) => (
          <div key={title} className="rounded-xl border border-blue-200/10 bg-[#102943] p-3">
            <Icon className="h-4 w-4 text-blue-300" aria-hidden="true" />
            <strong className="mt-2 block text-xs text-slate-100">{title}</strong>
            <span className="mt-1 block text-[11px] leading-snug text-slate-400">{subtitle}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
