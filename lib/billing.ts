import type { Workspace } from './platformIdentity';

export const EMPROVEX_BILLING_VERSION = 'emprovex_billing_v1' as const;
export const EMPROVEX_BILLING_CONFIG_ID = 'main' as const;

export type BillingMode = 'off' | 'observe' | 'enforce';
export type BillingAccountStatus =
  | 'trial'
  | 'active'
  | 'pending'
  | 'suspended'
  | 'canceled'
  | 'exempt';
export type BillingCycleStatus = 'open' | 'pending' | 'paid' | 'waived';
export type BillingPaymentMethod = 'pix_manual';
export type BillingPixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random' | '';

export interface PlatformBillingConfig {
  version: typeof EMPROVEX_BILLING_VERSION;
  billingMode: BillingMode;
  requirePayment: boolean;
  automaticSuspension: boolean;
  monthlyPriceCents: number;
  currency: 'BRL';
  defaultTrialDays: number;
  dueBusinessDay: 5;
  gracePeriodDays: number;
  paymentMethod: BillingPaymentMethod;
  pixKey: string;
  pixKeyType: BillingPixKeyType;
  pixRecipientName: string;
  holidayDates: string[];
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface BillingAccount {
  version: typeof EMPROVEX_BILLING_VERSION;
  workspaceId: string;
  ug: string;
  authorizedEmail: string;
  status: BillingAccountStatus;
  monthlyPriceCents: number;
  currency: 'BRL';
  trialGranted: boolean;
  trialStartedAt: string;
  trialEndsAt: string;
  paymentRequired: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface BillingCycle {
  version: typeof EMPROVEX_BILLING_VERSION;
  id: string;
  workspaceId: string;
  ug: string;
  referenceMonth: string;
  amountCents: number;
  dueDate: string;
  status: BillingCycleStatus;
  confirmedAt: string;
  confirmedBy: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export const DEFAULT_PLATFORM_BILLING_CONFIG: Omit<
  PlatformBillingConfig,
  'createdAt' | 'updatedAt' | 'updatedBy'
> = {
  version: EMPROVEX_BILLING_VERSION,
  billingMode: 'observe',
  requirePayment: false,
  automaticSuspension: false,
  monthlyPriceCents: 5000,
  currency: 'BRL',
  defaultTrialDays: 30,
  dueBusinessDay: 5,
  gracePeriodDays: 10,
  paymentMethod: 'pix_manual',
  pixKey: '',
  pixKeyType: '',
  pixRecipientName: '',
  holidayDates: [],
};

function utcDate(value: string | Date): Date {
  const source = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(
    source.getUTCFullYear(),
    source.getUTCMonth(),
    source.getUTCDate(),
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds()
  ));
}

export function addUtcDays(value: string | Date, days: number): Date {
  const date = utcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export function formatUtcDateOnly(value: string | Date): string {
  return utcDate(value).toISOString().slice(0, 10);
}

export function getReferenceMonth(value: string | Date = new Date()): string {
  return formatUtcDateOnly(value).slice(0, 7);
}

export function getBrazilFixedNationalHolidays(year: number): string[] {
  return [
    `${year}-01-01`,
    `${year}-04-21`,
    `${year}-05-01`,
    `${year}-09-07`,
    `${year}-10-12`,
    `${year}-11-02`,
    `${year}-11-15`,
    `${year}-11-20`,
    `${year}-12-25`,
  ];
}

export function getFifthBusinessDay(
  year: number,
  month: number,
  holidayDates: string[] = []
): string {
  if (!Number.isInteger(year) || year < 2000 || year > 2200) {
    throw new Error('Ano inválido para cálculo do vencimento.');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Mês inválido para cálculo do vencimento.');
  }

  const holidays = new Set([
    ...getBrazilFixedNationalHolidays(year),
    ...holidayDates,
  ]);

  let count = 0;
  const cursor = new Date(Date.UTC(year, month - 1, 1));

  while (cursor.getUTCMonth() === month - 1) {
    const weekDay = cursor.getUTCDay();
    const dateKey = formatUtcDateOnly(cursor);
    const isWeekday = weekDay !== 0 && weekDay !== 6;

    if (isWeekday && !holidays.has(dateKey)) {
      count += 1;
      if (count === 5) return dateKey;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  throw new Error('Não foi possível calcular o 5º dia útil.');
}

export function getDueDateForReferenceMonth(
  referenceMonth: string,
  holidayDates: string[] = []
): string {
  const match = /^(\d{4})-(\d{2})$/.exec(referenceMonth);
  if (!match) throw new Error('Competência de cobrança inválida.');
  return getFifthBusinessDay(Number(match[1]), Number(match[2]), holidayDates);
}

export function getGraceEndsAt(dueDate: string, gracePeriodDays: number): string {
  return formatUtcDateOnly(addUtcDays(`${dueDate}T00:00:00.000Z`, gracePeriodDays));
}

export function getNextBillingDueDateAfter(
  value: string | Date,
  holidayDates: string[] = []
): string {
  const date = utcDate(value);
  const currentYear = date.getUTCFullYear();
  const currentMonth = date.getUTCMonth() + 1;
  const currentDue = getFifthBusinessDay(currentYear, currentMonth, holidayDates);
  const dateOnly = formatUtcDateOnly(date);

  if (currentDue > dateOnly) return currentDue;

  const next = new Date(Date.UTC(currentYear, currentMonth, 1));
  return getFifthBusinessDay(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    holidayDates
  );
}

export function calculateTrialDaysRemaining(
  account: BillingAccount,
  now: string | Date = new Date()
): number | null {
  if (!account.trialGranted || !account.trialEndsAt) return null;
  const end = utcDate(account.trialEndsAt).getTime();
  const current = utcDate(now).getTime();
  return Math.max(0, Math.ceil((end - current) / 86_400_000));
}

export function isTrialExpired(
  account: BillingAccount,
  now: string | Date = new Date()
): boolean {
  return Boolean(
    account.trialGranted
    && account.trialEndsAt
    && utcDate(now).getTime() >= utcDate(account.trialEndsAt).getTime()
  );
}

export function buildPlatformBillingConfig(
  updatedBy: string,
  now: string = new Date().toISOString()
): PlatformBillingConfig {
  return {
    ...DEFAULT_PLATFORM_BILLING_CONFIG,
    createdAt: now,
    updatedAt: now,
    updatedBy,
  };
}

export function buildInitialBillingAccount(
  workspace: Workspace,
  createdBy: string,
  grantTrial: boolean,
  trialDays: number = DEFAULT_PLATFORM_BILLING_CONFIG.defaultTrialDays,
  now: string = new Date().toISOString()
): BillingAccount {
  const isFounder = workspace.id === 'hgesm-aprov';
  const normalizedTrialDays = Math.max(1, Math.min(365, Math.trunc(trialDays || 30)));
  const trialEndsAt = grantTrial && !isFounder
    ? addUtcDays(now, normalizedTrialDays).toISOString()
    : '';

  return {
    version: EMPROVEX_BILLING_VERSION,
    workspaceId: workspace.id,
    ug: workspace.ug || '',
    authorizedEmail: workspace.authorizedEmail,
    status: isFounder ? 'exempt' : grantTrial ? 'trial' : 'active',
    monthlyPriceCents: isFounder ? 0 : DEFAULT_PLATFORM_BILLING_CONFIG.monthlyPriceCents,
    currency: 'BRL',
    trialGranted: Boolean(grantTrial && !isFounder),
    trialStartedAt: grantTrial && !isFounder ? now : '',
    trialEndsAt,
    paymentRequired: false,
    createdAt: now,
    updatedAt: now,
    createdBy,
    updatedBy: createdBy,
  };
}

export function billingCycleId(workspaceId: string, referenceMonth: string): string {
  return `${workspaceId}__${referenceMonth}`;
}

export function buildBillingCycle(
  account: BillingAccount,
  referenceMonth: string,
  config: PlatformBillingConfig,
  actorEmail: string,
  now: string = new Date().toISOString()
): BillingCycle {
  const dueDate = getDueDateForReferenceMonth(referenceMonth, config.holidayDates);
  return {
    version: EMPROVEX_BILLING_VERSION,
    id: billingCycleId(account.workspaceId, referenceMonth),
    workspaceId: account.workspaceId,
    ug: account.ug,
    referenceMonth,
    amountCents: account.monthlyPriceCents,
    dueDate,
    status: 'pending',
    confirmedAt: '',
    confirmedBy: '',
    note: '',
    createdAt: now,
    updatedAt: now,
    updatedBy: actorEmail,
  };
}

export function getBillingAttention(
  account: BillingAccount,
  cycles: BillingCycle[],
  config: PlatformBillingConfig,
  now: string | Date = new Date()
): {
  trialExpired: boolean;
  trialDaysRemaining: number | null;
  referenceMonth: string;
  dueDate: string;
  graceEndsAt: string;
  currentCycle: BillingCycle | null;
  needsAttention: boolean;
  overdueDays: number;
} {
  const referenceMonth = getReferenceMonth(now);
  const dueDate = getDueDateForReferenceMonth(referenceMonth, config.holidayDates);
  const graceEndsAt = getGraceEndsAt(dueDate, config.gracePeriodDays);
  const today = formatUtcDateOnly(now);
  const currentCycle = cycles.find(
    (cycle) => cycle.workspaceId === account.workspaceId
      && cycle.referenceMonth === referenceMonth
  ) || null;
  const trialExpired = isTrialExpired(account, now);
  const trialDaysRemaining = calculateTrialDaysRemaining(account, now);
  const paid = currentCycle?.status === 'paid' || currentCycle?.status === 'waived';
  const trialCoversToday = account.status === 'trial' && !trialExpired;
  const needsAttention = !trialCoversToday
    && account.status !== 'exempt'
    && account.status !== 'canceled'
    && today >= dueDate
    && !paid;
  const overdueDays = needsAttention
    ? Math.max(0, Math.floor(
      (utcDate(`${today}T00:00:00.000Z`).getTime()
        - utcDate(`${dueDate}T00:00:00.000Z`).getTime()) / 86_400_000
    ))
    : 0;

  return {
    trialExpired,
    trialDaysRemaining,
    referenceMonth,
    dueDate,
    graceEndsAt,
    currentCycle,
    needsAttention,
    overdueDays,
  };
}
