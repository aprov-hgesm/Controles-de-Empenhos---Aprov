import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const root = process.cwd();
const source = readFileSync(join(root, 'lib/admin2/customers/customer360Contract.ts'), 'utf8');
const read = readFileSync(join(root, 'lib/admin2/customers/customer360Read.ts'), 'utf8');
const detail = readFileSync(join(root, 'components/admin2/customers/AdminCustomerDetailV2.tsx'), 'utf8');
const exports = {};
const transpiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
runInNewContext(transpiled, { exports, Date, Intl, Set, Array }, { filename: 'customer360Contract.js' });

const { mapCustomerBillingCycle, toCustomerAuditRecord, planCommercialCustomerLink, auditOperationLabel,
  billingCycleStatusLabel, ADMIN2_CYCLE_PAGE_SIZE, ADMIN2_AUDIT_SAMPLE_LIMIT } = exports;

const base = {
  workspaceId: 'sector-a',
  referenceMonth: '2026-10',
  status: 'paid',
  amountCents: 7000,
  dueDate: '2026-10-07',
  confirmedAt: '2026-10-08T12:00:00.000Z',
  confirmedBy: 'admin@example.invalid',
};

test('competências canônicas válidas são transformadas em registros read-only', () => {
  const row = mapCustomerBillingCycle('sector-a', 'sector-a__2026-10', base);
  assert.equal(row?.workspaceId, 'sector-a');
  assert.equal(row?.referenceMonth, '2026-10');
  assert.equal(row?.amountCents, 7000);
  assert.equal(row?.status, 'paid');
  assert.equal(billingCycleStatusLabel('waived'), 'Dispensada');
});

test('bloqueia ciclos de outro workspace ou IDs inconsistentes', () => {
  assert.equal(mapCustomerBillingCycle('sector-a', 'sector-b__2026-10', { ...base, workspaceId: 'sector-b' }), null);
  assert.equal(mapCustomerBillingCycle('sector-a', 'sector-a__2026-10', { ...base, workspaceId: 'sector-b' }), null);
  assert.equal(mapCustomerBillingCycle('sector-a', 'sector-a__2026-09', base), null);
  assert.equal(mapCustomerBillingCycle('sector-a', 'sector-a__2026-13', { ...base, referenceMonth: '2026-13' }), null);
});

test('eventos de auditoria ficam vinculados ao workspace e não expõem before/after', () => {
  assert.equal(toCustomerAuditRecord('sector-a', 'event-1', { workspaceId: 'sector-b' }), null);
  const event = toCustomerAuditRecord('sector-a', 'event-1', {
    workspaceId: 'sector-a',
    operation: 'billing.payment_confirm',
    entityType: 'billing_cycle',
    actorEmail: 'admin@example.invalid',
    createdAt: '2026-10-18T12:00:00.000Z',
    before: { secret: 'not-for-client-360' },
    after: { secret: 'not-for-client-360' },
  });
  assert.equal(event?.workspaceId, 'sector-a');
  assert.equal(event?.operation, 'billing.payment_confirm');
  assert.equal(event?.occurredAt, '2026-10-18T12:00:00.000Z');
  assert.equal(Object.hasOwn(event, 'before'), false);
  assert.equal(Object.hasOwn(event, 'after'), false);
  assert.equal(auditOperationLabel('sector.create'), 'Cadastro de setor');
});

test('contrato de cliente comercial 1:N apenas prepara vínculos, sem persistir', () => {
  const rows = planCommercialCustomerLink('customer-1', ['sector-a', 'sector-a', 'sector-b']);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].customerId, 'customer-1');
  assert.equal(rows[1].workspaceId, 'sector-b');
});

test('consultas V2 são paginadas, filtradas, lazy e sem writes', () => {
  assert.equal(ADMIN2_CYCLE_PAGE_SIZE, 6);
  assert.equal(ADMIN2_AUDIT_SAMPLE_LIMIT, 12);
  assert.match(read, /limit\(ADMIN2_CYCLE_PAGE_SIZE \+ 1\)/);
  assert.match(read, /where\('workspaceId', '==', workspaceId\)/);
  assert.match(read, /limit\(ADMIN2_AUDIT_SAMPLE_LIMIT\)/);
  assert.doesNotMatch(read + detail, /\b(?:onSnapshot|setDoc|updateDoc|deleteDoc|runTransaction|writeBatch)\s*\(/);
  assert.match(detail, /visited\.finance &&/);
  assert.match(detail, /visited\.activity &&/);
});
