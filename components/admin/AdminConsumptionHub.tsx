'use client';

import { useState } from 'react';
import {
  Activity,
  BarChart3,
  BellRing,
  Database,
} from 'lucide-react';

import { AdminConsolidatedUsagePanel } from './AdminConsolidatedUsagePanel';
import { AdminGlobalUsagePanel } from './AdminGlobalUsagePanel';
import { AdminUsagePanel } from './AdminUsagePanel';
import type { Workspace } from '../../lib/platformIdentity';
import type { AdminWorkspaceSession } from '../../lib/platformAdminSessions';
import type { AdminWorkspaceUsageEstimate } from '../../lib/platformAdminUsage';
import type { FirebaseGlobalUsageSnapshot } from '../../lib/platformCapacity';

type ConsumptionTab = 'consolidated' | 'global' | 'workspace' | 'alerts';

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
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'consolidated', label: 'Visão consolidada', icon: BarChart3 },
  { id: 'global', label: 'Firebase global', icon: Database },
  { id: 'workspace', label: 'Consumo por UG', icon: Activity },
  { id: 'alerts', label: 'Alertas e limites', icon: BellRing },
];

export function AdminConsumptionHub(props: AdminConsumptionHubProps) {
  const [activeTab, setActiveTab] = useState<ConsumptionTab>('consolidated');

  return (
    <div data-testid="admin-consumption-hub" className="space-y-5">
      <section className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#071225]/55 shadow-[0_22px_70px_rgba(0,8,28,0.16)] backdrop-blur-xl">
        <div className="border-b border-white/[0.07] px-5 py-5 sm:px-6">
          <p className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-blue-300/60">
            Capacidade e telemetria
          </p>
          <h3 className="mt-1 text-lg font-extrabold text-white">
            Consumo &amp; Cotas
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
            Separe a leitura consolidada, o consumo real do Firebase e a
            atribuição estimada por UG sem misturar fontes de telemetria.
          </p>
        </div>

        <div className="overflow-x-auto p-3 sm:p-4">
          <div className="flex min-w-max gap-2">
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
                    'inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 text-xs font-extrabold transition '
                    + (selected
                      ? 'border-blue-300/25 bg-blue-500/15 text-blue-100 shadow-[0_0_22px_rgba(37,99,235,0.12)]'
                      : 'border-white/[0.07] bg-white/[0.025] text-slate-400 hover:bg-white/[0.05] hover:text-white')
                  }
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

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

      {activeTab === 'global' && (
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
        <section className="rounded-[2rem] border border-white/[0.08] bg-[#071225]/60 p-5 shadow-[0_22px_70px_rgba(0,8,28,0.16)] backdrop-blur-xl sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-amber-300/15 bg-amber-400/[0.07] text-amber-200">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-white">
                Alertas e limites de consumo
              </h4>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">
                A política de alertas permanece centralizada no painel
                consolidado existente. Use esta aba como ponto de acesso para
                revisar referências configuradas e níveis de atenção sem
                duplicar a lógica do Bloco 16.6.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-blue-300/12 bg-blue-400/[0.04] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-200/70">
              Política vigente
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              Os alertas são calculados a partir das mesmas métricas globais e
              estimativas por UG já usadas pela visão consolidada. Para editar
              ou revisar os limites vigentes, abra a subaba
              <strong className="text-white"> Visão consolidada</strong>.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('consolidated')}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-300/15 bg-blue-500/10 px-3.5 text-xs font-extrabold text-blue-100 transition hover:bg-blue-500/15"
            >
              <BarChart3 className="h-4 w-4" />
              Abrir visão consolidada
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
