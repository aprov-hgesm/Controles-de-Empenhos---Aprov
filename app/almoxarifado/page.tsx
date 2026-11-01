'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { EmprovexAuthLoading } from '../../components/auth/EmprovexAuthLoading';
import { WarehouseAccessBoundary } from '../../features/warehouse/components/WarehouseProtectedSurface';
import { useVisualMode } from '../../components/visual-mode/VisualModeProvider';
import type { SectorWorkspaceContext } from '../../lib/workspaceContext';

type PortalSection =
  | 'inicio' | 'empenhos' | 'notas-fiscais' | 'cronogramas'
  | 'fornecedores' | 'consulta-itens' | 'depositos' | 'relatorios' | 'siscofis';

const SECTIONS: { id: PortalSection; label: string; available: boolean; summary: string }[] = [
  { id: 'inicio', label: 'Início', available: true, summary: 'Visão institucional do Almoxarifado.' },
  { id: 'empenhos', label: 'Empenhos', available: false, summary: 'Núcleo compartilhado existente; adaptação setorial pendente.' },
  { id: 'notas-fiscais', label: 'Notas Fiscais', available: false, summary: 'Integração operacional e revisão de fluxos alimentares pendentes.' },
  { id: 'cronogramas', label: 'Cronogramas', available: false, summary: 'Adaptação dos fluxos e rótulos do Almoxarifado pendente.' },
  { id: 'fornecedores', label: 'Fornecedores', available: false, summary: 'Consulta/cadastro serão disponibilizados após validação setorial.' },
  { id: 'consulta-itens', label: 'Consulta de Itens', available: false, summary: 'Integração de catálogo e regras de unidade pendente.' },
  { id: 'depositos', label: 'Central de Depósitos', available: true, summary: 'Estrutura física, materiais, saldos e localização por workspace.' },
  { id: 'relatorios', label: 'Relatórios', available: false, summary: 'Modelos de relatórios precisam excluir conteúdo alimentar específico.' },
  { id: 'siscofis', label: 'Pedidos SISCOFIS', available: false, summary: 'Reservado para os Workers W2, W3, W4 e integração W5.' },
];

function AlmoxPortal({ context }: { context: SectorWorkspaceContext }) {
  const [selected, setSelected] = useState<PortalSection>('inicio');
  const { mode, setMode, hydrated } = useVisualMode();
  useEffect(() => {
    if (context.sectorType !== 'almoxarifado') window.location.replace('/central-empenhos');
  }, [context.sectorType]);

  if (context.sectorType !== 'almoxarifado') {
    return <EmprovexAuthLoading hasAuthenticatedIdentity />;
  }

  const active = SECTIONS.find((section) => section.id === selected) || SECTIONS[0];
  return (
    <main data-testid="almoxarifado-portal" className="min-h-screen bg-[#020817] text-slate-100">
      <header className="border-b border-slate-700/60 bg-[#081329] px-5 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-300">EMPROVEX · ALMOXARIFADO</div>
            <h1 className="mt-1 text-xl font-extrabold">{context.workspaceName}</h1>
            <p className="text-xs text-slate-400">{context.institutionalProfile.organizationName} · UG {context.ug || 'não informada'}</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400" htmlFor="almox-visual-mode">Visual</label>
            <select
              id="almox-visual-mode"
              value={mode}
              disabled={!hydrated}
              onChange={(event) => setMode(event.target.value === 'essencial' ? 'essencial' : 'premium')}
              className="rounded-lg border border-slate-600 bg-[#0d1a35] p-2 text-xs"
            >
              <option value="premium">Normal</option><option value="essencial">Essencial</option>
            </select>
            <button
              type="button"
              className="rounded-lg border border-slate-600 px-3 py-2 text-xs hover:bg-slate-800"
              onClick={() => void signOut(auth).then(() => window.location.replace('/login'))}
            >Sair</button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-5 px-5 py-7 md:grid-cols-[225px_minmax(0,1fr)]">
        <nav aria-label="Navegação Almoxarifado" className="flex flex-col gap-1">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => {
                setSelected(section.id);
                if (section.id === 'depositos') window.location.assign('/central-depositos');
              }}
              aria-current={selected === section.id ? 'page' : undefined}
              className={`rounded-xl px-3 py-2.5 text-left text-sm transition ${selected === section.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              {section.label}
              {!section.available && <span className="ml-2 text-[10px] text-slate-400">(em preparação)</span>}
            </button>
          ))}
        </nav>
        <section className="min-h-72 rounded-2xl border border-slate-700/60 bg-[#09172e] p-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">{active.available ? 'Ambiente setorial' : 'Preparação funcional'}</p>
          <h2 className="mt-2 text-2xl font-bold">{active.label}</h2>
          <p className="mt-3 max-w-xl leading-relaxed text-slate-300">{active.summary}</p>
          {selected === 'inicio' && (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-slate-400">Seu acesso está vinculado somente ao workspace <strong>{context.workspaceId}</strong>. Dados de outras modalidades não são compartilhados pela UG.</p>
              <a href="/central-depositos" className="inline-block rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-500">Abrir Central de Depósitos</a>
            </div>
          )}
          {!active.available && <p className="mt-5 rounded-lg border border-amber-300/20 bg-amber-100/5 p-3 text-sm text-amber-100">Ainda não habilitado para operação no Almoxarifado. Nenhum dado será alterado nesta tela.</p>}
          {selected === 'depositos' && <a href="/central-depositos" className="mt-5 inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold">Acessar depósitos</a>}
        </section>
      </div>
    </main>
  );
}

export default function AlmoxarifadoPage() {
  return (
    <WarehouseAccessBoundary>
      {(context) => <AlmoxPortal context={context} />}
    </WarehouseAccessBoundary>
  );
}
