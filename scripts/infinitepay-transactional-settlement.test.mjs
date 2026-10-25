import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareWorkspaceCheckout, prepareVerification } from '../lib/server/payments/infinitepayBillingBridge.mjs';
import {
  transactionLedgerId,
  commitVerifiedSettlementWithStore,
} from '../lib/server/payments/infinitepayTransactionalSettlement.mjs';

const NOW = '2026-10-25T15:00:00.000Z';
const ACCOUNT = { workspaceId: 'mock-workspace', status: 'active', monthlyPriceCents: 7000 };
const CYCLE = {
  id: 'mock-workspace__2026-11', workspaceId: 'mock-workspace',
  referenceMonth: '2026-11', amountCents: 7000, status: 'pending',
  dueDate: '2026-11-09',
};
const CONFIG = { billingMode: 'observe', requirePayment: false, automaticSuspension: false, monthlyPriceCents: 7000 };
const PAYMENT_CHECK = { success: true, paid: true, amount: 7000, paid_amount: 7000, capture_method: 'pix' };
const createInputs = () => {
  const prep = prepareWorkspaceCheckout({
    authorized: true, account: ACCOUNT, cycle: CYCLE, config: CONFIG,
    orderIdSecret: 'test-only-synthetic-order-secret-123456789012',
    redirectUrl: 'https://emprovex.com.br/regularizacao',
    webhookUrl: 'https://emprovex.com.br/api/payments/infinitepay/webhook',
    now: NOW, validUntil: '2026-11-15T23:00:00Z',
  });
  assert.equal(prep.allowed, true);
  const notification = {
    event: 'paid', order_nsu: prep.intent.orderNsu,
    transaction_nsu: 'synthetic-tx1', invoice_slug: 'synthetic-invoice-1',
  };
  const verification = prepareVerification({
    intent: prep.intent, notification, handle: 'test-handle',
  });
  assert.equal(verification.allowed, true);
  return { intent: prep.intent, verification, authenticatedPaymentCheck: PAYMENT_CHECK, now: NOW };
};

/**
 * All state is process-local synthetic data. Transactions are serialized and
 * mutations are committed atomically when the test callback returns.
 */
function mockStore() {
  const state = {
    accounts: new Map([[ACCOUNT.workspaceId, { ...ACCOUNT }]]),
    cycles: new Map([[CYCLE.id, { ...CYCLE }]]),
    payments: new Map(),
  };
  let queue = Promise.resolve();
  let faultBeforeCommit = false;
  return {
    state,
    failNextCommit() { faultBeforeCommit = true; },
    async runTransaction(callback) {
      const previous = queue;
      let release;
      queue = new Promise((resolve) => { release = resolve; });
      await previous;
      try {
        const stagedCycles = new Map(state.cycles);
        const stagedPayments = new Map(state.payments);
        const tx = {
          async readAccount(id) { return state.accounts.get(id); },
          async readCycle(id) { return stagedCycles.get(id); },
          async readPayment(id) { return stagedPayments.get(id); },
          async writeCycle(id, next) { stagedCycles.set(id, next); },
          async createPayment(id, record) {
            if (stagedPayments.has(id)) throw new Error('Duplicate ledger document.');
            stagedPayments.set(id, record);
          },
        };
        const result = await callback(tx);
        if (faultBeforeCommit) {
          faultBeforeCommit = false;
          throw new Error('Simulated atomic commit outage.');
        }
        state.cycles = stagedCycles;
        state.payments = stagedPayments;
        return result;
      } finally {
        release();
      }
    },
  };
}

test('ledger document ID hides provider raw transaction and remains stable', () => {
  const id = transactionLedgerId('synthetic-tx1');
  assert.match(id, /^infinitepay_[a-f0-9]{64}$/);
  assert.equal(id, transactionLedgerId('synthetic-tx1'));
  assert.notEqual(id, transactionLedgerId('synthetic-tx2'));
  assert.equal(id.includes('synthetic-tx1'), false);
});

test('offline transaction atomically saves paid cycle and unique provider ledger', async () => {
  const store = mockStore();
  const result = await commitVerifiedSettlementWithStore({ store, ...createInputs() });
  assert.deepEqual({ allowed: result.allowed, action: result.action, mutate: result.mutate },
    { allowed: true, action: 'MARK_PAID', mutate: true });
  assert.equal(store.state.cycles.get(CYCLE.id).status, 'paid');
  assert.equal(store.state.payments.size, 1);
  assert.equal(store.state.payments.get(result.ledgerId).amountCents, 7000);
});

