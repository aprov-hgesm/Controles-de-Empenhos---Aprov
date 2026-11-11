import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, PackageCheck, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Almoxarifado | EMPROVEX',
  description: 'Entrada para a Central de Depósitos, com autenticação e permissões do módulo existente.',
};

export default function AlmoxarifadoEntry() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#061324] px-5 py-12 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-white/15 bg-white/[0.05] p-7 sm:p-10" aria-labelledby="warehouse-title">
        <PackageCheck className="mb-5 text-sky-300" size={36} aria-hidden="true" />
        <h1 id="warehouse-title" className="text-3xl font-extrabold">Almoxarifado</h1>
        <p className="mt-4 leading-7 text-slate-300">A Central de Depósitos mantém sua autenticação, o vínculo ao setor, as permissões, o aceite legal e a verificação de assinatura originais.</p>
        <div className="mt-6 flex items-center gap-3 rounded-xl bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
          <ShieldCheck size={20} className="shrink-0" aria-hidden="true" /> Apenas contas autorizadas conseguem abrir o módulo.
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/central-depositos" className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-300 px-5 py-3 font-bold text-slate-950 transition hover:bg-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            Abrir Central de Depósitos <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link href="/aprovisionamento" className="inline-flex items-center justify-center rounded-xl border border-white/20 px-5 py-3 font-semibold hover:bg-white/10">Entrar na minha conta</Link>
        </div>
        <Link href="/" className="mt-7 inline-block text-sm text-sky-200 underline underline-offset-4">Voltar ao portal</Link>
      </section>
    </main>
  );
}
