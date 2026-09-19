'use client';

import React from 'react';
import { Building2, FileSearch, Landmark, ReceiptText } from 'lucide-react';
import { RelatorioPorEmpenhoView, type RelatoriosViewContext } from './RelatorioPorEmpenhoView';
import { RelatorioPorFornecedorView } from './RelatorioPorFornecedorView';
import { SagImportView } from './SagImportView';

type RelatoriosSubTab = 'empenho' | 'fornecedor' | 'sag';

interface RelatoriosViewProps {
  context: RelatoriosViewContext;
}

const tabs: Array<{
  id: RelatoriosSubTab;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'empenho',
    label: 'Por Empenho',
    description: 'NE, NFs, NS e saldos',
    icon: ReceiptText,
  },
  {
    id: 'fornecedor',
    label: 'Por Fornecedor',
    description: 'Consolidação por CNPJ',
    icon: Building2,
  },
  {
    id: 'sag',
    label: 'Importar NS — SAG',
    description: 'Conciliação manual assistida',
    icon: Landmark,
  },
];

export function RelatoriosView({ context }: RelatoriosViewProps) {
  const [activeSubTab, setActiveSubTab] = React.useState<RelatoriosSubTab>('empenho');

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[#00288e]">
          <FileSearch className="h-5 w-5" aria-hidden="true" />
          <span className="font-mono text-[10px] font-extrabold uppercase tracking-[0.18em]">
            Central de Relatórios
          </span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[#00288e]">Relatórios</h2>
        <p className="max-w-3xl text-sm font-medium text-gray-500">
          Consulte a execução por empenho, consolide fornecedores por CNPJ e prepare a conciliação de NS oriundas do SAG.
        </p>
      </header>

      <nav
        className="grid grid-cols-1 gap-2 rounded-2xl border border-blue-100/80 bg-white/75 p-2 shadow-sm sm:grid-cols-3"
        aria-label="Modos de relatório"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              aria-pressed={active}
              className={`group flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                active
                  ? 'border-blue-200 bg-[#00288e] text-white shadow-md'
                  : 'border-transparent bg-white/40 text-gray-600 hover:border-blue-100 hover:bg-blue-50/60'
              }`}
            >
              <span
                className={`grid h-9 w-9 flex-none place-items-center rounded-lg ${
                  active ? 'bg-white/12 text-white' : 'bg-blue-50 text-[#00288e]'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-extrabold">{tab.label}</span>
                <span className={`mt-0.5 block text-[10px] font-semibold ${
                  active ? 'text-blue-100' : 'text-gray-400'
                }`}>
                  {tab.description}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <section aria-live="polite">
        {activeSubTab === 'empenho' && <RelatorioPorEmpenhoView context={context} />}
        {activeSubTab === 'fornecedor' && (
          <RelatorioPorFornecedorView empenhos={context.empenhos} invoices={context.invoices} />
        )}
        {activeSubTab === 'sag' && (
          <SagImportView
            empenhos={context.empenhos}
            invoices={context.invoices}
            onApplySagNsImport={context.handleApplySagNsImport}
          />
        )}
      </section>
    </div>
  );
}
