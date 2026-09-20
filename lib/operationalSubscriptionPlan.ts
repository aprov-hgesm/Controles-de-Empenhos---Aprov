export type OperationalActiveTab =
  | 'inicio'
  | 'painel'
  | 'empenhos'
  | 'itens'
  | 'nova_nf'
  | 'relatorios'
  | 'itens_empenho'
  | 'cronogramas'
  | 'avisos';

export type RealtimeOperationalCollection =
  | 'empenhos'
  | 'alerts'
  | 'invoices'
  | 'comissoes'
  | 'cronogramas';

export interface OperationalSubscriptionPlan {
  empenhos: boolean;
  alerts: boolean;
  invoices: boolean;
  comissoes: boolean;
  cronogramas: boolean;
}

const PLAN_BY_TAB: Record<OperationalActiveTab, OperationalSubscriptionPlan> = {
  inicio: {
    empenhos: false,
    alerts: false,
    invoices: false,
    comissoes: false,
    cronogramas: false,
  },
  painel: {
    empenhos: true,
    alerts: false,
    invoices: false,
    comissoes: false,
    cronogramas: false,
  },
  empenhos: {
    empenhos: true,
    alerts: true,
    invoices: true,
    comissoes: false,
    cronogramas: false,
  },
  itens: {
    empenhos: true,
    alerts: false,
    invoices: false,
    comissoes: false,
    cronogramas: false,
  },
  nova_nf: {
    empenhos: true,
    alerts: true,
    invoices: true,
    comissoes: true,
    cronogramas: false,
  },
  relatorios: {
    empenhos: true,
    alerts: false,
    invoices: false,
    comissoes: true,
    cronogramas: false,
  },
  itens_empenho: {
    empenhos: true,
    alerts: false,
    invoices: false,
    comissoes: false,
    cronogramas: false,
  },
  cronogramas: {
    empenhos: true,
    alerts: false,
    invoices: false,
    comissoes: false,
    cronogramas: true,
  },
  avisos: {
    empenhos: true,
    alerts: true,
    invoices: false,
    comissoes: false,
    cronogramas: false,
  },
};

export const REALTIME_OPERATIONAL_COLLECTIONS: RealtimeOperationalCollection[] = [
  'empenhos',
  'alerts',
  'invoices',
  'comissoes',
  'cronogramas',
];

export function buildOperationalSubscriptionPlan(
  activeTab: OperationalActiveTab
): OperationalSubscriptionPlan {
  return PLAN_BY_TAB[activeTab];
}

export function getRequiredRealtimeCollections(
  activeTab: OperationalActiveTab
): RealtimeOperationalCollection[] {
  const plan = buildOperationalSubscriptionPlan(activeTab);
  return REALTIME_OPERATIONAL_COLLECTIONS.filter((collectionName) => plan[collectionName]);
}

export function countRealtimeOperationalCollections(
  activeTab: OperationalActiveTab
): number {
  return getRequiredRealtimeCollections(activeTab).length;
}
