export const WORKSPACE_TERM_COUNTER_SETTINGS_ID = 'termoRecebimentoCounter';

export interface WorkspaceTermCounterSettings {
  currentNumber: number;
}

/**
 * Estado inicial obrigatório de um workspace novo.
 *
 * O primeiro Termo de Recebimento será alocado a partir de 1 pelo runtime
 * operacional. Nenhum outro setting é materializado nesta etapa: em especial,
 * documentStorage só passa a existir após o onboarding real do Google Drive.
 */
export function createInitialWorkspaceTermCounter(): WorkspaceTermCounterSettings {
  return {
    currentNumber: 0,
  };
}
