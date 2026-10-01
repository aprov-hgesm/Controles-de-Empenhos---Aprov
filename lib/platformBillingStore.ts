'use client';

import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from './firebase';
import {
  appendPlatformAuditEvent,
  createPlatformAuditCorrelationId,
} from './auditTrail';
import {
  DEFAULT_PLATFORM_BILLING_CONFIG,
  EMPROVEX_BILLING_CONFIG_ID,
  EMPROVEX_FULL_PLAN_PRICE_CENTS,
  buildBillingCycle,
  buildBillingCycleStatusTransition,
  buildBillingExemptionUpdate,
  buildInitialBillingAccount,
  buildPlatformBillingConfig,
  billingCycleId,
  migrateBillingAccountToSaasR1,
  migratePlatformBillingConfigToSaasR1,
  type BillingAccount,
  type BillingAccountStatus,
  type BillingCycle,
  type BillingCycleStatus,
  type PlatformBillingConfig,
} from './billing';
import { HGESM_UG, HGESM_WORKSPACE_ID } from './hgesmWorkspace';
import { normalizePlatformEmail, type Workspace } from './platformIdentity';

const BILLING_CONFIG_COLLECTION = 'platformBillingConfig';
const BILLING_ACCOUNTS_COLLECTION = 'billingAccounts';
const BILLING_CYCLES_COLLECTION = 'billingCycles';

export interface PlatformBillingDirectory {
  config: PlatformBillingConfig | null;
  accounts: BillingAccount[];
  cycles: BillingCycle[];
}

export interface UpdatePlatformBillingConfigInput {
  billingMode?: PlatformBillingConfig['billingMode'];
  requirePayment?: boolean;
  monthlyPriceCents?: number;
  defaultTrialDays?: number;
  gracePeriodDays?: number;
  pixKey?: string;
  pixKeyType?: PlatformBillingConfig['pixKeyType'];
  pixRecipientName?: string;
  paymentLinkUrl?: string;
  supportContact?: string;
  holidayDates?: string[];
}

function accountRef(workspaceId: string) {
  return doc(db, BILLING_ACCOUNTS_COLLECTION, workspaceId);
}

function cycleRef(workspaceId: string, referenceMonth: string) {
  return doc(db, BILLING_CYCLES_COLLECTION, billingCycleId(workspaceId, referenceMonth));
}

function normalizeActor(email: string): string {
  const actor = normalizePlatformEmail(email);
  if (!actor) throw new Error('Sessão administrativa inválida.');
  return actor;
}

function sanitizeHttpsUrl(value: string): string {
  const normalized = value.trim();
  if (!normalized) return '';

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error('O Link de Pagamento precisa ser uma URL HTTPS válida.');
  }

  if (url.protocol !== 'https:') {
    throw new Error('O Link de Pagamento precisa usar HTTPS.');
  }

  return url.toString();
}

function sanitizeHolidayDates(values: string[]): string[] {
  return Array.from(new Set(
    values
      .map((value) => value.trim())
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
  )).sort();
}

export async function ensurePlatformBillingFoundation(
  workspaces: Workspace[],
  adminEmail: string
): Promise<void> {
  const actor = normalizeActor(adminEmail);
  const configRef = doc(db, BILLING_CONFIG_COLLECTION, EMPROVEX_BILLING_CONFIG_ID);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(configRef);
    if (!snapshot.exists()) {
      transaction.set(configRef, buildPlatformBillingConfig(actor));
      return;
    }

    const current = snapshot.data() as PlatformBillingConfig;
    const updated = migratePlatformBillingConfigToSaasR1(current, actor);
    if (!updated) return;

    transaction.set(configRef, updated);

    appendPlatformAuditEvent(transaction, {
      operation: current.monthlyPriceCents === updated.monthlyPriceCents
        ? 'billing.config_update'
        : 'billing.price_migration',
      source: 'admin',
      entityType: 'billing_config',
      entityId: EMPROVEX_BILLING_CONFIG_ID,
      correlationId: createPlatformAuditCorrelationId(),
      workspaceId: HGESM_WORKSPACE_ID,
      ug: HGESM_UG,
      actorEmail: actor,
      before: {
        monthlyPriceCents: current.monthlyPriceCents,
        paymentLinkConfigured: Boolean(current.paymentLinkUrl),
        supportContactConfigured: Boolean(current.supportContact),
      },
      after: {
        monthlyPriceCents: updated.monthlyPriceCents,
        paymentLinkConfigured: Boolean(updated.paymentLinkUrl),
        supportContactConfigured: Boolean(updated.supportContact),
      },
      metadata: { reason: 'saas_r1_full_plan_70_brl' },
    });
  });

  for (const workspace of workspaces) {
    const ref = accountRef(workspace.id);
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists()) {
        const current = snapshot.data() as BillingAccount;
        const updated = migrateBillingAccountToSaasR1(
          current,
          workspace.id === HGESM_WORKSPACE_ID,
          actor
        );
        if (!updated) return;

        transaction.set(ref, updated);

        appendPlatformAuditEvent(transaction, {
          operation: current.monthlyPriceCents === updated.monthlyPriceCents
            ? 'billing.status_change'
            : 'billing.price_migration',
          source: 'admin',
          entityType: 'billing_account',
          entityId: workspace.id,
          correlationId: createPlatformAuditCorrelationId(),
          workspaceId: workspace.id,
          ug: workspace.ug || null,
          actorEmail: actor,
          before: {
            status: current.status,
            monthlyPriceCents: current.monthlyPriceCents,
          },
          after: {
            status: updated.status,
            monthlyPriceCents: updated.monthlyPriceCents,
          },
          metadata: {
            reason: updated.status === 'exempt'
              ? 'saas_r1_exempt_zero_brl'
              : 'saas_r1_full_plan_70_brl',
          },
        });
        return;
      }

      transaction.set(
        ref,
        buildInitialBillingAccount(
          workspace,
          actor,
          workspace.id !== HGESM_WORKSPACE_ID,
          DEFAULT_PLATFORM_BILLING_CONFIG.defaultTrialDays
        )
      );
    });
  }
}

