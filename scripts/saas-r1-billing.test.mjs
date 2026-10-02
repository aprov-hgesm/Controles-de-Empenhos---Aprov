#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = fs.readFileSync('lib/billing.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const billing = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const NOW = '2026-10-01T12:00:00.000Z';
const ACTOR = 'admin@example.com';
const workspace = {
  id: 'workspace-a',
  ug: '160416',
  authorizedEmail: 'cliente@example.com',
};
const founderWorkspace = {
  id: 'hgesm-aprov',
  ug: '160416',
  authorizedEmail: 'aprov1hgesm@gmail.com',
};

function configFixture(overrides = {}) {
  return {
    ...billing.DEFAULT_PLATFORM_BILLING_CONFIG,
    createdAt: NOW,
    updatedAt: NOW,
    updatedBy: ACTOR,
    ...overrides,
  };
}

test('Plano Completo usa R$ 70, trial de 30 dias e fundador permanece isento', () => {
  assert.equal(billing.EMPROVEX_FULL_PLAN_PRICE_CENTS, 7000);
  assert.equal(billing.DEFAULT_PLATFORM_BILLING_CONFIG.monthlyPriceCents, 7000);
  assert.equal(billing.DEFAULT_PLATFORM_BILLING_CONFIG.defaultTrialDays, 30);

  const account = billing.buildInitialBillingAccount(workspace, ACTOR, true, 30, NOW);
  assert.equal(account.status, 'trial');
  assert.equal(account.monthlyPriceCents, 7000);
  assert.equal(account.trialEndsAt, '2026-10-31T12:00:00.000Z');
  assert.equal(billing.calculateTrialDaysRemaining(account, NOW), 30);

  const founder = billing.buildInitialBillingAccount(founderWorkspace, ACTOR, false, 30, NOW);
  assert.equal(founder.status, 'exempt');
  assert.equal(founder.monthlyPriceCents, 0);
});

test('migração 50 -> 70 é idempotente e normaliza configuração legada', () => {
  const legacy = configFixture({ monthlyPriceCents: 5000 });
  delete legacy.paymentLinkUrl;
  delete legacy.supportContact;

  const migrated = billing.migratePlatformBillingConfigToSaasR1(
    legacy,
    ACTOR,
    '2026-10-01T13:00:00.000Z'
  );
  assert.ok(migrated);
  assert.equal(migrated.monthlyPriceCents, 7000);
  assert.equal(migrated.paymentLinkUrl, '');
  assert.equal(migrated.supportContact, '');
  assert.equal(
    billing.migratePlatformBillingConfigToSaasR1(
      migrated,
      ACTOR,
      '2026-10-01T14:00:00.000Z'
    ),
    null
  );
});

test('contas normais adotam R$ 70; VIP e fundador permanecem em R$ 0', () => {
  const base = billing.buildInitialBillingAccount(workspace, ACTOR, false, 30, NOW);
  const legacy = { ...base, monthlyPriceCents: 5000 };
  const normal = billing.migrateBillingAccountToSaasR1(
    legacy,
    false,
    ACTOR,
    '2026-10-01T13:00:00.000Z'
  );
  assert.equal(normal?.monthlyPriceCents, 7000);
  assert.equal(normal?.status, 'active');

  const vipLegacy = { ...base, status: 'exempt', monthlyPriceCents: 5000 };
  const vip = billing.migrateBillingAccountToSaasR1(
    vipLegacy,
    false,
    ACTOR,
    '2026-10-01T13:00:00.000Z'
  );
  assert.equal(vip?.status, 'exempt');
  assert.equal(vip?.monthlyPriceCents, 0);
  assert.equal(
    billing.migrateBillingAccountToSaasR1(vip, false, ACTOR, '2026-10-01T14:00:00.000Z'),
    null
  );

  const founderLegacy = { ...base, status: 'active', monthlyPriceCents: 5000 };
  const founder = billing.migrateBillingAccountToSaasR1(
    founderLegacy,
    true,
    ACTOR,
    '2026-10-01T13:00:00.000Z'
  );
  assert.equal(founder?.status, 'exempt');
  assert.equal(founder?.monthlyPriceCents, 0);
});

test('conceder e remover VIP preserva dados e retorna ao preço comercial vigente', () => {
  const base = billing.buildInitialBillingAccount(workspace, ACTOR, true, 30, NOW);
  const vip = billing.buildBillingExemptionUpdate(base, true, ACTOR, '2026-10-02T12:00:00.000Z');
  assert.equal(vip.status, 'exempt');
  assert.equal(vip.monthlyPriceCents, 0);
  assert.equal(vip.trialStartedAt, base.trialStartedAt);
  assert.equal(vip.trialEndsAt, base.trialEndsAt);

  const restored = billing.buildBillingExemptionUpdate(
    vip,
    false,
    ACTOR,
    '2026-10-03T12:00:00.000Z'
  );
  assert.equal(restored.status, 'active');
  assert.equal(restored.monthlyPriceCents, 7000);
  assert.equal(restored.createdAt, base.createdAt);
  assert.equal(restored.trialStartedAt, base.trialStartedAt);
});

test('competência usa identidade determinística e histórico materializado não é reprecificado', () => {
  const account = billing.buildInitialBillingAccount(workspace, ACTOR, false, 30, NOW);
  const current = billing.buildBillingCycle(
    account,
    '2026-10',
    configFixture(),
    ACTOR,
    NOW
  );
  assert.equal(current.id, 'workspace-a__2026-10');
  assert.equal(current.amountCents, 7000);
  assert.equal(billing.billingCycleId('workspace-a', '2026-10'), current.id);

  const historical = {
    ...current,
    referenceMonth: '2026-09',
    id: 'workspace-a__2026-09',
    amountCents: 5000,
    status: 'pending',
    confirmedAt: '',
    confirmedBy: '',
    note: '',
  };
  const confirmed = billing.buildBillingCycleStatusTransition(
    historical,
    'paid',
    ACTOR,
    'referência externa 123',
    '2026-10-01T15:00:00.000Z'
  );
  assert.equal(confirmed.cycle.amountCents, 5000);
  assert.equal(confirmed.cycle.status, 'paid');
  assert.equal(confirmed.cycle.confirmedAt, '2026-10-01T15:00:00.000Z');
  assert.equal(confirmed.cycle.confirmedBy, ACTOR);
  assert.equal(confirmed.cycle.note, 'referência externa 123');
});

test('confirmação repetida da mesma competência é idempotente', () => {
  const paid = {
    version: billing.EMPROVEX_BILLING_VERSION,
    id: 'workspace-a__2026-09',
    workspaceId: 'workspace-a',
    ug: '160416',
    referenceMonth: '2026-09',
    amountCents: 5000,
    dueDate: '2026-09-08',
    status: 'paid',
    confirmedAt: '2026-09-08T12:00:00.000Z',
    confirmedBy: ACTOR,
    note: 'referência anterior',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-08T12:00:00.000Z',
    updatedBy: ACTOR,
  };

  const repeated = billing.buildBillingCycleStatusTransition(
    paid,
    'paid',
    ACTOR,
    '',
    '2026-10-01T18:00:00.000Z'
  );
  assert.equal(repeated.changed, false);
  assert.equal(repeated.cycle.confirmedAt, paid.confirmedAt);
  assert.equal(repeated.cycle.confirmedBy, paid.confirmedBy);
  assert.equal(repeated.cycle.updatedAt, paid.updatedAt);
  assert.equal(repeated.cycle.amountCents, 5000);
});
