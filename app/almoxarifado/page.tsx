'use client';

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { normalizePlatformEmail } from '../../lib/platformIdentity';
import { EmprovexAuthLoading } from '../../components/auth/EmprovexAuthLoading';
import { WarehouseAccessBoundary } from '../../features/warehouse/components/WarehouseProtectedSurface';
import { useVisualMode } from '../../components/visual-mode/VisualModeProvider';
import { useOperationalData } from '../../hooks/useOperationalData';
import { useOperationalViewState } from '../../hooks/useOperationalViewState';
import type { OperationalActiveTab } from '../../lib/operationalSubscriptionPlan';
import type { SectorWorkspaceContext } from '../../lib/workspaceContext';
import { OperationalWorkspace } from '../../features/operational/components/OperationalWorkspace';
import { AlmoxCatalogoView } from '../../features/almoxarifado/catalogo/AlmoxCatalogoView';
import { AlmoxarifadoReportsView } from '../../features/almoxarifado/relatorios/AlmoxarifadoReportsView';
import { AlmoxSiscofisWorkbench } from '../../features/almoxarifado/components/AlmoxSiscofisWorkbench';

type PortalSection =
  | 'inicio' | 'empenhos' | 'notas-fiscais' | 'cronogramas'
  | 'fornecedores' | 'consulta-itens' | 'materiais'
  | 'depositos' | 'relatorios' | 'siscofis';

const SECTIONS: { id: PortalSection; label: string; summary: string }[] = [
  { id: 'inicio', label: 'Início', summary: 'Visão institucional e navegação do Almoxarifado.' },
  { id: 'empenhos', label: 'Empenhos', summary: 'Cadastro, classificação FUNADOM, itens, documentos e saldos financeiros.' },
  { id: 'notas-fiscais', label: 'Notas Fiscais', summary: 'Notas fiscais, recebimentos parciais, anexos e acompanhamento.' },
  { id: 'cronogramas', label: 'Cronogramas', summary: 'Programação de entregas e remessas por empenho.' },
  { id: 'fornecedores', label: 'Fornecedores', summary: 'Fornecedores, contatos, itens fornecidos e empenhos associados.' },
  { id: 'consulta-itens', label: 'Consulta de Itens', summary: 'Itens financeiros, saldo do empenho e vínculos logísticos explícitos.' },
  { id: 'materiais', label: 'Materiais', summary: 'Materiais físicos, posições e quantidades localizadas na Central de Depósitos.' },
  { id: 'depositos', label: 'Central de Depósitos', summary: 'Gestão física do estoque no workspace autorizado.' },
  { id: 'relatorios', label: 'Relatórios', summary: 'Relatórios determinísticos e consultas logísticas sob demanda.' },
  { id: 'siscofis', label: 'Pedidos SISCOFIS (experimental)', summary: 'Simulação sintética, sem leitura homologada de pedidos reais e sem baixa.' },
];

function operationalTabFor(section: PortalSection): OperationalActiveTab {
  switch (section) {
    case 'empenhos': return 'empenhos';
    case 'notas-fiscais': return 'nova_nf';
    case 'cronogramas': return 'cronogramas';
    case 'relatorios': return 'empenhos'; // Fornece NE + NF sem nova leitura global.
    case 'fornecedores':
    case 'consulta-itens':
    case 'materiais': return 'fornecedores'; // W7 possui loader isolado.
    default: return 'inicio';
  }
}

