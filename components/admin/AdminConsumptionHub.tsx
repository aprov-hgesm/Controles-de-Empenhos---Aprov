'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  BellRing,
  Cloud,
  Database,
  Gauge,
} from 'lucide-react';

import { AdminConsolidatedUsagePanel } from './AdminConsolidatedUsagePanel';
import { AdminGlobalUsagePanel } from './AdminGlobalUsagePanel';
import { AdminUsagePanel } from './AdminUsagePanel';
import { AdminUsageReportsPanel } from './AdminUsageReportsPanel';
import type { Workspace } from '../../lib/platformIdentity';
import type { AdminWorkspaceSession } from '../../lib/platformAdminSessions';
import type { AdminWorkspaceUsageEstimate } from '../../lib/platformAdminUsage';
import type { FirebaseGlobalUsageSnapshot } from '../../lib/platformCapacity';

type ConsumptionTab = 'quota' | 'reports' | 'consolidated' | 'workspace' | 'alerts';

interface AdminConsumptionHubProps {
  workspaces: Workspace[];
  sessions: AdminWorkspaceSession[];
  usage: AdminWorkspaceUsageEstimate[];
  globalUsage: FirebaseGlobalUsageSnapshot | null;
  globalUsageConfigured: boolean | null;
  globalUsageObservedAt: string | null;
  globalUsageDataThrough: string | null;
  loadingUsage: boolean;
  loadingGlobalUsage: boolean;
  usageError: string | null;
  globalUsageError: string | null;
  onRefreshUsage: () => Promise<void>;
  onRefreshGlobalUsage: () => Promise<void>;
}

const tabs: Array<{
  id: ConsumptionTab;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'quota',
    label: 'Google real · Cota diária',
    shortLabel: 'Google real',
    description: 'Métricas oficiais do Cloud Monitoring e diagnóstico de atualização.',
    icon: Cloud,
  },
  {
    id: 'consolidated',
    label: 'Visão consolidada',
    shortLabel: 'Consolidado',
    description: 'Compara fonte global, estimativas por UG, sessões e limites.',
    icon: Gauge,
  },
  {
    id: 'workspace',
    label: 'Consumo por UG',
    shortLabel: 'Por UG',
    description: 'Atribuição interna instrumentada pelo EMPROVEX para cada unidade.',
    icon: Activity,
  },
  {
    id: 'reports',
    label: 'Histórico & Relatórios',
    shortLabel: 'Histórico',
    description: 'Evolução diária, semanal, mensal e anual com exportação.',
    icon: BarChart3,
  },
  {
    id: 'alerts',
    label: 'Alertas e limites',
    shortLabel: 'Alertas',
    description: 'Faixas de atenção e referências usadas pela plataforma.',
    icon: BellRing,
  },
];

