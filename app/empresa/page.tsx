'use client';
import { useMemo, useState } from 'react';
import { ArrowRight, Building2, Compass, Layers3, ShieldCheck } from 'lucide-react';
import {
  COMPANY_SHELL_MODULES, companyShellHref, filterCompanyShellModules,
  type CompanySectionGroup,
} from '../../features/company/shell/navigation';
import { CompanyEmptyState, CompanySearchFilters, CompanyStatus } from '../../components/company/CompanyFeedback';
import { useCompanySession } from '../../components/company/CompanySessionContext';

export default function CompanyHomePage() {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<CompanySectionGroup | 'Todos'>('Todos');
  const session = useCompanySession();
  const modules = useMemo(() =>
    filterCompanyShellModules(COMPANY_SHELL_MODULES.filter((item) => item.slug), query, group),
    [query, group]);
  return <main id="company-main" tabIndex={-1} className="outline-none">
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a1c39] via-[#123c78] to-[#1d5ea6] px-6 py-9 text-white shadow-lg sm:px-10 sm:py-11">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-28 h-72 w-72 rounded-full border border-white/10 motion-reduce:hidden"/>
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-blue-200"><Building2 size={15} aria-hidden="true"/> EMPROVEX Empresas</p>
      <h1 className="mt-4 max-w-3xl font-montserrat text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
        Um espaço para organizar sua operação empresarial.
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100">
        Estrutura preparada para pedidos de OM, empenhos, compras, fornecedores, estoque, entregas e gestão financeira.
        As operações ainda serão integradas e homologadas.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold"><ShieldCheck size={15} aria-hidden="true"/> Workspace empresarial isolado</span>
        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold">Sem dados demonstrativos fictícios</span>
      </div>
    </div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3"><span className="rounded-xl bg-blue-50 p-2 text-blue-700"><Compass size={22} aria-hidden="true"/></span>
          <div><h2 className="font-bold text-slate-950">Acesso aos módulos</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Navegue pelas áreas da empresa. A disponibilidade de cada tela é identificada.</p></div></div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3"><span className="rounded-xl bg-slate-100 p-2 text-slate-700"><Layers3 size={22} aria-hidden="true"/></span>
          <div><h2 className="font-bold text-slate-950">Operação em preparação</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Nenhum volume, valor ou indicador operacional é exibido sem uma fonte autorizada.</p></div></div>
      </section>
    </div>
    <section aria-labelledby="company-modules-title" className="mt-9">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Estrutura empresarial</p>
          <h2 id="company-modules-title" className="mt-1 font-montserrat text-2xl font-extrabold text-slate-950">Módulos da plataforma</h2></div>
        <p className="text-sm text-slate-500" role="status" aria-live="polite">{modules.length} de {COMPANY_SHELL_MODULES.length - 1} módulos</p>
      </div>
      <CompanySearchFilters query={query} onQueryChange={setQuery} group={group} onGroupChange={setGroup}/>
      {modules.length === 0 ? <div className="mt-5"><CompanyEmptyState/></div> :
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => <a key={module.slug} href={companyShellHref(module.slug)}
          className="group flex min-h-[190px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm outline-none transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-600 motion-reduce:transform-none motion-reduce:transition-none">
          <div className="flex items-start justify-between gap-3">
            <span className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-800">{module.group}</span>
            <ArrowRight className="text-slate-400 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" size={18} aria-hidden="true"/>
          </div>
          <h3 className="mt-4 font-bold text-slate-950">{module.label}</h3>
          <p className="mt-1 flex-1 text-sm leading-6 text-slate-600">{module.description}</p>
          <div className="mt-4">{module.kind === 'preparing' ? <CompanyStatus/> : <span className="text-xs font-semibold text-emerald-700">Identidade validada</span>}</div>
        </a)}
      </div>}
    </section>
    <p className="mt-8 text-xs leading-6 text-slate-500">
      {session ? `Ambiente associado a ${session.companyName}. ` : ''}
      Em preparação: funções operacionais dependem de APIs e permissões integradas pelos Workers responsáveis.
    </p>
  </main>;
}
