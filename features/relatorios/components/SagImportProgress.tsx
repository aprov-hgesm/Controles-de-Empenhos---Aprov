'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface SagImportProgressProps {
  activeFlowStep: number;
  complete: boolean;
}

const STEPS = [
  ['Fornecedor', 'Definir o CNPJ'],
  ['SAG + prompt', 'Obter e estruturar'],
  ['Validar JSON', 'Conferir o lote'],
  ['Revisar e gravar', 'Confirmar alterações'],
] as const;

export function SagImportProgress({ activeFlowStep, complete }: SagImportProgressProps) {
  return (
    <nav
      className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm"
      aria-label="Progresso da importação SAG"
    >
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {STEPS.map(([title, text], index) => {
          const step = index + 1;
          const stepComplete = complete || step < activeFlowStep;
          const active = !complete && step === activeFlowStep;

          return (
            <div
              key={title}
              aria-current={active ? 'step' : undefined}
              className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition ${
                active
                  ? 'border-blue-200 bg-blue-50/80'
                  : stepComplete
                    ? 'border-emerald-100 bg-emerald-50/50'
                    : 'border-transparent bg-gray-50/70'
              }`}
            >
              <span
                className={`grid h-8 w-8 flex-none place-items-center rounded-lg text-[10px] font-black ${
                  stepComplete
                    ? 'bg-emerald-600 text-white'
                    : active
                      ? 'bg-[#00288e] text-white'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {stepComplete ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : step}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-[11px] font-extrabold ${
                    active ? 'text-[#00288e]' : stepComplete ? 'text-emerald-800' : 'text-gray-500'
                  }`}
                >
                  {title}
                </span>
                <span className="mt-0.5 block text-[9px] font-semibold text-gray-400">{text}</span>
              </span>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