export function AdminConsumptionHub(props: AdminConsumptionHubProps) {
  const [activeTab, setActiveTab] = useState<ConsumptionTab>('quota');
  const active = useMemo(
    () => tabs.find((tab) => tab.id === activeTab) || tabs[0],
    [activeTab]
  );
  const ActiveIcon = active.icon;

  return (
    <div data-testid="admin-consumption-hub" className="space-y-4">
      <section className="rounded-[1.75rem] border border-white/[0.08] bg-[#071225]/55 p-5 shadow-[0_22px_70px_rgba(0,8,28,0.16)] backdrop-blur-xl sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-blue-300/60">
              Capacidade e telemetria
            </p>
            <h3 className="mt-1 text-lg font-extrabold text-white">Consumo &amp; Cotas</h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
              A fonte <strong className="text-slate-200">Google real</strong> é global para o banco.
              A visão por UG continua identificada separadamente como estimativa instrumentada.
            </p>
          </div>

          <div className="grid min-w-[220px] grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
            <SourceBadge
              label="Google Cloud"
              value={
                props.globalUsageConfigured === true
                  ? 'Conectado'
                  : props.globalUsageConfigured === false
                    ? 'Configurar'
                    : 'Verificando'
              }
              active={props.globalUsageConfigured === true}
            />
            <SourceBadge
              label="UG instrumentada"
              value={props.usage.some((item) => item.hasTelemetry) ? 'Com dados' : 'Sem amostra'}
              active={props.usage.some((item) => item.hasTelemetry)}
            />
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[224px_minmax(0,1fr)]">
        <aside
          data-testid="admin-consumption-sidebar"
          className="min-w-0 xl:sticky xl:top-24 xl:self-start"
        >
          <div className="rounded-[1.5rem] border border-white/[0.08] bg-[#051024]/70 p-2.5 backdrop-blur-xl">
            <nav
              aria-label="Visões de consumo"
              className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-1"
            >
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-pressed={selected}
                    className={
                      'group flex min-h-12 min-w-0 items-center gap-3 rounded-xl border px-3 text-left transition '
                      + (selected
                        ? 'border-blue-300/25 bg-blue-500/15 text-blue-50 shadow-[inset_3px_0_0_rgba(96,165,250,0.65)]'
                        : 'border-transparent bg-transparent text-slate-400 hover:border-white/[0.07] hover:bg-white/[0.035] hover:text-white')
                    }
                  >
                    <span className={
                      'grid h-8 w-8 shrink-0 place-items-center rounded-lg border '
                      + (selected
                        ? 'border-blue-300/20 bg-blue-400/[0.09] text-blue-200'
                        : 'border-white/[0.06] bg-white/[0.025] text-slate-500')
                    }>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-extrabold xl:hidden">
                        {tab.shortLabel}
                      </span>
                      <span className="hidden text-[11px] font-extrabold xl:block">
                        {tab.label}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-blue-300/12 bg-blue-400/[0.055] text-blue-200">
              <ActiveIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-white">{active.label}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{active.description}</p>
            </div>
          </div>

          {activeTab === 'quota' && (
            <AdminGlobalUsagePanel
              snapshot={props.globalUsage}
              configured={props.globalUsageConfigured}
              observedAt={props.globalUsageObservedAt}
              dataThrough={props.globalUsageDataThrough}
              loading={props.loadingGlobalUsage}
              error={props.globalUsageError}
              onRefresh={props.onRefreshGlobalUsage}
            />
          )}

          {activeTab === 'reports' && (
            <AdminUsageReportsPanel
              workspaces={props.workspaces}
              usage={props.usage}
              globalUsage={props.globalUsage}
              globalUsageObservedAt={props.globalUsageObservedAt}
              globalUsageError={props.globalUsageError}
              onRefreshUsage={props.onRefreshUsage}
              onRefreshGlobalUsage={props.onRefreshGlobalUsage}
            />
          )}

          {activeTab === 'consolidated' && (
            <AdminConsolidatedUsagePanel
              workspaces={props.workspaces}
              sessions={props.sessions}
              usage={props.usage}
              globalUsage={props.globalUsage}
              globalUsageConfigured={props.globalUsageConfigured}
              globalUsageObservedAt={props.globalUsageObservedAt}
              globalUsageDataThrough={props.globalUsageDataThrough}
              loadingUsage={props.loadingUsage}
              loadingGlobalUsage={props.loadingGlobalUsage}
              usageError={props.usageError}
              globalUsageError={props.globalUsageError}
              onRefreshUsage={props.onRefreshUsage}
              onRefreshGlobalUsage={props.onRefreshGlobalUsage}
            />
          )}

          {activeTab === 'workspace' && (
            <AdminUsagePanel
              workspaces={props.workspaces}
              usage={props.usage}
              loading={props.loadingUsage}
              error={props.usageError}
              onRefresh={props.onRefreshUsage}
            />
          )}

          {activeTab === 'alerts' && (
            <section className="rounded-[1.75rem] border border-white/[0.08] bg-[#071225]/60 p-5 shadow-[0_22px_70px_rgba(0,8,28,0.16)] backdrop-blur-xl sm:p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-amber-300/15 bg-amber-400/[0.07] text-amber-200">
                  <BellRing className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-white">
                    Alertas e limites de consumo
                  </h4>
                  <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
                    A política de alertas usa as métricas globais reais e as estimativas por UG
                    sem misturar as duas fontes. Os limites permanecem editáveis na visão consolidada.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('consolidated')}
                className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-300/15 bg-blue-500/10 px-3.5 text-xs font-extrabold text-blue-100 transition hover:bg-blue-500/15"
              >
                <BarChart3 className="h-4 w-4" />
                Abrir visão consolidada
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceBadge({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-slate-950/20 px-3 py-2.5">
      <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-600">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-300' : 'bg-amber-300'}`} />
        <span className="text-[10px] font-extrabold text-slate-200">{value}</span>
      </div>
    </div>
  );
}
