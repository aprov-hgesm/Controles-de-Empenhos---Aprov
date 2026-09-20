import type { Alert, Empenho } from '../../../lib/types';

export const INICIO_SNAPSHOT_VERSION = 'emprovex_home_snapshot_v1' as const;
export const INICIO_SNAPSHOT_DOCUMENT_ID = 'homeSnapshot' as const;
export const INICIO_MAX_VISIBLE_STARS = 72;
export const INICIO_ACTIVE_STAR_BUDGET = 60;
export const INICIO_CLOSED_STAR_BUDGET =
  INICIO_MAX_VISIBLE_STARS - INICIO_ACTIVE_STAR_BUDGET;

export type InicioStarSeverity = 'normal' | 'attention' | 'critical';
export type InicioStarStage = 'active' | 'stalled' | 'urgent' | 'closed';

export interface InicioSnapshotStar {
  id: string;
  supplier: string;
  supplierKey: string;
  classification: string;
  status: Empenho['status'];
  value: number;
  balance: number;
  receivedPct: number;
  severity: InicioStarSeverity;
  stage: InicioStarStage;
  message: string;
}

export interface InicioSnapshotClass {
  code: string;
  count: number;
  value: number;
}

export interface InicioOperationalSnapshot {
  snapshotVersion: typeof INICIO_SNAPSHOT_VERSION;
  workspaceId: string;
  ug: string | null;
  contentHash: string;
  generatedAt: string;
  generatedBy: string;
  metrics: {
    totalEmpenhos: number;
    totalValue: number;
  };
  alerts: {
    total: number;
    critical: number;
    attention: number;
  };
  receiving: {
    pendingEmpenhos: number;
    pendingItems: number;
    balance: number;
  };
  execution: {
    committed: number;
    received: number;
    percentage: number;
  };
  classStats: InicioSnapshotClass[];
  stars: InicioSnapshotStar[];
}

