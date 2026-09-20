import type { InternalDailyUsageBudget } from '../platformCapacity';
import { isValidUnitUg } from '../platformIdentity';
import {
  USAGE_ALERT_POLICY_SOURCE,
  type UsageAlertPolicy,
} from '../usageAlerts';

const GLOBAL_REFERENCE_ENV = 'EMPROVEX_GLOBAL_DAILY_USAGE_REFERENCE_JSON';
const WORKSPACE_BUDGETS_ENV = 'EMPROVEX_WORKSPACE_DAILY_USAGE_BUDGETS_JSON';

const EMPTY_BUDGET: InternalDailyUsageBudget = {
  documentReads: null,
  documentWrites: null,
  documentDeletes: null,
};

function parsePositiveIntegerOrNull(
  value: unknown,
  field: string
): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new Error(
      `Referência de consumo inválida em ${field}: use inteiro positivo ou null.`
    );
  }
  return Number(value);
}

function parseBudget(value: unknown, scope: string): InternalDailyUsageBudget {
  if (value === null || value === undefined) return { ...EMPTY_BUDGET };
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Referência de consumo inválida em ${scope}.`);
  }

  const record = value as Record<string, unknown>;
  const allowed = new Set([
    'documentReads',
    'documentWrites',
    'documentDeletes',
  ]);
  const unknown = Object.keys(record).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new Error(
      `Campo desconhecido em ${scope}: ${unknown.join(', ')}.`
    );
  }

  return {
    documentReads: parsePositiveIntegerOrNull(
      record.documentReads,
      `${scope}.documentReads`
    ),
    documentWrites: parsePositiveIntegerOrNull(
      record.documentWrites,
      `${scope}.documentWrites`
    ),
    documentDeletes: parsePositiveIntegerOrNull(
      record.documentDeletes,
      `${scope}.documentDeletes`
    ),
  };
}

function parseJsonEnvironment(name: string): unknown | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Variável ${name} não contém JSON válido.`);
  }
}

function countConfiguredMetrics(budget: InternalDailyUsageBudget): number {
  return [
    budget.documentReads,
    budget.documentWrites,
    budget.documentDeletes,
  ].filter((value) => value !== null).length;
}

export function loadUsageAlertPolicy(): UsageAlertPolicy {
  const globalDailyReference = parseBudget(
    parseJsonEnvironment(GLOBAL_REFERENCE_ENV),
    GLOBAL_REFERENCE_ENV
  );

  const rawWorkspaceBudgets = parseJsonEnvironment(WORKSPACE_BUDGETS_ENV);
  const workspaceDailyBudgetsByUg: Record<string, InternalDailyUsageBudget> = {};

  if (rawWorkspaceBudgets !== null) {
    if (
      typeof rawWorkspaceBudgets !== 'object'
      || Array.isArray(rawWorkspaceBudgets)
    ) {
      throw new Error(
        `Variável ${WORKSPACE_BUDGETS_ENV} deve ser um objeto JSON indexado por UG.`
      );
    }

    for (const [ug, rawBudget] of Object.entries(
      rawWorkspaceBudgets as Record<string, unknown>
    )) {
      if (!isValidUnitUg(ug)) {
        throw new Error(
          `UG inválida na variável ${WORKSPACE_BUDGETS_ENV}: ${ug}.`
        );
      }
      workspaceDailyBudgetsByUg[ug] = parseBudget(
        rawBudget,
        `${WORKSPACE_BUDGETS_ENV}.${ug}`
      );
    }
  }

  return {
    source: USAGE_ALERT_POLICY_SOURCE,
    globalDailyReference,
    workspaceDailyBudgetsByUg,
    configuredGlobalMetrics: countConfiguredMetrics(globalDailyReference),
    configuredWorkspaceUgs: Object.values(workspaceDailyBudgetsByUg)
      .filter((budget) => countConfiguredMetrics(budget) > 0)
      .length,
  };
}
