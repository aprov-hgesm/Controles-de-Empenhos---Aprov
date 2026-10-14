'use client';

import { useState } from 'react';
import beamStyles from '../layout/OperationalNavigationBeam.module.css';

const DESTINATIONS = [
  'Início',
  'Painel',
  'Empenhos',
  'Fornecedores',
  'Consulta de Itens',
  'Notas Fiscais',
  'Central de Avisos',
  'Relatórios',
  'Cronogramas',
  'Central de Depósitos',
] as const;

/**
 * VISUAL-R1 W4: safe development-only illustration of the shared navigation
 * perimeter effect. No routing, authentication or workspace data.
 */
export function EmprovexNavigationBeamPreview() {
  const [active, setActive] = useState<(typeof DESTINATIONS)[number]>('Início');

  return (
    <section
      aria-label="Worker 4 — Border Beam nas demais abas"
      data-testid="w4-navigation-beam-preview"
      className="space-y-3"
    >
      <h2 className="text-xl font-semibold">Worker 4 · Expansão para todas as abas</h2>
      <p className="text-sm text-slate-600">
        Selecione uma aba para visualizar o efeito na navegação compartilhada.
        Somente a aba ativa recebe um contorno luminoso em movimento de 24 segundos
        no desktop; o restante recebe realce ao foco de teclado. No celular ou com
        movimento reduzido, o contorno permanece estático. Isto é apenas um exemplo visual.
      </p>
      <div className="rounded-2xl border border-slate-700 bg-[#081425] p-4">
        <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
          EMPROVEX · navegação demonstrativa
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="group" aria-label="Selecionar aba da demonstração">
          {DESTINATIONS.map((destination) => (
            <button
              key={destination}
              type="button"
              data-active={active === destination ? 'true' : 'false'}
              data-testid="w4-navigation-demo-tab"
              aria-pressed={active === destination}
              onClick={() => setActive(destination)}
              className={`relative min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-200 motion-reduce:transition-none ${beamStyles.mobileItem} ${
                active === destination
                  ? 'border-blue-200/20 bg-blue-400/10 text-white'
                  : 'border-white/5 bg-white/[0.025] text-slate-300 hover:bg-white/[0.06]'
              }`}
            >
              <span className={beamStyles.beam} data-emprovex-nav-beam="true" aria-hidden="true" />
              <span className="relative z-[1]">{destination}</span>
            </button>
          ))}
        </div>
        <p role="status" className="mt-4 text-xs text-slate-400">
          Aba selecionada: <strong className="text-white">{active}</strong>.
          Nenhuma navegação nem operação foi executada.
        </p>
      </div>
    </section>
  );
}
