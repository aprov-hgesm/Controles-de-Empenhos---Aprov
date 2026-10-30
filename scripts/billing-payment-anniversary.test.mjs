import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { quoteIndividualRamp } from '../lib/server/payments/emprovexRampPricing.mjs';
import { createSharedPayment, applySharedPayment } from '../lib/server/payments/sharedBilling.mjs';

function loadTs(file, dependencies = {}) {
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('exports','require',compiled)(exports, name => {
    if (Object.hasOwn(dependencies,name)) return dependencies[name];
    throw Error('Unexpected dependency ' + name);
  });
  return exports;
}
const billing = loadTs('lib/billing.ts');
const access = loadTs('lib/billingAccess.ts', { './billing': billing });
const ws = { id:'aprov-fake', ug:'160416', authorizedEmail:'mock@example.com' };
const now = '2026-10-01T15:00:00.000Z';

function account(nowValue=now, trial=false) {
  return billing.buildInitialBillingAccount(ws, 'admin@example.com', trial, 30, nowValue, true);
}
function cycle(accountValue, ref, status='paid') {
  return { id: billing.billingCycleId(accountValue.workspaceId,ref),
    workspaceId: accountValue.workspaceId, referenceMonth:ref, status, amountCents:2990 };
}

test('novas contas começam com aniversário pendente, contratos antigos não são migrados', () => {
  const fresh=account();
  assert.equal(fresh.billingPeriodPolicy,billing.PAYMENT_ANNIVERSARY_POLICY);
  assert.equal(fresh.firstPaymentConfirmedAt,undefined);
  assert.equal(billing.billingFirstPaymentPending(fresh),true);
  const historical={...fresh,billingPeriodPolicy:undefined};
  assert.equal(billing.billingFirstPaymentPending(historical),false);
  assert.deepEqual(billing.settleFirstPaymentAnniversary(historical,'2026-10','2026-10-05T12:00:00Z'),historical);
  assert.equal(billing.renewalGraceDaysForAccount(fresh,0),10);
  assert.equal(billing.renewalGraceDaysForAccount(historical,7),7);
});
test('primeiro pagamento em 5/10 abre o mês até 5/11 sem reduzir a 30 dias', () => {
  const original=account();
  const activated=billing.settleFirstPaymentAnniversary(original,'2026-10','2026-10-05T15:00:00.000Z');
  const period=billing.paidServicePeriod(activated,new Date('2026-10-10T12:00:00.000Z'));
  assert.equal(period.periodNumber,1);
  assert.equal(period.startsAt,'2026-10-05T15:00:00.000Z');
  assert.equal(period.endsAt,'2026-11-05T15:00:00.000Z');
  assert.equal(billing.billingCycleReferenceForPeriod(activated,period),'2026-10');
  assert.equal(access.decideBillingAccess(activated,cycle(activated,'2026-10'),
    new Date('2026-10-20T12:00:00Z'),null,10).reason,'paid');
  assert.equal(billing.settleFirstPaymentAnniversary(activated,'2026-11','2026-11-08T15:00:00Z'),activated,
    'renewal cannot change anchor');
});
test('renovação 5/11 possui 10 dias de tolerância; pagamento em 12/11 mantém próximo aniversário em 5/12', () => {
  const active=billing.settleFirstPaymentAnniversary(account(),'2026-10','2026-10-05T15:00:00Z');
  const prior=cycle(active,'2026-10');
  const inGrace=access.decideBillingAccess(active,null,new Date('2026-11-12T15:00:00Z'),prior,10);
  assert.equal(inGrace.allowed,true);
  assert.equal(inGrace.reason,'due_grace');
  assert.equal(access.decideBillingAccess(active,null,new Date('2026-11-15T15:00:00Z'),prior,10).allowed,false);
  const renewal=cycle(active,'2026-11');
  assert.equal(access.decideBillingAccess(active,renewal,new Date('2026-11-12T16:00:00Z'),prior,10).reason,'paid');
  assert.equal(billing.paidServicePeriod(active,new Date('2026-11-12T16:00:00Z')).endsAt,
    '2026-12-05T15:00:00.000Z');
});
test('primeiro pagamento atrasado atravessa mês sem perder acesso nem trocar pedido antigo', () => {
  const original=account('2026-10-28T15:00:00.000Z');
  assert.equal(billing.billingRampStartMonth(original,'2026-11'),'2026-11',
    'first billing remains month one even after delayed trial/invoice');
  assert.equal(quoteIndividualRamp({firstPaidReferenceMonth:billing.billingRampStartMonth(original,'2026-11'),
    referenceMonth:'2026-11'}).amountCents,2990);
  const after=billing.settleFirstPaymentAnniversary(original,'2026-10','2026-11-03T15:00:00Z');
  assert.equal(after.firstPaidReferenceMonth,'2026-11');
  assert.equal(after.firstPaymentCycleReferenceMonth,'2026-10');
  const period=billing.paidServicePeriod(after,new Date('2026-11-04T16:00:00Z'));
  assert.equal(period.endsAt,'2026-12-03T15:00:00.000Z');
  assert.equal(billing.billingCycleReferenceForPeriod(after,period),'2026-10');
  assert.equal(access.decideBillingAccess(after,cycle(after,'2026-10'),
    new Date('2026-11-04T16:00:00Z'),null,10).reason,'paid');
  const next=billing.paidServicePeriod(after,new Date('2026-12-04T16:00:00Z'));
  assert.equal(next.referenceMonth,'2026-12');
  assert.equal(billing.billingCycleReferenceForPeriod(after,next),'2026-12');
  assert.equal(access.decideBillingAccess(after,null,new Date('2026-12-04T16:00:00Z'),
    cycle(after,'2026-10'),10).reason,'due_grace');
});
test('mês de fevereiro usa dia equivalente/último dia, não blocos fixos de 30 dias', () => {
  const activated=billing.settleFirstPaymentAnniversary(account('2027-01-29T11:00:00Z'),'2027-01','2027-01-31T15:00:00Z');
  assert.equal(billing.paidServicePeriod(activated,new Date('2027-02-15T15:00:00Z')).endsAt,
    '2027-02-28T15:00:00.000Z');
  assert.equal(billing.paidServicePeriod(activated,new Date('2027-03-15T15:00:00Z')).startsAt,
    '2027-02-28T15:00:00.000Z');
  assert.equal(billing.paidServicePeriod(activated,new Date('2027-03-15T15:00:00Z')).endsAt,
    '2027-03-31T15:00:00.000Z');
});
test('primeira mensalidade compartilhada só começa quando a última cota é verificada', () => {
  const base=account();
  let payment=createSharedPayment({amountCents:2990,participantNames:['1º Ten','3º Sgt','Cb Aires'],
    acceptedAt:'2026-10-29T12:00:00Z'});
  payment=applySharedPayment(payment,1,'ledger-1','2026-10-29T12:05:00Z');
  payment=applySharedPayment(payment,2,'ledger-2','2026-10-29T12:15:00Z');
  assert.equal(payment.fullyPaid,false);
  assert.equal(billing.billingFirstPaymentPending(base),true);
  payment=applySharedPayment(payment,3,'ledger-3','2026-10-29T12:22:00Z');
  assert.equal(payment.fullyPaid,true);
  const activated=billing.settleFirstPaymentAnniversary(base,'2026-10','2026-10-29T12:22:00Z');
  assert.equal(activated.firstPaidAt,'2026-10-29T12:22:00Z');
  assert.equal(billing.paidServicePeriod(activated,new Date('2026-10-30T12:22:00Z')).endsAt,
    '2026-11-29T12:22:00.000Z');
});
test('renovação de contrato antigo mantém dia útil registrado ao emitir ciclo', () => {
  const oldAccount=billing.buildInitialBillingAccount(ws,'admin',false,30,'2026-10-01T15:00:00Z');
  const reference=billing.buildBillingCycle(oldAccount,'2026-11',
    billing.buildPlatformBillingConfig('admin'),'admin');
  assert.equal(reference.dueDate,billing.getFifthBusinessDay(2026,11));
});
