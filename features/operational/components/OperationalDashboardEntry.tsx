'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { useOperationalData } from '../../../hooks/useOperationalData';
import type { useOperationalViewState } from '../../../hooks/useOperationalViewState';
import type { OperationalActiveTab } from '../../../lib/operationalSubscriptionPlan';
import { useEmpenhoClasses } from '../../../hooks/useEmpenhoClasses';
import { DashboardView } from '../../dashboard/components/DashboardView';
import { OperationalSurfaceTransition } from '../../../components/layout/OperationalSurfaceTransition';

type OperationalData = ReturnType<typeof useOperationalData>;
type OperationalViewState = ReturnType<typeof useOperationalViewState>;

/**
 * R2-C: entrada leve do Painel antes da primeira visita a uma aba com mutações.
 * Não instancia hooks de operações, PDFs, NF, cronogramas ou SAG/NS.
 * O dono dos dados/realtime e todos os drafts seguem na página pai.
 * Após abrir uma área transacional, o OperationalWorkspace completo permanece
 * montado pela página pai, preservando handlers e ações em andamento.
 */
export function OperationalDashboardEntry({
  operationalData,
  viewState,
  setActiveTab,
}: {
  operationalData: OperationalData;
  viewState: OperationalViewState;
  setActiveTab: Dispatch<SetStateAction<OperationalActiveTab>>;
}) {
  const { user, workspaceContext, empenhos, uniquePregaos } = operationalData;
  const { empenhoClasses } = useEmpenhoClasses({
    user,
    workspaceContext,
    empenhos,
    enabled: true,
  });

  return (
    <OperationalSurfaceTransition surfaceKey="painel">
      <DashboardView
        dashboardClassFilter={viewState.dashboardClassFilter}
        dashboardPregaoFilter={viewState.dashboardPregaoFilter}
        dashboardSearch={viewState.dashboardSearch}
        empenhos={empenhos}
        empenhoClasses={empenhoClasses}
        setActiveTab={setActiveTab}
        setDashboardClassFilter={viewState.setDashboardClassFilter}
        setDashboardPregaoFilter={viewState.setDashboardPregaoFilter}
        setDashboardSearch={viewState.setDashboardSearch}
        setEditingEmpenhoId={viewState.setEditingEmpenhoId}
        setNfSubTab={viewState.setNfSubTab}
        setSelectedNFCommitmentId={viewState.setSelectedNFCommitmentId}
        uniquePregaos={uniquePregaos}
      />
    </OperationalSurfaceTransition>
  );
}
