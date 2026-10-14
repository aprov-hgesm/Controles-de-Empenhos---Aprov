'use client';

import { useState } from 'react';
import { SagImportProgress } from '@/features/relatorios/components/SagImportProgress';
import { SagSupplierStep } from '@/features/relatorios/components/SagSupplierStep';
import type { SupplierReport } from '@/lib/supplierReporting';

// Purely invented fixture data. Never connected to workspace, Firebase or SAG.
// Only the existing motion/selection UI is being reviewed.
const DEMO_SUPPLIERS: SupplierReport[] = [
  {
    cnpj: '11111111111111',
    cnpjValid: false,
    supplierName: 'Fornecedor de demonstração A',
    aliases: [],
    empenhos: [],
    pregoes: [],
    totalCommitted: 0,
    totalReceived: 0,
    balance: 0,
    invoiceCount: 0,
    invoicesWithNs: 0,
    invoicesWithoutNs: 0,
    nsCoverage: 0,
  },
  {
    cnpj: '22222222222222',
    cnpjValid: false,
    supplierName: 'Fornecedor de demonstração B',
    aliases: [],
    empenhos: [],
    pregoes: [],
    totalCommitted: 0,
    totalReceived: 0,
    balance: 0,
    invoiceCount: 0,
    invoicesWithNs: 0,
    invoicesWithoutNs: 0,
    nsCoverage: 0,
  },
];

const STEP_LABELS = ['Fornecedor', 'SAG + prompt', 'Validar JSON', 'Revisar e gravar'] as const;

export function EmprovexMotionReviewPreview() {
  const [step, setStep] = useState(1);
  const [complete, setComplete] = useState(false);
  const [selectedCnpj, setSelectedCnpj] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(true);

  const selectedSupplier = DEMO_SUPPLIERS.find((supplier) => supplier.cnpj === selectedCnpj) ?? null;
  const query = supplierSearch.trim().toLocaleLowerCase('pt-BR');
  const filteredSuppliers = DEMO_SUPPLIERS.filter((supplier) =>
    supplier.supplierName.toLocaleLowerCase('pt-BR').includes(query) || supplier.cnpj.includes(query)
  );

  return (
    <section aria-label="Worker 3 — laboratório interativo de motion" className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-900">Worker 3 · Motion em Relatórios e SAG</h2>
        <p className="text-sm text-slate-600">
          Experimente as transições reais de progresso e seleção. Apenas estados visuais locais e
          fornecedores inteiramente fictícios; nenhum dado, login, importação ou gravação é realizado.
          A entrada dos painéis das abas pode ser conferida na tela real de Relatórios.
        </p>
      </header>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Progresso SAG · simulação visual
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Selecionar etapa visual da amostra SAG">
          {STEP_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              aria-pressed={!complete && step === i + 1}
              onClick={() => { setStep(i + 1); setComplete(false); }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00288e] motion-reduce:transition-none"
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={complete}
            onClick={() => setComplete((value) => !value)}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            {complete ? 'Reabrir amostra' : 'Mostrar conclusão visual'}
          </button>
        </div>
        <SagImportProgress activeFlowStep={step} complete={complete} />
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Seletor de fornecedor · dados fictícios
        </p>
        <SagSupplierStep
          supplierReports={DEMO_SUPPLIERS}
          filteredSuppliers={filteredSuppliers}
          selectedSupplier={selectedSupplier}
          selectedCnpj={selectedCnpj}
          supplierSearch={supplierSearch}
          supplierPickerOpen={supplierPickerOpen}
          onSupplierSearchChange={setSupplierSearch}
          onTogglePicker={() => setSupplierPickerOpen((opened) => !opened)}
          onSelectSupplier={(cnpj) => { setSelectedCnpj(cnpj); setSupplierPickerOpen(false); }}
        />
        <p className="text-xs text-slate-500">
          Esta amostra não valida CNPJ, não dispara solicitação e não representa fornecedores reais.
          O botão de seleção altera somente o estado desta demonstração.
        </p>
      </div>
    </section>
  );
}
