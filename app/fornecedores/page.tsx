import type { Metadata } from 'next';
import { Building2, LockKeyhole } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Fornecedores | EMPROVEX',
  description: 'Informações sobre o acesso empresarial especializado do EMPROVEX.',
};

export default function FornecedoresEntry() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#061324] px-5 py-12 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-white/15 bg-white/[0.05] p-7 sm:p-10" aria-labelledby="supplier-title">
        <Building2 size={36} aria-hidden="true" className="mb-5 text-sky-300" />
        <h1 id="supplier-title" className="text-3xl font-extrabold">Fornecedores</h1>
        <p className="mt-4 leading-7 text-slate-300">A entrada empresarial especializada ainda não está habilitada nesta versão. Para proteger contas e dados, este endereço não cria uma sessão empresarial fictícia nem concede acesso ao setor militar.</p>
        <p role="status" className="mt-6 flex items-center gap-2 rounded-xl bg-white/10 p-4 text-sm text-slate-100">
          <LockKeyhole size={18} aria-hidden="true" /> Acesso empresarial aguardando integração autorizada.
        </p>
        <div className="mt-8 flex flex-wrap gap-5 text-sm font-semibold">
          <a href="/" className="text-sky-200 underline underline-offset-4">Voltar ao portal</a>
          <a href="/info" className="text-sky-200 underline underline-offset-4">Conhecer o EMPROVEX</a>
        </div>
      </section>
    </main>
  );
}
