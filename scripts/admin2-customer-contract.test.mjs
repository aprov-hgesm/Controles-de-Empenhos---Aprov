import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(
  join(process.cwd(), 'lib/admin2/customers/customerWorkspaceContract.ts'),
  'utf8'
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exports = {};
runInNewContext(compiled, { exports, Date, Intl }, { filename: 'customerWorkspaceContract.js' });

const {
  ADMIN2_CUSTOMER_PAGE_SIZE,
  buildCustomerWorkspaceRecord,
  buildCustomerBillingSnapshot,
  customerBillingLabel,
  formatCustomerCurrency,
  formatCustomerDate,
} = exports;

const demoWorkspace = {
  id: 'sector-a',
  name: 'Aprovisionamento A',
  ug: '123456',
  authorizedEmail: 'sector-a@example.invalid',
  status: 'active',
  institutionalProfile: {
    organizationName: 'Unidade Teste',
    organizationShortName: 'UT',
    sectionName: 'Aprovisionamento',
  },
  updatedAt: '2026-10-18T12:00:00.000Z',
};

test('Cliente V0 é projeção do workspace existente sem criar cliente comercial', () => {
  const record = buildCustomerWorkspaceRecord('sector-a', demoWorkspace);
  assert.equal(record.workspaceId, 'sector-a');
  assert.equal(record.customerKey, 'workspace:sector-a');
  assert.equal(record.name, 'Aprovisionamento A');
  assert.equal(record.ug, '123456');
  assert.equal(record.organizationName, 'Unidade Teste');
  assert.equal(record.authorizedEmail, 'sector-a@example.invalid');
  assert.equal(record.workspaceStatus, 'active');
  assert.equal(record.legacyWorkspace, false);
  assert.equal(ADMIN2_CUSTOMER_PAGE_SIZE, 10);
});

test('campos legados ausentes não quebram a ficha nem inventam UG', () => {
  const record = buildCustomerWorkspaceRecord('legacy-one', {
    name: '',
    ug: '001',
    status: 'disabled',
  });
  assert.equal(record.workspaceId, 'legacy-one');
  assert.equal(record.name, 'legacy-one');
  assert.equal(record.ug, null);
  assert.equal(record.organizationName, '');
  assert.equal(record.workspaceStatus, 'disabled');
});

test('proíbe associar assinatura de outro workspace', () => {
  const misbound = buildCustomerBillingSnapshot('sector-a', {
    workspaceId: 'sector-b',
    status: 'active',
    monthlyPriceCents: 7000,
  });
  assert.equal(misbound, null);
  assert.equal(customerBillingLabel(misbound), 'Não configurada');
});

test('VIP e trial possuem classificação comercial correta', () => {
  const vip = buildCustomerBillingSnapshot('sector-a', {
    workspaceId: 'sector-a',
    status: 'exempt',
    monthlyPriceCents: 0,
    paymentRequired: false,
    exemptionSource: 'legacy_vip',
  });
  assert.equal(vip?.exemptionSource, 'legacy_vip');
  assert.equal(customerBillingLabel(vip), 'Isenta / VIP');

  const trial = buildCustomerBillingSnapshot('sector-a', {
    workspaceId: 'sector-a',
    status: 'trial',
    monthlyPriceCents: 7000,
    paymentRequired: false,
    trialEndsAt: '2026-11-18T00:00:00.000Z',
  });
  assert.equal(trial?.status, 'trial');
  assert.equal(customerBillingLabel(trial), 'Período de teste');
  assert.match(formatCustomerCurrency(7000), /^R\$\s*70,00$/);
  assert.notEqual(formatCustomerDate(trial?.trialEndsAt ?? null), 'Não informado');
});