export function subscribePlatformBillingConfig(
  onData: (config: PlatformBillingConfig | null) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, BILLING_CONFIG_COLLECTION, EMPROVEX_BILLING_CONFIG_ID),
    (snapshot) => onData(snapshot.exists() ? snapshot.data() as PlatformBillingConfig : null),
    onError
  );
}

export function subscribePlatformBillingAccounts(
  onData: (accounts: BillingAccount[]) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, BILLING_ACCOUNTS_COLLECTION),
    (snapshot) => onData(snapshot.docs.map((entry) => entry.data() as BillingAccount)),
    onError
  );
}

export function subscribePlatformBillingCycles(
  onData: (cycles: BillingCycle[]) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, BILLING_CYCLES_COLLECTION),
    (snapshot) => onData(snapshot.docs.map((entry) => entry.data() as BillingCycle)),
    onError
  );
}

export async function updatePlatformBillingConfig(
  input: UpdatePlatformBillingConfigInput,
  adminEmail: string
): Promise<PlatformBillingConfig> {
  const actor = normalizeActor(adminEmail);
  const ref = doc(db, BILLING_CONFIG_COLLECTION, EMPROVEX_BILLING_CONFIG_ID);
  const correlationId = createPlatformAuditCorrelationId();

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists()
      ? snapshot.data() as PlatformBillingConfig
      : buildPlatformBillingConfig(actor);

    if (
      input.monthlyPriceCents !== undefined
      && Math.trunc(input.monthlyPriceCents) !== EMPROVEX_FULL_PLAN_PRICE_CENTS
    ) {
      throw new Error('O Plano Completo EMPROVEX possui mensalidade fixa de R$ 70,00 na R1.');
    }

    const now = new Date().toISOString();
    const monthlyPriceCents = EMPROVEX_FULL_PLAN_PRICE_CENTS;
    const defaultTrialDays = input.defaultTrialDays === undefined
      ? current.defaultTrialDays
      : Math.max(1, Math.min(365, Math.trunc(input.defaultTrialDays)));
    const gracePeriodDays = input.gracePeriodDays === undefined
      ? current.gracePeriodDays
      : Math.max(0, Math.min(90, Math.trunc(input.gracePeriodDays)));

    const updated: PlatformBillingConfig = {
      ...current,
      billingMode: input.billingMode ?? current.billingMode,
      requirePayment: input.requirePayment ?? current.requirePayment,
      automaticSuspension: false,
      monthlyPriceCents,
      defaultTrialDays,
      gracePeriodDays,
      pixKey: input.pixKey === undefined ? current.pixKey : input.pixKey.trim(),
      pixKeyType: input.pixKeyType ?? current.pixKeyType,
      pixRecipientName: input.pixRecipientName === undefined
        ? current.pixRecipientName
        : input.pixRecipientName.trim(),
      paymentLinkUrl: input.paymentLinkUrl === undefined
        ? current.paymentLinkUrl || ''
        : sanitizeHttpsUrl(input.paymentLinkUrl),
      supportContact: input.supportContact === undefined
        ? current.supportContact || ''
        : input.supportContact.trim().slice(0, 240),
      holidayDates: input.holidayDates === undefined
        ? current.holidayDates
        : sanitizeHolidayDates(input.holidayDates),
      updatedAt: now,
      updatedBy: actor,
    };

    transaction.set(ref, updated);

    appendPlatformAuditEvent(transaction, {
      operation: 'billing.config_update',
      source: 'admin',
      entityType: 'billing_config',
      entityId: EMPROVEX_BILLING_CONFIG_ID,
      correlationId,
      workspaceId: HGESM_WORKSPACE_ID,
      ug: HGESM_UG,
      actorEmail: actor,
      before: {
        billingMode: current.billingMode,
        requirePayment: current.requirePayment,
        monthlyPriceCents: current.monthlyPriceCents,
        defaultTrialDays: current.defaultTrialDays,
        gracePeriodDays: current.gracePeriodDays,
      },
      after: {
        billingMode: updated.billingMode,
        requirePayment: updated.requirePayment,
        monthlyPriceCents: updated.monthlyPriceCents,
        defaultTrialDays: updated.defaultTrialDays,
        gracePeriodDays: updated.gracePeriodDays,
      },
      metadata: {
        automaticSuspension: false,
        paymentMethod: 'pix_manual',
      },
    });

    return updated;
  });
}

