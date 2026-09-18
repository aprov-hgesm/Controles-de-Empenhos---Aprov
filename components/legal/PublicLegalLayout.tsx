import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

interface PublicLegalLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  updatedAt: string;
  children: ReactNode;
}

export function PublicLegalLayout({
  eyebrow,
  title,
  description,
  updatedAt,
  children,
}: PublicLegalLayoutProps) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f4f7fb] via-white to-[#eef3fb] text-[#0b1c30]">
      <header className="border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-extrabold text-[#00288e] transition hover:text-[#001e6a]"
          >
            <ArrowLeft className="h-4 w-4" />
            EMPROVEX
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#00288e]">
            <ShieldCheck className="h-4 w-4" />
            Documento público
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#00288e]">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
          <p className="mt-4 text-xs font-semibold text-slate-400">Última atualização: {updatedAt}</p>

          <div className="mt-8 space-y-8 text-sm leading-7 text-slate-700">
            {children}
          </div>
        </div>

        <footer className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:flex-row">
          <span>EMPROVEX — Gestão Logística e Financeira</span>
          <nav className="flex items-center gap-4 font-bold">
            <Link href="/privacy" className="hover:text-[#00288e]">Privacidade</Link>
            <Link href="/terms" className="hover:text-[#00288e]">Termos de Serviço</Link>
          </nav>
        </footer>
      </section>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-black text-slate-900">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