interface BuildInicioSnapshotInput {
  workspaceId: string;
  ug: string | null;
  generatedBy: string;
  empenhos: Empenho[];
  alerts: Alert[];
  generatedAt?: string;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function normalizeInicioSupplierKey(empenho: Empenho): string {
  if (empenho.supplierCnpj) return empenho.supplierCnpj.replace(/\D/g, '');
  return empenho.supplier.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

function getEmpenhoTotals(empenho: Empenho) {
  return empenho.items.reduce(
    (acc, item) => {
      const committed = item.quantity * item.unitPrice;
      const received = Math.min(item.received, item.quantity) * item.unitPrice;
      acc.committed += committed;
      acc.received += received;
      acc.balance += Math.max(0, item.quantity - item.received) * item.unitPrice;
      if (item.received < item.quantity) acc.pendingItems += 1;
      return acc;
    },
    { committed: 0, received: 0, balance: 0, pendingItems: 0 }
  );
}

function buildAlertsByEmpenho(alerts: Alert[]): Map<string, Alert[]> {
  const map = new Map<string, Alert[]>();
  alerts.forEach((alert) => {
    if (!alert.empenhoId) return;
    const current = map.get(alert.empenhoId) ?? [];
    current.push(alert);
    map.set(alert.empenhoId, current);
  });

  map.forEach((linkedAlerts) => {
    linkedAlerts.sort((left, right) => {
      const dateDelta = (right.date || '').localeCompare(left.date || '');
      if (dateDelta !== 0) return dateDelta;
      return left.id.localeCompare(right.id);
    });
  });

  return map;
}

function getSeverity(
  empenho: Empenho,
  alertsByEmpenho: Map<string, Alert[]>
): InicioStarSeverity {
  const linkedAlerts = alertsByEmpenho.get(empenho.id) ?? [];

  if (
    empenho.status === 'Urgente'
    || linkedAlerts.some(
      (alert) => alert.type === 'CRÍTICO' || alert.type === 'ESTOQUE ZERADO'
    )
  ) {
    return 'critical';
  }

  if (
    empenho.status === 'Sem Movimentação'
    || (empenho.lastNFDaysAgo ?? 0) >= 10
    || linkedAlerts.some((alert) => alert.type === 'ATENÇÃO')
  ) {
    return 'attention';
  }

  return 'normal';
}

function getStage(empenho: Empenho): InicioStarStage {
  if (empenho.status === 'Encerrado') return 'closed';
  if (empenho.status === 'Urgente') return 'urgent';
  if (empenho.status === 'Sem Movimentação') return 'stalled';
  return 'active';
}

function getMessage(
  empenho: Empenho,
  alertsByEmpenho: Map<string, Alert[]>
): string {
  const linked = alertsByEmpenho.get(empenho.id) ?? [];
  const critical = linked.find(
    (alert) => alert.type === 'CRÍTICO' || alert.type === 'ESTOQUE ZERADO'
  );
  if (critical) return critical.subtitle || critical.title || critical.description;

  const attention = linked.find((alert) => alert.type === 'ATENÇÃO');
  if (attention) return attention.subtitle || attention.title || attention.description;

  if (empenho.status === 'Urgente') return 'Empenho marcado como urgente.';
  if (empenho.status === 'Sem Movimentação') return 'Empenho sem movimentação recente.';
  if ((empenho.lastNFDaysAgo ?? 0) >= 10) {
    return `Última nota fiscal registrada há ${empenho.lastNFDaysAgo} dias.`;
  }
  if (empenho.status === 'Encerrado') {
    return 'Empenho encerrado — histórico operacional.';
  }

  return 'Operação sem sinal de atenção ativo.';
}

function selectSnapshotEmpenhos(
  empenhos: Empenho[],
  alertsByEmpenho: Map<string, Alert[]>
): Empenho[] {
  const severityWeight: Record<InicioStarSeverity, number> = {
    critical: 0,
    attention: 1,
    normal: 2,
  };

  const active = empenhos
    .filter((empenho) => empenho.status !== 'Encerrado')
    .sort((left, right) => {
      const severityDelta =
        severityWeight[getSeverity(left, alertsByEmpenho)]
        - severityWeight[getSeverity(right, alertsByEmpenho)];
      if (severityDelta !== 0) return severityDelta;
      return left.id.localeCompare(right.id);
    })
    .slice(0, INICIO_ACTIVE_STAR_BUDGET);

  const closed = empenhos
    .filter((empenho) => empenho.status === 'Encerrado')
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, INICIO_CLOSED_STAR_BUDGET);

  return [...active, ...closed];
}

export function buildInicioOperationalSnapshot({
  workspaceId,
  ug,
  generatedBy,
  empenhos,
  alerts,
  generatedAt = new Date().toISOString(),
}: BuildInicioSnapshotInput): InicioOperationalSnapshot {
  const alertsByEmpenho = buildAlertsByEmpenho(alerts);

  let committed = 0;
  let received = 0;
  let balance = 0;
  let pendingItems = 0;
  let pendingEmpenhos = 0;

  const classMap = new Map<string, InicioSnapshotClass>();

  empenhos.forEach((empenho) => {
    const totals = getEmpenhoTotals(empenho);
    const classification = (empenho.classification || 'QR').trim().toUpperCase();

    committed += totals.committed;
    received += totals.received;
    balance += totals.balance;
    pendingItems += totals.pendingItems;
    if (totals.pendingItems > 0) pendingEmpenhos += 1;

    const current = classMap.get(classification) ?? {
      code: classification,
      count: 0,
      value: 0,
    };
    current.count += 1;
    current.value += totals.committed;
    classMap.set(classification, current);
  });

  const criticalAlerts = alerts.filter(
    (alert) => alert.type === 'CRÍTICO' || alert.type === 'ESTOQUE ZERADO'
  ).length;

  const selectedEmpenhos = selectSnapshotEmpenhos(empenhos, alertsByEmpenho);

  const stars: InicioSnapshotStar[] = selectedEmpenhos.map((empenho) => {
    const totals = getEmpenhoTotals(empenho);
    return {
      id: empenho.id,
      supplier: empenho.supplier,
      supplierKey: normalizeInicioSupplierKey(empenho),
      classification: (empenho.classification || 'QR').trim().toUpperCase(),
      status: empenho.status,
      value: totals.committed,
      balance: totals.balance,
      receivedPct:
        totals.committed > 0
          ? Math.round((totals.received / totals.committed) * 100)
          : 0,
      severity: getSeverity(empenho, alertsByEmpenho),
      stage: getStage(empenho),
      message: getMessage(empenho, alertsByEmpenho),
    };
  });

  const classStats = Array.from(classMap.values()).sort((left, right) =>
    left.code.localeCompare(right.code)
  );

  const content = {
    metrics: {
      totalEmpenhos: empenhos.length,
      totalValue: committed,
    },
    alerts: {
      total: alerts.length,
      critical: criticalAlerts,
      attention: Math.max(0, alerts.length - criticalAlerts),
    },
    receiving: {
      pendingEmpenhos,
      pendingItems,
      balance,
    },
    execution: {
      committed,
      received,
      percentage: committed > 0 ? Math.round((received / committed) * 100) : 0,
    },
    classStats,
    stars,
  };

  return {
    snapshotVersion: INICIO_SNAPSHOT_VERSION,
    workspaceId,
    ug,
    contentHash: stableHash(JSON.stringify(content)),
    generatedAt,
    generatedBy,
    ...content,
  };
}

export function isInicioOperationalSnapshot(
  value: unknown,
  expectedWorkspaceId: string,
  expectedUg: string | null
): value is InicioOperationalSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<InicioOperationalSnapshot>;

  return snapshot.snapshotVersion === INICIO_SNAPSHOT_VERSION
    && snapshot.workspaceId === expectedWorkspaceId
    && (snapshot.ug ?? null) === expectedUg
    && typeof snapshot.contentHash === 'string'
    && typeof snapshot.generatedAt === 'string'
    && typeof snapshot.generatedBy === 'string'
    && Boolean(snapshot.metrics && typeof snapshot.metrics.totalEmpenhos === 'number')
    && Boolean(snapshot.alerts && typeof snapshot.alerts.total === 'number')
    && Boolean(snapshot.receiving && typeof snapshot.receiving.balance === 'number')
    && Boolean(snapshot.execution && typeof snapshot.execution.percentage === 'number')
    && Array.isArray(snapshot.classStats)
    && Array.isArray(snapshot.stars)
    && snapshot.stars.length <= INICIO_MAX_VISIBLE_STARS;
}