export async function grantBillingTrial(
  workspace: Workspace,
  adminEmail: string,
  trialDays: number = DEFAULT_PLATFORM_BILLING_CONFIG.defaultTrialDays
): Promise<BillingAccount> {
  if (workspace.id === HGESM_WORKSPACE_ID) {
    throw new Error('A conta fundadora é isenta e não utiliza período de teste.');
  }

  const actor = normalizeActor(adminEmail);
  const ref = accountRef(workspace.id);
  const correlationId = createPlatformAuditCorrelationId();

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists()
      ? snapshot.data() as BillingAccount
      : buildInitialBillingAccount(workspace, actor, false);

    if (current.status === 'exempt') {
      throw new Error('Remova a isenção VIP antes de conceder um período de teste.');
    }

    const trial = buildInitialBillingAccount(
      workspace,
      current.createdBy || actor,
      true,
      trialDays
    );
    const updated: BillingAccount = {
      ...current,
      status: 'trial',
      monthlyPriceCents: EMPROVEX_FULL_PLAN_PRICE_CENTS,
      trialGranted: true,
      trialStartedAt: trial.trialStartedAt,
      trialEndsAt: trial.trialEndsAt,
      paymentRequired: false,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
    };

    transaction.set(ref, updated);

    appendPlatformAuditEvent(transaction, {
      operation: 'billing.trial_grant',
      source: 'admin',
      entityType: 'billing_account',
      entityId: workspace.id,
      correlationId,
      workspaceId: workspace.id,
      ug: workspace.ug || null,
      actorEmail: actor,
      before: {
        status: current.status,
        trialGranted: current.trialGranted,
        trialEndsAt: current.trialEndsAt,
      },
      after: {
        status: updated.status,
        trialGranted: true,
        trialStartedAt: updated.trialStartedAt,
        trialEndsAt: updated.trialEndsAt,
      },
      metadata: {
        trialDays: Math.max(1, Math.min(365, Math.trunc(trialDays))),
      },
    });

    return updated;
  });
}

export async function setBillingExemption(
  workspace: Workspace,
  exempt: boolean,
  adminEmail: string
): Promise<BillingAccount> {
  if (workspace.id === HGESM_WORKSPACE_ID) {
    throw new Error('A conta fundadora permanece isenta.');
  }

  const actor = normalizeActor(adminEmail);
  const ref = accountRef(workspace.id);
  const correlationId = createPlatformAuditCorrelationId();

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists()
      ? snapshot.data() as BillingAccount
      : buildInitialBillingAccount(workspace, actor, false);
    const updated = buildBillingExemptionUpdate(current, exempt, actor);

    if (
      current.status === updated.status
      && current.monthlyPriceCents === updated.monthlyPriceCents
      && current.paymentRequired === updated.paymentRequired
    ) {
      return current;
    }

    transaction.set(ref, updated);

    appendPlatformAuditEvent(transaction, {
      operation: 'billing.status_change',
      source: 'admin',
      entityType: 'billing_account',
      entityId: workspace.id,
      correlationId,
      workspaceId: workspace.id,
      ug: workspace.ug || null,
      actorEmail: actor,
      before: {
        status: current.status,
        monthlyPriceCents: current.monthlyPriceCents,
      },
      after: {
        status: updated.status,
        monthlyPriceCents: updated.monthlyPriceCents,
      },
      metadata: {
        commercialExemption: exempt,
        presentation: exempt ? 'VIP / Isento' : 'Plano Completo',
        enforcementActive: false,
      },
    });

    return updated;
  });
}

