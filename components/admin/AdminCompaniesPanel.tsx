'use client';

import { useMemo, useState } from 'react';
import { Building2, ChevronRight, Plus, RefreshCw, Search, X } from 'lucide-react';
import type { AdminCompany } from '../../hooks/usePlatformAdminCompanies';

interface Props {
  companies: AdminCompany[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onCreateRequested: () => void;
}

const show = (value: string) => value || 'Não informado';
const cnpjDisplay = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  return numbers.length === 14
    ? numbers.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : show(value);
};
const dateDisplay = (value: unknown): string => {
  let parsed: Date | null = null;
  if (typeof value === 'string' || typeof value === 'number') parsed = new Date(value);
  else if (value && typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') {
    parsed = new Date(value.seconds * 1000);
  }
  return parsed && !Number.isNaN(parsed.valueOf()) ? parsed.toLocaleDateString('pt-BR') : 'Não informado';
};

function Detail({ company, onClose }: { company: AdminCompany; onClose: () => void }) {
  const sections: Array<{ title: string; rows: Array<[string, string]> }> = [
    { title: 'Identificação', rows: [['Razão social', company.legalName], ['Nome fantasia', company.tradeName], ['CNPJ', cnpjDisplay(company.cnpj)], ['Workspace', company.workspaceId]] },
    { title: 'Responsável e acesso', rows: [['Responsável', company.responsibleName], ['WhatsApp / telefone', company.responsiblePhone], ['E-mail da empresa', company.companyEmail], ['E-mail de login', company.loginEmail]] },
    { title: 'Localização', rows: [['CEP', company.postalCode], ['Endereço', company.address], ['Número', company.addressNumber], ['Complemento', company.addressComplement], ['Cidade', company.city], ['UF', company.state]] },
    { title: 'Conta', rows: [['Situação', company.status], ['Data de cadastro', dateDisplay(company.createdAt)]] },
  ];
  return (
    <section className="mt-5 rounded-2xl border border-blue-300/20 bg-blue-400/[0.055] p-4 sm:p-6" aria-label="Detalhes da empresa" data-testid="admin-company-detail">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Ficha empresarial</p>
          <h4 className="mt-1 break-words text-lg font-extrabold text-white">{show(company.tradeName || company.legalName)}</h4></div>
        <button type="button" onClick={onClose} aria-label="Fechar detalhes" className="rounded-lg border border-white/10 p-2 text-slate-300 hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {sections.map((section) => (
          <div key={section.title} className="min-w-0 rounded-xl border border-white/10 bg-black/15 p-4">
            <h5 className="mb-3 border-b border-white/10 pb-2 text-xs font-extrabold text-blue-100">{section.title}</h5>
            <dl className="space-y-3">{section.rows.map(([label, value]) => (
              <div key={label}><dt className="text-[10px] font-semibold text-slate-500">{label}</dt>
                <dd className="mt-0.5 break-words text-xs font-medium text-slate-100">{show(value)}</dd></div>
            ))}</dl>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-400">Edição cadastral, assinaturas e gerenciamento de usuários serão disponibilizados após a implementação das APIs administrativas específicas.</p>
    </section>
  );
}

export function AdminCompaniesPanel({ companies, loading, error, onRefresh, onCreateRequested }: Props) {
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');
    if (!term) return companies;
    return companies.filter((company) => [company.legalName, company.tradeName, company.cnpj, company.companyEmail, company.loginEmail]
      .some((value) => value.toLocaleLowerCase('pt-BR').includes(term)));
  }, [companies, query]);
  const keyFor = (company: AdminCompany, index: number) => company.workspaceId || `row-${index}`;
  const selected = selectedKey === null ? null
    : filtered.find((company, index) => keyFor(company, index) === selectedKey) ?? null;

  return (
    <section data-testid="admin-companies-panel" className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#071225]/90 text-white shadow-xl">
      <header className="flex flex-col gap-4 border-b border-white/10 px-5 py-6 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-blue-200"><Building2 className="h-4 w-4" /> Diretório empresarial</p>
          <h3 className="mt-2 text-xl font-extrabold">Empresas</h3>
          <p className="mt-1 text-xs text-slate-400">Consulte empresas cadastradas e suas identidades de acesso, sem informações sensíveis.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50"><RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} /> Atualizar</button>
          <button type="button" onClick={onCreateRequested} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-500"><Plus className="h-4 w-4" /> Cadastrar empresa</button>
        </div>
      </header>
      <div className="space-y-4 p-5 sm:p-7">
        <label className="relative block">
          <span className="sr-only">Pesquisar empresas</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, CNPJ ou e-mail..." className="min-h-11 w-full rounded-xl border border-white/10 bg-black/20 pl-10 pr-4 text-xs text-white outline-none placeholder:text-slate-500 focus:border-blue-300/40" />
        </label>
        {error && <div role="alert" className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-4 text-xs text-amber-100">{error}</div>}
        {loading && <div role="status" className="rounded-xl border border-white/10 p-5 text-xs text-slate-300">Consultando empresas cadastradas...</div>}
        {!loading && !error && filtered.length === 0 && <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-xs text-slate-400">{companies.length ? 'Nenhuma empresa corresponde à pesquisa.' : 'Nenhuma empresa cadastrada.'}</div>}
        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[950px] border-collapse text-left text-xs">
              <thead className="bg-white/[0.05] text-[10px] uppercase tracking-wide text-slate-400">
                <tr>{['Empresa', 'CNPJ', 'Workspace', 'E-mail de acesso', 'Responsável', 'Situação', 'Cadastro', ''].map((label, index) => <th scope="col" key={index} className="px-3 py-4 font-bold">{label}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((company, index) => (
                  <tr key={keyFor(company, index)} className="border-t border-white/[0.07] hover:bg-white/[0.035]">
                    <td className="max-w-[220px] px-3 py-4 align-top"><p className="break-words font-bold text-white">{show(company.tradeName || company.legalName)}</p><p className="mt-1 break-words text-[10px] text-slate-400">{company.tradeName && company.legalName ? company.legalName : ''}</p></td>
                    <td className="px-3 py-4 align-top">{cnpjDisplay(company.cnpj)}</td>
                    <td className="px-3 py-4 align-top">{show(company.workspaceId)}</td>
                    <td className="max-w-[200px] break-all px-3 py-4 align-top">{show(company.loginEmail)}</td>
                    <td className="px-3 py-4 align-top">{show(company.responsibleName)}</td>
                    <td className="px-3 py-4 align-top">{show(company.status)}</td>
                    <td className="px-3 py-4 align-top">{dateDisplay(company.createdAt)}</td>
                    <td className="px-3 py-4 align-top"><button type="button" onClick={() => setSelectedKey((current) => current === keyFor(company, index) ? null : keyFor(company, index))} aria-label={'Ver detalhes de ' + (company.tradeName || company.legalName || company.workspaceId)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-blue-300/15 px-3 text-[11px] font-semibold text-blue-100 hover:bg-blue-400/10">Detalhes <ChevronRight className="h-3 w-3" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selected && !loading && !error && <Detail company={selected} onClose={() => setSelectedKey(null)} />}
      </div>
    </section>
  );
}
