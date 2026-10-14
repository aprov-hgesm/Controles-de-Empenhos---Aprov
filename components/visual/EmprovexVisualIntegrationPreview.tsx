'use client';

import { useState } from 'react';
import { EmprovexBorderBeam } from './EmprovexBorderBeam';
import { EmprovexLoaderShowcase } from './EmprovexLoaderShowcase';
import { EmprovexOrbLoader } from './EmprovexOrbLoader';
import { EmprovexOrbVisual } from './EmprovexOrbVisual';
import { EmprovexThinkingOrbRenderer } from './EmprovexThinkingOrbRenderer';
import type { OrbLoaderPerformance } from './orbLoaderContract';

type DemoState = 'loading' | 'ready' | 'error';

/** Development-only samples; no operational requests or false application state. */
export function EmprovexVisualIntegrationPreview() {
  const [performance, setPerformance] = useState<OrbLoaderPerformance>('balanced');
  const [demoState, setDemoState] = useState<DemoState>('loading');
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest">EMPROVEX / VISUAL-R1 / Worker 5</p>
        <h1 className="text-3xl font-bold">Laboratório de integração visual</h1>
        <p className="text-sm text-slate-600">
          Prévia isolada em desenvolvimento ou Vercel Preview, sem autenticação, dados ou consultas operacionais.
          W1 ainda é monocromático neste commit; a versão colorida depende de novo HEAD certificado.
        </p>
      </header>

      <section className="space-y-4" aria-label="Cinco tamanhos de Thinking Orbs integrados">
        <h2 className="text-xl font-semibold">Thinking Orbs + cinco presets W2</h2>
        <EmprovexLoaderShowcase renderer={EmprovexThinkingOrbRenderer} />
      </section>

      <section className="grid gap-6 md:grid-cols-2" aria-label="Perfis e estados demonstrativos">
        <div className="space-y-4 rounded-2xl border border-slate-200 p-5">
          <label htmlFor="visual-r1-performance" className="block text-sm font-semibold">
            Perfil de desempenho
          </label>
          <select id="visual-r1-performance" value={performance}
            onChange={(event) => setPerformance(event.target.value as OrbLoaderPerformance)}
            className="w-full rounded-lg border border-slate-300 bg-white p-2">
            <option value="full">Completo</option>
            <option value="balanced">Equilibrado</option>
            <option value="static">Estático</option>
          </select>
          <div className="flex min-h-32 items-center justify-center">
            <EmprovexOrbVisual size="medium" performance={performance} renderer={EmprovexThinkingOrbRenderer} />
          </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold">Estados ilustrativos (não são operações reais)</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Estado de exemplo">
            {(['loading', 'ready', 'error'] as const).map((state) => (
              <button key={state} type="button" aria-pressed={demoState === state}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={() => setDemoState(state)}>{state}</button>
            ))}
          </div>
          <div className="flex min-h-32 items-center justify-center">
            {demoState === 'loading' ? (
              <EmprovexOrbLoader loading label="Amostra de indicador"
                description="Nenhuma operação em andamento."
                renderer={EmprovexThinkingOrbRenderer} size="small" performance={performance} />
            ) : demoState === 'ready' ? (
              <p role="status">Amostra de conteúdo pronto.</p>
            ) : (
              <p role="alert">Amostra de mensagem de erro preservada.</p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-label="Border Beam sujeito a aprovação">
        <h2 className="text-xl font-semibold">Border Beam — comparação isolada</h2>
        <p className="text-sm text-slate-600">Intensidade baixa, duração 24 segundos, sem aceite para produção.</p>
        <EmprovexBorderBeam intensity="low" duration={24} theme="light">
          <div className="rounded-2xl bg-white p-6 text-sm">Cartão demonstrativo, sem ações ou dados reais.</div>
        </EmprovexBorderBeam>
        <p className="text-xs">
          As transições W3 estão montadas nas telas de Relatórios/SAG da branch DRAFT,
          sem aprovação para merge.
        </p>
      </section>
    </main>
  );
}