export async function setBillingCommercialStatus(
  workspace: Workspace,
  status: Exclude<BillingAccountStatus, 'exempt'>,
  adminEmail: string
): Promise<BillingAccount> {
  if (workspace.id === HGESM_WORKSPACE_ID) {
    throw new Error('A conta fundadora permanece isenta.');
  }

  const actor = normalizeActor(adminEmail);
  const ref = accountRef(workspace.id);
  const correlationId = createPlatformAuditCorrelationId();

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists()
      ? snapshot.data() as BillingAccount
      : buildInitialBillingAccount(workspace, actor, false);

    if (current.status === 'exempt') {
      throw new Error('Remova a isenção VIP antes de alterar o status comercial.');
    }

    const now = new Date().toISOString();
    const updated: BillingAccount = {
      ...current,
      status,
      monthlyPriceCents: EMPROVEX_FULL_PLAN_PRICE_CENTS,
      paymentRequired: false,
      updatedAt: now,
      updatedBy: actor,
    };

    transaction.set(ref, updated);

    appendPlatformAuditEvent(transaction, {
      operation: 'billing.status_change',
      source: 'admin',
      entityType: 'billing_account',
      entityId: workspace.id,
      correlationId,
      workspaceId: workspace.id,
      ug: workspace.ug || null,
      actorEmail: actor,
      before: { status: current.status },
      after: { status },
      metadata: {
        enforcementActive: false,
      },
    });

    return updated;
  });
}

export async function setBillingCycleStatus(
  workspace: Workspace,
  account: BillingAccount,
  config: PlatformBillingConfig,
  referenceMonth: string,
  status: BillingCycleStatus,
  adminEmail: string,
  note = ''
): Promise<BillingCycle> {
  const actor = normalizeActor(adminEmail);
  const ref = cycleRef(workspace.id, referenceMonth);
  const accountDocument = accountRef(workspace.id);
  const correlationId = createPlatformAuditCorrelationId();

  return runTransaction(db, async (transaction) => {
    const [cycleSnapshot, accountSnapshot] = await Promise.all([
      transaction.get(ref),
      transaction.get(accountDocument),
    ]);

    const persistedAccount = accountSnapshot.exists()
      ? accountSnapshot.data() as BillingAccount
      : account;

    if (persistedAccount.status === 'exempt') {
      throw new Error('Conta isenta não possui competência de pagamento.');
    }

    const base = cycleSnapshot.exists()
      ? cycleSnapshot.data() as BillingCycle
      : buildBillingCycle(persistedAccount, referenceMonth, config, actor);
    const now = new Date().toISOString();
    const confirmed = status === 'paid' || status === 'waived';
    const transition = buildBillingCycleStatusTransition(
      base,
      status,
      actor,
      note,
      now
    );
    const updated = transition.cycle;
    const targetAccountStatus = confirmed ? 'active' : 'pending';
    const accountChanged = workspace.id !== HGESM_WORKSPACE_ID
      && (
        persistedAccount.status !== targetAccountStatus
        || persistedAccount.monthlyPriceCents !== EMPROVEX_FULL_PLAN_PRICE_CENTS
        || persistedAccount.paymentRequired !== false
      );

    if (!transition.changed && !accountChanged) {
      return base;
    }

    if (transition.changed || !cycleSnapshot.exists()) {
      transaction.set(ref, updated);
    }

    if (workspace.id !== HGESM_WORKSPACE_ID && accountChanged) {
      transaction.set(accountDocument, {
        ...persistedAccount,
        status: targetAccountStatus,
        monthlyPriceCents: EMPROVEX_FULL_PLAN_PRICE_CENTS,
        paymentRequired: false,
        updatedAt: now,
        updatedBy: actor,
      } satisfies BillingAccount);
    }

    appendPlatformAuditEvent(transaction, {
      operation: confirmed
        ? 'billing.payment_confirm'
        : 'billing.payment_reopen',
      source: 'admin',
      entityType: 'billing_cycle',
      entityId: updated.id,
      correlationId,
      workspaceId: workspace.id,
      ug: workspace.ug || null,
      actorEmail: actor,
      before: {
        status: base.status,
        confirmedAt: base.confirmedAt,
      },
      after: {
        status: updated.status,
        confirmedAt: updated.confirmedAt,
        referenceMonth: updated.referenceMonth,
        amountCents: updated.amountCents,
      },
      metadata: {
        manualConfirmation: true,
        idempotentDocumentId: updated.id,
        note: updated.note,
      },
    });

    return updated;
  });
}
