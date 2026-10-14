'use client';

import { useState } from 'react';
import { EmprovexBorderBeam } from './EmprovexBorderBeam';
import { EmprovexLoaderShowcase } from './EmprovexLoaderShowcase';
import { EmprovexOrbLoader } from './EmprovexOrbLoader';
import { EmprovexOrbVisual } from './EmprovexOrbVisual';
import { EmprovexThinkingOrbRenderer } from './EmprovexThinkingOrbRenderer';
import { EmprovexThinkingOrb } from '@/features/visual-orbs/components/EmprovexThinkingOrb';
import { OperationalSurfaceLoading } from '@/components/layout/OperationalSurfaceLoading';
import type { OrbLoaderPerformance } from './orbLoaderContract';

type DemoState = 'loading' | 'ready' | 'error';

/** Development-only samples; no operational requests or false application state. */
export function EmprovexVisualIntegrationPreview() {
  const [performance, setPerformance] = useState<OrbLoaderPerformance>('balanced');
  const [demoState, setDemoState] = useState<DemoState>('loading');
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 bg-slate-50 px-4 py-8 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest">EMPROVEX / VISUAL-R1 / Worker 5</p>
        <h1 className="text-3xl font-bold">Laboratório de integração visual</h1>
        <p className="text-sm text-slate-600">
          Prévia isolada em desenvolvimento ou Vercel Preview, sem autenticação, dados ou consultas operacionais.
          Apenas o núcleo central do Início será colorido. Os carregamentos e usos secundários ficam monocromáticos, com tinta clara ou escura conforme a superfície. Nenhuma mudança foi montada na Home operacional.
        </p>
      </header>

      <section className="space-y-4" aria-label="Comparação do núcleo colorido Classic e R2">
        <h2 className="text-xl font-semibold">Início · comparação Classic × Orb R2</h2>
        <p className="text-sm text-slate-600">
          O núcleo real da Home agora utiliza o R2; ambas as variantes abaixo são exclusivamente demonstrativas.
          A paleta branca, amarela e vermelha continua reservada ao Início. Observe a casca e a cintilação.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {(['classic', 'r2'] as const).map((refinement) => (
            <div key={refinement}
              className="flex min-h-80 flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-slate-700 bg-[#080f1f] p-6">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-200">
                {refinement === 'classic' ? 'Referência anterior · Classic' : 'Nova versão · EMPROVEX Orb R2'}
              </span>
              <div className="relative flex min-h-56 items-center justify-center">
                <span className="pointer-events-none absolute h-[5px] w-[5px] rounded-full bg-[#fffaf0]"
                  style={{ boxShadow: '0 0 9px rgba(255,252,240,.7), 0 0 17px rgba(255,210,90,.2)' }} />
                <span className="pointer-events-none flex items-center justify-center"
                  style={{ transform: 'scale(1.8)', transformOrigin: 'center' }}>
                  <EmprovexThinkingOrb size="hero" animation="working"
                    performance={performance} roundness={0.72} sparkle={0.76}
                    refinement={refinement} palette="colored" surface="dark" />
                </span>
              </div>
              <p className="text-center text-xs text-slate-300">
                {refinement === 'classic'
                  ? 'Casca mais homogênea e brilho original.'
                  : 'Casca branca com profundidade por transparência e partículas menores, sem pontos prateados.'}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-label="Implementação W2 nos carregamentos reais">
        <h2 className="text-xl font-semibold">Worker 2 · Carregamentos operacionais e autenticação</h2>
        <p className="text-sm text-slate-600">
          Amostras visuais de desenvolvimento, sem consulta, autenticação ou espera artificial.
          A superfície operacional abaixo usa o mesmo componente exibido durante os carregamentos reais.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <OperationalSurfaceLoading />
          </div>
          <div className="flex min-h-[320px] min-w-0 flex-col items-center justify-center gap-4 rounded-2xl border border-slate-700 bg-[#071225] p-8 text-center text-white">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-200/70">
              Amostra visual do indicador de autenticação
            </span>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-300/[0.11] bg-blue-400/[0.055]">
              <EmprovexOrbVisual size="small" performance="balanced" surface="dark"
                renderer={EmprovexThinkingOrbRenderer} />
            </div>
            <p className="text-xs text-slate-300">
              LoginStatusRail e verificação real de identidade permanecem na tela de autenticação.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4" aria-label="Contraste monocromático em superfícies claras e escuras">
        <h2 className="text-xl font-semibold">Carregamentos monocromáticos · Claro e escuro</h2>
        <p className="text-sm text-slate-600">O indicador é sempre monocromático: pontos escuros diretamente no fundo claro e pontos claros diretamente no fundo escuro, sem base grafite artificial.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-6">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">Cartão claro · tinta monocromática escura</span>
            <EmprovexOrbVisual size="large" performance={performance} surface="light" renderer={EmprovexThinkingOrbRenderer} />
          </div>
          <div className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-100">Painel escuro · tinta monocromática clara</span>
            <EmprovexOrbVisual size="large" performance={performance} surface="dark" renderer={EmprovexThinkingOrbRenderer} />
          </div>
        </div>
      </section>

      <section className="space-y-4" aria-label="Cinco tamanhos de Thinking Orbs integrados">
        <h2 className="text-xl font-semibold">Thinking Orbs monocromáticos + cinco tamanhos W2</h2>
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
            <EmprovexOrbVisual size="medium" performance={performance} surface="light" renderer={EmprovexThinkingOrbRenderer} />
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
                renderer={EmprovexThinkingOrbRenderer} size="small" performance={performance} surface="light" />
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
