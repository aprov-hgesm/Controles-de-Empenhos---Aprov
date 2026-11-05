'use client';
import Link from 'next/link';
import { ArrowLeft, CircleCheck, Clock3, LockKeyhole } from 'lucide-react';
import { companyShellModuleBySlug } from '../../features/company/shell/navigation';
import { useCompanySession } from './CompanySessionContext';
import { CompanyStatus } from './CompanyFeedback';

export function CompanyModulePlaceholder({ slug }: { slug: string }) {
  const module = companyShellModuleBySlug(slug);
  const session = useCompanySession();
  if (!module) return null;
  return <main id="company-main" tabIndex={-1} className="outline-none">
    <nav aria-label="Localização" className="text-xs font-semibold text-slate-500">
      <Link className="hover:text-blue-700 focus-visible:underline" href="/empresa">Início</Link>
      <span aria-hidden="true" className="px-2">/</span><span aria-current="page">{module.label}</span>
    </nav>
    <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">EMPROVEX Empresas</p>
        <h1 className="mt-2 font-montserrat text-3xl font-extrabold text-[#112847] sm:text-4xl">{module.label}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{module.description}</p>
      </div>
      {module.kind === 'preparing' && <CompanyStatus/>}
    </header>
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
        {module.kind === 'identity' ? <LockKeyhole size={23} aria-hidden="true"/> : <Clock3 size={23} aria-hidden="true"/>}
      </div>
      <h2 className="mt-5 text-lg font-bold text-slate-950">
        {module.kind === 'identity' ? 'Identidade empresarial validada' : 'Em preparação'}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
        {module.kind === 'identity'
          ? 'O acesso é verificado pelo servidor. Preferências administrativas e permissões adicionais serão disponibilizadas após integração segura.'
          : 'Este módulo ainda não consulta nem grava dados operacionais. Nenhuma informação fictícia está sendo apresentada como real.'}
      </p>
      {module.kind === 'identity' && session && <dl className="mt-7 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
        <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Empresa</dt><dd className="mt-1 break-words font-semibold text-slate-900">{session.companyName}</dd></div>
        <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">E-mail autorizado</dt><dd className="mt-1 break-words text-sm text-slate-800">{session.authorizedEmail}</dd></div>
        <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Workspace</dt><dd className="mt-1 break-all font-mono text-xs text-slate-800">{session.workspaceId}</dd></div>
        <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Situação</dt>
          <dd className="mt-1 flex items-center gap-1 text-sm font-semibold text-emerald-700"><CircleCheck size={15} aria-hidden="true"/> Acesso validado</dd></div>
      </dl>}
      <Link href="/empresa" className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">
        <ArrowLeft size={16} aria-hidden="true"/>Voltar ao início
      </Link>
    </section>
  </main>;
}
