/**
 * Transactional port for a FUTURE persistence adapter.
 *
 * There is deliberately no Firebase import or network in this module.
 * runTransaction() MUST be backed by a real atomic transaction in production;
 * a mock used in tests does not prove production Firestore atomicity.
 *
 * Any paymentCheck response passed here MUST have been fetched server-side from
 * the official InfinitePay payment_check endpoint with the secret API key.
 */
import { createHash } from 'node:crypto';
import { planVerifiedSettlement } from './infinitepayBillingBridge.mjs';

function safe(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 200;
}

export function transactionLedgerId(transactionNsu) {
  if (!safe(transactionNsu)) throw new Error('Invalid transaction NSU.');
  // A provider transaction ID must be globally unique across all workspaces.
  return 'infinitepay_' + createHash('sha256').update(transactionNsu).digest('hex');
}

/**
 * Expected transaction port methods:
 *  - readAccount(workspaceId)
 *  - readCycle(cycleId)
 *  - readPayment(ledgerId)
 *  - writeCycle(cycleId, completeCycle)
 *  - createPayment(ledgerId, auditRecord) [must FAIL on existing ID]
 *
 * No external I/O should take place INSIDE a Firestore transaction callback
 * (its retry semantics may re-run this callback).
 */
export async function commitVerifiedSettlementWithStore({
  store, intent, verification, authenticatedPaymentCheck, now,
}) {
  if (!store || typeof store.runTransaction !== 'function') {
    throw new Error('Atomic transaction port is required.');
  }
  if (!intent || intent.provider !== 'infinitepay'
      || !verification || verification.allowed !== true
      || verification.checkRequest?.order_nsu !== intent.orderNsu
      || verification.checkRequest?.transaction_nsu !== verification.transactionNsu) {
    return { allowed: false, code: 'UNLINKED_SETTLEMENT' };
  }
  const ledgerId = transactionLedgerId(verification.transactionNsu);
  return store.runTransaction(async (tx) => {
    const [account, cycle, previous] = await Promise.all([
      tx.readAccount(intent.workspaceId),
      tx.readCycle(intent.cycleId),
      tx.readPayment(ledgerId),
    ]);
    if (previous) {
      if (previous.provider !== 'infinitepay'
          || previous.orderNsu !== intent.orderNsu
          || previous.workspaceId !== intent.workspaceId
          || previous.cycleId !== intent.cycleId) {
        return { allowed: false, code: 'TRANSACTION_REUSE_CONFLICT' };
      }
      if (cycle?.status === 'paid' && account?.status !== 'exempt') {
        return { allowed: true, action: 'DUPLICATE', mutate: false };
      }
      return { allowed: false, code: 'LEDGER_CYCLE_INCONSISTENCY' };
    }
    if (cycle?.status === 'paid') {
      return { allowed: false, code: 'CYCLE_PAID_WITHOUT_TRANSACTION_RECORD' };
    }
    const decision = planVerifiedSettlement({
      intent, verification, paymentCheck: authenticatedPaymentCheck, account, cycle, now,
    });
    if (!decision.allowed || !decision.mutate) return decision;
    // The port is responsible for all-or-nothing commit and transaction retries.
    await tx.writeCycle(intent.cycleId, decision.nextCycle);
    await tx.createPayment(ledgerId, { ...decision.audit, ledgerId });
    return { allowed: true, action: 'MARK_PAID', mutate: true, ledgerId };
  });
}
