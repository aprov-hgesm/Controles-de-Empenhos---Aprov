import type { AdminWorkspaceUsageEstimate } from './platformAdminUsage';
import {
  assessUsageBudget,
  type FirebaseGlobalUsageSnapshot,
  type InternalDailyUsageBudget,
  type UsageBudgetAssessment,
  type UsageBudgetLevel,
} from './platformCapacity';
import type { Workspace } from './platformIdentity';

export const USAGE_ALERT_POLICY_SOURCE = 'emprovex-explicit-usage-alert-policy' as const;

export type UsageAlertMetric =
  | 'documentReads'
  | 'documentWrites'
  | 'documentDeletes';

export type UsageAlertOrigin =
  | 'global-real'
  | 'workspace-estimate';

export interface UsageAlertPolicy {
  source: typeof USAGE_ALERT_POLICY_SOURCE;
  globalDailyReference: InternalDailyUsageBudget;
  workspaceDailyBudgetsByUg: Record<string, InternalDailyUsageBudget>;
  configuredGlobalMetrics: number;
  configuredWorkspaceUgs: number;
}

export interface UsageThresholdAlert {
  id: string;
  origin: UsageAlertOrigin;
  metric: UsageAlertMetric;
  level: Exclude<UsageBudgetLevel, 'unconfigured' | 'normal'>;
  assessment: UsageBudgetAssessment;
  used: number;
  budget: number;
  workspaceId: string | null;
  workspaceName: string | null;
  ug: string | null;
}

const METRICS: UsageAlertMetric[] = [
  'documentReads',
  'documentWrites',
  'documentDeletes',
];

const LEVEL_WEIGHT: Record<UsageBudgetLevel, number> = {
  unconfigured: 0,
  normal: 1,
  attention: 2,
  elevated: 3,
  critical: 4,
  exceeded: 5,
};

function metricValue(
  metric: UsageAlertMetric,
  usage: Pick<
    FirebaseGlobalUsageSnapshot,
    'documentReads' | 'documentWrites' | 'documentDeletes'
  >
): number {
  return usage[metric];
}

function budgetValue(
  metric: UsageAlertMetric,
  budget: InternalDailyUsageBudget
): number | null {
  return budget[metric];
}

function alertFromAssessment(input: {
  id: string;
  origin: UsageAlertOrigin;
  metric: UsageAlertMetric;
  assessment: UsageBudgetAssessment;
  used: number;
  budget: number | null;
  workspaceId?: string | null;
  workspaceName?: string | null;
  ug?: string | null;
}): UsageThresholdAlert | null {
  const { assessment, budget } = input;
  if (
    budget === null
    || assessment.level === 'normal'
    || assessment.level === 'unconfigured'
  ) {
    return null;
  }

  return {
    id: input.id,
    origin: input.origin,
    metric: input.metric,
    level: assessment.level,
    assessment,
    used: input.used,
    budget,
    workspaceId: input.workspaceId || null,
    workspaceName: input.workspaceName || null,
    ug: input.ug || null,
  };
}

export function buildUsageThresholdAlerts(input: {
  workspaces: Workspace[];
  workspaceUsage: AdminWorkspaceUsageEstimate[];
  globalUsage: FirebaseGlobalUsageSnapshot | null;
  policy: UsageAlertPolicy;
}): UsageThresholdAlert[] {
  const alerts: UsageThresholdAlert[] = [];

  if (input.globalUsage) {
    for (const metric of METRICS) {
      const budget = budgetValue(metric, input.policy.globalDailyReference);
      const used = metricValue(metric, input.globalUsage);
      const assessment = assessUsageBudget(used, budget);
      const alert = alertFromAssessment({
        id: `global:${metric}`,
        origin: 'global-real',
        metric,
        assessment,
        used,
        budget,
      });
      if (alert) alerts.push(alert);
    }
  }

  for (const estimate of input.workspaceUsage) {
    const budget = input.policy.workspaceDailyBudgetsByUg[estimate.ug];
    if (!budget) continue;

    const workspace = input.workspaces.find(
      (candidate) => candidate.id === estimate.workspaceId
    );

    for (const metric of METRICS) {
      const used = metric === 'documentReads'
        ? estimate.estimatedDocumentReads
        : metric === 'documentWrites'
          ? estimate.estimatedDocumentWrites
          : estimate.estimatedDocumentDeletes;
      const metricBudget = budgetValue(metric, budget);
      const assessment = assessUsageBudget(used, metricBudget);
      const alert = alertFromAssessment({
        id: `workspace:${estimate.workspaceId}:${metric}`,
        origin: 'workspace-estimate',
        metric,
        assessment,
        used,
        budget: metricBudget,
        workspaceId: estimate.workspaceId,
        workspaceName: workspace?.name || null,
        ug: estimate.ug,
      });
      if (alert) alerts.push(alert);
    }
  }

  return alerts.sort((a, b) => (
    LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level]
    || (b.assessment.percentage || 0) - (a.assessment.percentage || 0)
    || a.id.localeCompare(b.id)
  ));
}

export function usageAlertMetricLabel(metric: UsageAlertMetric): string {
  if (metric === 'documentReads') return 'Reads';
  if (metric === 'documentWrites') return 'Writes';
  return 'Deletes';
}

export function usageAlertLevelLabel(level: UsageThresholdAlert['level']): string {
  if (level === 'attention') return 'Atenção';
  if (level === 'elevated') return 'Elevado';
  if (level === 'critical') return 'Crítico';
  return 'Excedido';
}