test('two simultaneous notifications create one ledger record only', async () => {
  const store = mockStore();
  const input = createInputs();
  const [first, second] = await Promise.all([
    commitVerifiedSettlementWithStore({ store, ...input }),
    commitVerifiedSettlementWithStore({ store, ...input }),
  ]);
  assert.deepEqual([first.action, second.action], ['MARK_PAID', 'DUPLICATE']);
  assert.equal(store.state.cycles.get(CYCLE.id).status, 'paid');
  assert.equal(store.state.payments.size, 1);
});

test('simulated atomic failure leaves cycle pending and ledger absent', async () => {
  const store = mockStore();
  store.failNextCommit();
  await assert.rejects(
    commitVerifiedSettlementWithStore({ store, ...createInputs() }),
    /Simulated atomic commit outage/
  );
  assert.equal(store.state.cycles.get(CYCLE.id).status, 'pending');
  assert.equal(store.state.payments.size, 0);
  const recovered = await commitVerifiedSettlementWithStore({ store, ...createInputs() });
  assert.equal(recovered.action, 'MARK_PAID');
  assert.equal(store.state.payments.size, 1);
});

test('underpayment cannot write to either collection', async () => {
  const store = mockStore();
  const result = await commitVerifiedSettlementWithStore({
    store, ...createInputs(),
    authenticatedPaymentCheck: { ...PAYMENT_CHECK, paid_amount: 5000 },
  });
  assert.equal(result.allowed, false);
  assert.equal(store.state.payments.size, 0);
  assert.equal(store.state.cycles.get(CYCLE.id).status, 'pending');
});

test('one provider transaction cannot be applied to another workspace', async () => {
  const store = mockStore();
  const input = createInputs();
  const first = await commitVerifiedSettlementWithStore({ store, ...input });
  assert.equal(first.action, 'MARK_PAID');
  const foreignIntent = {
    ...input.intent, workspaceId: 'foreign-workspace', cycleId: 'foreign-workspace__2026-11',
    orderNsu: 'epx-202611-' + 'b'.repeat(24),
  };
  const foreignVerification = {
    ...input.verification,
    checkRequest: { ...input.verification.checkRequest, order_nsu: foreignIntent.orderNsu },
  };
  store.state.accounts.set('foreign-workspace', {
    workspaceId: 'foreign-workspace', status: 'active', monthlyPriceCents: 7000,
  });
  store.state.cycles.set(foreignIntent.cycleId, {
    ...CYCLE, id: foreignIntent.cycleId, workspaceId: 'foreign-workspace',
  });
  const second = await commitVerifiedSettlementWithStore({
    store, ...input, intent: foreignIntent, verification: foreignVerification,
  });
  assert.equal(second.code, 'TRANSACTION_REUSE_CONFLICT');
  assert.equal(store.state.cycles.get(foreignIntent.cycleId).status, 'pending');
});

test('VIP state after checkout preparation prevents settlement', async () => {
  const store = mockStore();
  store.state.accounts.set(ACCOUNT.workspaceId, {
    ...ACCOUNT, status: 'exempt', exemptionSource: 'legacy_vip',
  });
  const result = await commitVerifiedSettlementWithStore({ store, ...createInputs() });
  assert.equal(result.code, 'EXEMPT');
  assert.equal(store.state.cycles.get(CYCLE.id).status, 'pending');
  assert.equal(store.state.payments.size, 0);
});

test('inconsistent paid cycle without ledger is flagged rather than overwritten', async () => {
  const store = mockStore();
  store.state.cycles.set(CYCLE.id, { ...CYCLE, status: 'paid' });
  const result = await commitVerifiedSettlementWithStore({ store, ...createInputs() });
  assert.equal(result.code, 'CYCLE_PAID_WITHOUT_TRANSACTION_RECORD');
  assert.equal(store.state.payments.size, 0);
});

test('cannot commit payment without an atomic store or linked verification', async () => {
  const input = createInputs();
  await assert.rejects(commitVerifiedSettlementWithStore({ ...input }), /Atomic transaction port/);
  const result = await commitVerifiedSettlementWithStore({
    store: mockStore(), ...input,
    verification: { ...input.verification, checkRequest: {
      ...input.verification.checkRequest, transaction_nsu: 'altered-transaction',
    } },
  });
  assert.equal(result.code, 'UNLINKED_SETTLEMENT');
});
