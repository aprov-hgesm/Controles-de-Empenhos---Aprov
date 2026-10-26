/**
 * Explicitly opt-in, customer-authenticated R$1 InfinitePay PILOT.
 * Deliberately cannot pay a SaaS billingCycle, grant access or mutate Firestore.
 * Never runs in production without a server-side allowlist and secret flags.
 */
import { timingSafeEqual } from 'node:crypto';
import { makeOrderNsu, assessPaymentCheck } from './infinitepayCheckout.mjs';
import { readCheckoutUrl } from './infinitepaySmokeHarness.mjs';

export const PILOT_CENTS = 100;
export const PILOT_REDIRECT = 'https://emprovex.com.br/regularizacao';

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a); const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function pilotEnabledFor({ email, workspaceId, env }) {
  return env.INFINITEPAY_PILOT_ENABLED === '1'
    && env.INFINITEPAY_PILOT_EMAIL
    && env.INFINITEPAY_PILOT_WORKSPACE
    && constantTimeEqual(email, env.INFINITEPAY_PILOT_EMAIL.trim().toLowerCase())
    && constantTimeEqual(workspaceId, env.INFINITEPAY_PILOT_WORKSPACE.trim())
    && (env.INFINITEPAY_API_KEY || '').length >= 16
    && (env.INFINITEPAY_HANDLE || '').length >= 2
    && (env.INFINITEPAY_ORDER_SECRET || '').length >= 32;
}

export function pilotOrderForDate({ uid, workspaceId, env, now = new Date() }) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid pilot date');
  const day = date.toISOString().slice(0, 10);
  return makeOrderNsu({
    workspaceId: 'pilot:' + uid + ':' + workspaceId + ':' + day,
    referenceMonth: day.slice(0, 7),
    orderIdSecret: env.INFINITEPAY_ORDER_SECRET,
  });
}

export function pilotReturnBelongsToSession({ orderNsu, uid, workspaceId, env, now = new Date() }) {
  if (typeof orderNsu !== 'string' || !/^epx-[0-9]{6}-[a-f0-9]{24}$/.test(orderNsu)) return false;
  // Checkout returns may arrive after local midnight / next day.
  for (let daysBack = 0; daysBack <= 31; daysBack += 1) {
    const date = new Date(new Date(now).getTime() - daysBack * 86400000);
    if (constantTimeEqual(pilotOrderForDate({ uid, workspaceId, env, now: date }), orderNsu)) return true;
  }
  return false;
}

export function pilotCheckoutRequest({ orderNsu, now = new Date() }) {
  return {
    order_nsu: orderNsu,
    redirect_url: PILOT_REDIRECT,
    items: [{ quantity: 1, price: PILOT_CENTS, description: 'EMPROVEX - teste tecnico de Pix, sem assinatura' }],
    options: {
      single_payment: true,
      require_delivery_address: false,
      valid_until: new Date(new Date(now).getTime() + 30 * 60000).toISOString(),
      payment_methods_enabled: ['pix'],
    },
  };
}

export function verifyPilotResponse({ paymentCheck }) {
  const result = assessPaymentCheck({ amountCents: PILOT_CENTS, paymentCheck });
  if (!result.verified) return result;
  return paymentCheck.capture_method === 'pix'
    ? { verified: true, code: 'PILOT_PIX_AUTHENTICATED', affectsBilling: false }
    : { verified: false, code: 'PILOT_METHOD_MISMATCH', affectsBilling: false };
}

export { readCheckoutUrl };
