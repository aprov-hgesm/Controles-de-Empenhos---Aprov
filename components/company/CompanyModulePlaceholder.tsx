'use client';

import { useCompanySession } from './CompanySessionContext';
import { CircleCheck, Clock3 } from 'lucide-react';
import type { CompanyModuleSlug } from '../../features/company/modules';
import { companyModuleBySlug } from '../../features/company/modules';

export function CompanyModulePlaceholder({ slug }: { slug: CompanyModuleSlug }) {
  const module = companyModuleBySlug(slug);
  const session = useCompanySession();
  if (!module) return null;

  return (
    <>
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">Operação empresarial</p>
        <h1 className="mt-2 font-montserrat text-3xl font-extrabold tracking-tight text-[#112847] sm:text-4xl">{module.label}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{module.description}</p>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          {slug === 'configuracoes' ? <CircleCheck size={22} /> : <Clock3 size={22} />}
        </div>
        <h2 className="mt-5 text-lg font-bold text-slate-900">
          {slug === 'configuracoes' ? 'Sua conta está vinculada ao EMPROVEX Empresas' : 'Módulo em preparação'}
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
          {slug === 'configuracoes'
            ? 'Identidade e acesso são validados pelo servidor. As preferências empresariais estarão disponíveis em uma próxima etapa.'
            : 'Estamos preparando as funcionalidades deste módulo. Não existem dados operacionais simulados nesta tela.'}
        </p>
        {slug === 'configuracoes' && session && (
          <dl className="mt-7 grid gap-4 border-t border-slate-100 pt-7 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Empresa</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{session.companyName}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">E-mail autorizado</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{session.authorizedEmail}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Identificador do workspace</dt><dd className="mt-1 break-words font-mono text-xs text-slate-800">{session.workspaceId}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Situação</dt><dd className="mt-1 text-sm font-semibold text-emerald-700">Acesso ativo</dd></div>
          </dl>
        )}
      </section>
    </>
  );
}