function AlmoxPortal({ context }: { context: SectorWorkspaceContext }) {
  const [selected, setSelected] = useState<PortalSection>('inicio');
  const [operationalTab, setOperationalTab] = useState<OperationalActiveTab>('inicio');
  const [editingNSId, setEditingNSId] = useState<string | null>(null);
  const [tempNSValue, setTempNSValue] = useState('');
  const [toast, setToast] = useState('');
  const { mode, setMode, hydrated } = useVisualMode();
  const firebaseUser = auth.currentUser;

  // O gate pai já verificou identidade, legal, cobrança, Warehouse e workspace.
  // Estes identificadores habilitam o hook existente somente para a MESMA sessão.
  const identity = firebaseUser && context.sectorType === 'almoxarifado'
    ? [firebaseUser.uid, normalizePlatformEmail(firebaseUser.email || context.email),
      context.workspaceId, context.ug || ''].join('|')
    : null;
  const billingIdentity = firebaseUser && identity
    ? firebaseUser.uid + ':' + context.workspaceId + ':' + (context.ug || '')
    : null;

  const operationalData = useOperationalData(
    operationalTab, identity, Boolean(identity), billingIdentity,
  );
  const viewState = useOperationalViewState();

  const sameWorkspace = Boolean(
    firebaseUser && operationalData.user
    && firebaseUser.uid === operationalData.user.uid
    && context.sectorType === 'almoxarifado'
    && operationalData.workspaceContext.status === 'sector'
    && operationalData.workspaceContext.sectorType === 'almoxarifado'
    && operationalData.workspaceContext.workspaceId === context.workspaceId
    && operationalData.workspaceContext.ug === context.ug
  );

  // Nunca iniciar cadastro financeiro do Almoxarifado com a rubrica alimentar QR.
  useEffect(() => {
    if (context.sectorType !== 'almoxarifado') return;
    viewState.setNewEmpenhoForm(previous => previous.classification === 'QR'
      ? { ...previous, classification: 'FUNADOM' } : previous);
    viewState.setCronogramaLocalEntrega(
      'Almoxarifado - ' + context.institutionalProfile.organizationName,
    );
    viewState.setCronogramaObservacoes(
      '1. Entregas acompanhadas das respectivas Notas Fiscais.\n' +
      '2. Conferir materiais, quantidades e especificações do empenho.\n' +
      '3. Comunicar previamente alterações de prazo ao Almoxarifado.',
    );
    viewState.setCronogramaResponsavelCargo('Encarregado do Almoxarifado');
  }, [context.sectorType, context.institutionalProfile.organizationName,
      viewState.setNewEmpenhoForm, viewState.setCronogramaLocalEntrega,
      viewState.setCronogramaObservacoes, viewState.setCronogramaResponsavelCargo]);

  useEffect(() => {
    if (context.sectorType !== 'almoxarifado') window.location.replace('/login');
  }, [context.sectorType]);

  const changeOperationalTab: Dispatch<SetStateAction<OperationalActiveTab>> = useCallback(update => {
    const next = typeof update === 'function' ? update(operationalTab) : update;
    setOperationalTab(next);
    if (next === 'empenhos' || next === 'itens_empenho') setSelected('empenhos');
    if (next === 'nova_nf') setSelected('notas-fiscais');
    if (next === 'cronogramas') setSelected('cronogramas');
  }, [operationalTab]);
  const showToast = useCallback((message: string, type?: 'success' | 'error' | 'info') => {
    setToast((type === 'error' ? 'Erro: ' : '') + message);
  }, []);
  const reportFinancial = useMemo(() => {
    if (!sameWorkspace) return { status: 'unavailable' as const };
    if (!operationalData.activeOperationalDataReady) return { status: 'loading' as const };
    return {
      status: 'ready' as const,
      snapshot: {
        workspaceId: context.workspaceId,
        empenhos: operationalData.empenhos,
        invoices: operationalData.invoices,
        completeness: 'partial' as const, // Realtime ativo não comprova histórico integral.
      },
    };
  }, [sameWorkspace, operationalData.activeOperationalDataReady,
      operationalData.empenhos, operationalData.invoices, context.workspaceId]);

  if (context.sectorType !== 'almoxarifado') return <EmprovexAuthLoading hasAuthenticatedIdentity />;
  const active = SECTIONS.find(section => section.id === selected) || SECTIONS[0];
  const financial = selected === 'empenhos' || selected === 'notas-fiscais' || selected === 'cronogramas';

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
            <select id="almox-visual-mode" value={mode} disabled={!hydrated}
              onChange={event => setMode(event.target.value === 'essencial' ? 'essencial' : 'premium')}
              className="rounded-lg border border-slate-600 bg-[#0d1a35] p-2 text-xs">
              <option value="premium">Normal</option><option value="essencial">Essencial</option>
            </select>
            <button type="button" className="rounded-lg border border-slate-600 px-3 py-2 text-xs hover:bg-slate-800"
              onClick={() => void signOut(auth).then(() => window.location.replace('/login'))}>Sair</button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-5 px-5 py-7 md:grid-cols-[225px_minmax(0,1fr)]">
        <nav aria-label="Navegação Almoxarifado" className="flex flex-col gap-1">
          {SECTIONS.map(section => (
            <button key={section.id} type="button" aria-current={selected === section.id ? 'page' : undefined}
              onClick={() => {
                if (section.id === 'depositos') {
                  window.location.assign('/central-depositos');
                  return;
                }
                setSelected(section.id);
                setOperationalTab(operationalTabFor(section.id));
              }}
              className={`rounded-xl px-3 py-2.5 text-left text-sm transition ${selected === section.id
                ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
              {section.label}
            </button>
          ))}
        </nav>
        <section className="min-h-72 min-w-0 rounded-2xl border border-slate-700/60 bg-[#09172e] p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Ambiente setorial</p>
          <h2 className="mt-2 text-2xl font-bold">{active.label}</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300">{active.summary}</p>
          {toast && <p role="status" className="mt-3 rounded-lg border border-cyan-700 p-3 text-sm">{toast}</p>}
          {selected === 'inicio' && (
            <div className="mt-6 space-y-4 text-sm text-slate-300">
              <p>Dados separados por workspace autenticado. Empenhos, recebimentos financeiros e saldos físicos são registros distintos.</p>
              <button type="button" onClick={() => {
                setSelected('relatorios'); setOperationalTab('empenhos');
              }} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500">
                Consultar indicadores e relatórios
              </button>
            </div>
          )}
          {financial && (!sameWorkspace || !operationalData.activeOperationalDataReady) && (
            <p role="status" className="mt-6 text-sm text-slate-300">
              {operationalData.loadingAuth ? 'Validando identidade e workspace…' : 'Carregando dados financeiros autorizados…'}
            </p>
          )}
          {financial && sameWorkspace && operationalData.activeOperationalDataReady && (
            <div className="mt-5 rounded-xl bg-white p-3 text-slate-900 sm:p-5">
              <OperationalWorkspace
                sectorType="almoxarifado"
                activeTab={operationalTab} setActiveTab={changeOperationalTab}
                operationalData={operationalData} viewState={viewState}
                editingNSId={editingNSId} setEditingNSId={setEditingNSId}
                tempNSValue={tempNSValue} setTempNSValue={setTempNSValue}
                showToast={showToast} surfaceReady
              />
            </div>
          )}
          {selected === 'fornecedores' && sameWorkspace && context.ug && firebaseUser && (
            <AlmoxCatalogoView user={firebaseUser} workspaceId={context.workspaceId}
              ug={context.ug} section="fornecedores" />
          )}
          {selected === 'consulta-itens' && sameWorkspace && context.ug && firebaseUser && (
            <AlmoxCatalogoView user={firebaseUser} workspaceId={context.workspaceId}
              ug={context.ug} section="consulta-itens" />
          )}
          {selected === 'materiais' && sameWorkspace && context.ug && firebaseUser && (
            <AlmoxCatalogoView user={firebaseUser} workspaceId={context.workspaceId}
              ug={context.ug} section="materiais" />
          )}
          {['fornecedores', 'consulta-itens', 'materiais'].includes(selected) && !sameWorkspace && (
            <p role="status" className="mt-5 text-sm">Validando autorização do catálogo…</p>
          )}
          {selected === 'depositos' && (
            <a href="/central-depositos" className="mt-5 inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold">
              Acessar Central de Depósitos
            </a>
          )}
          {selected === 'relatorios' && (
            <div className="mt-5">
              <AlmoxarifadoReportsView workspaceId={context.workspaceId}
                mode={mode === 'essencial' ? 'essential' : 'normal'}
                financial={reportFinancial} />
            </div>
          )}
          {selected === 'siscofis' && (
            <div className="mt-5">
              <p className="mb-4 rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-100">
                Somente dados sintéticos. Não importar Pedido de Material real, não reservar nem baixar estoque.
              </p>
              <AlmoxSiscofisWorkbench />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function AlmoxarifadoPage() {
  return (
    <WarehouseAccessBoundary>
      {context => <AlmoxPortal context={context} />}
    </WarehouseAccessBoundary>
  );
}
