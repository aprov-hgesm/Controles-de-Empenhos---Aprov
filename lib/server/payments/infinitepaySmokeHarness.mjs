/**
 * Safeguards and parsing for an explicitly authorized, isolated Pix smoke test.
 * No SaaS contracts, Firebase records or user access is changed by this file.
 */
import { createHash, randomBytes } from 'node:crypto';
import { makeOrderNsu, assessPaymentCheck } from './infinitepayCheckout.mjs';

const ORIGINS = new Set(['https://emprovex.com.br', 'https://www.emprovex.com.br']);
export const SMOKE_REDIRECT_URL = 'https://emprovex.com.br/regularizacao';
export const MIN_TEST_CENTS = 100;
export const MAX_TEST_CENTS = 2990;

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(label + ' is required');
  return value.trim();
}
function validIdentifier(value, label, regex) {
  const s = requireText(value, label);
  if (!regex.test(s)) throw new Error(label + ' has invalid characters');
  return s;
}
function urlFrom(value) {
  try { return new URL(value); } catch { return null; }
}
function allowedCheckoutHost(name) {
  return name === 'infinitepay.io' || name.endsWith('.infinitepay.io')
    || name === 'infinitepay.com.br' || name.endsWith('.infinitepay.com.br');
}

/**
 * One unique order per explicitly requested run. Random secret prevents
 * exposing the workspace id. The same order is persisted before a network call.
 */
export function prepareIsolatedPixTest({
  workspaceId, amountCents = MIN_TEST_CENTS, now = new Date(),
  secret = randomBytes(32).toString('hex'),
}) {
  const workspace = validIdentifier(workspaceId, 'test workspace', /^[a-zA-Z0-9_-]{1,120}$/);
  if (!Number.isSafeInteger(amountCents) || amountCents < MIN_TEST_CENTS || amountCents > MAX_TEST_CENTS) {
    throw new Error('Test amount must be between 100 and 2990 cents');
  }
  const timestamp = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(timestamp)) throw new Error('Invalid current time');
  const date = new Date(timestamp);
  const referenceMonth = date.toISOString().slice(0, 7);
  const validUntil = new Date(timestamp + 30 * 60_000).toISOString();
  const orderNsu = makeOrderNsu({ workspaceId: workspace, referenceMonth, orderIdSecret: secret });
  return Object.freeze({
    state: Object.freeze({
      schema: 1, mode: 'isolated_infinitepay_pix_smoke', status: 'prepared',
      orderNsu,
      workspaceFingerprint: createHash('sha256').update(workspace).digest('hex'),
      amountCents, createdAt: date.toISOString(), validUntil,
      redirectUrl: SMOKE_REDIRECT_URL,
    }),
    request: Object.freeze({
      order_nsu: orderNsu,
      redirect_url: SMOKE_REDIRECT_URL,
      items: [{
        quantity: 1, price: amountCents,
        description: 'EMPROVEX - teste tecnico de pagamento, sem assinatura',
      }],
      options: {
        single_payment: true,
        require_delivery_address: false,
        valid_until: validUntil,
        payment_methods_enabled: ['pix'],
      },
      // No webhook: test never calls a production endpoint.
    }),
  });
}

/** Only accept a provider-created HTTPS link on InfinitePay's own domain. */
export function readCheckoutUrl(response) {
  const value = response?.url ?? response?.checkout_url ?? response?.payment_url
    ?? response?.link ?? response?.data?.url ?? response?.data?.checkout_url;
  const url = typeof value === 'string' ? urlFrom(value) : null;
  if (!url || url.protocol !== 'https:' || !allowedCheckoutHost(url.hostname)
      || url.username || url.password) {
    throw new Error('Provider did not return a verified InfinitePay checkout URL');
  }
  return url.toString();
}

/**
 * Redirect is untrusted input; correlate it with locally saved original state.
 * Never regard its receipt_url or capture_method as proof of settlement.
 */
export function makePixCheckFromReturn({ returnUrl, state, handle, now = new Date() }) {
  if (!state || state.mode !== 'isolated_infinitepay_pix_smoke'
      || !/^epx-[0-9]{6}-[a-f0-9]{24}$/.test(state.orderNsu)) {
    throw new Error('Invalid local test record');
  }
  const url = typeof returnUrl === 'string' && returnUrl.length <= 5000 ? urlFrom(returnUrl) : null;
  if (url && allowedCheckoutHost(url.hostname) && url.protocol === 'https:') {
    throw new Error('Este e o link inicial do checkout. Nao pague novamente. Na tela de pagamento concluido, clique em Continuar e copie a URL de retorno ao EMPROVEX.');
  }
  if (!url || !ORIGINS.has(url.origin) || url.pathname !== '/regularizacao') {
    throw new Error('URL de retorno invalida. Use a URL completa apos clicar em Continuar na InfinitePay; nao use link inicial nem comprovante.');
  }
  const orderNsu = url.searchParams.get('order_nsu');
  const transactionNsu = url.searchParams.get('transaction_nsu');
  const slug = url.searchParams.get('slug');
  if (orderNsu !== state.orderNsu) throw new Error('Return order does not match local test');
  validIdentifier(transactionNsu, 'transaction_nsu', /^[a-zA-Z0-9_.:-]{1,200}$/);
  validIdentifier(slug, 'slug', /^[a-zA-Z0-9_.:-]{1,200}$/);
  const safeHandle = validIdentifier(handle, 'InfiniteTag', /^[a-zA-Z0-9_.-]{1,100}$/);
  const timestamp = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(timestamp)) throw new Error('Invalid current time');
  const created = Date.parse(state.createdAt);
  if (!Number.isFinite(created) || created > timestamp + 300_000) {
    throw new Error('Invalid stored creation time');
  }
  // A real provider check is needed even if returned after checkout expiration.
  // No implicit claim of payment from the browser URL.
  return Object.freeze({
    checkRequest: {
      handle: safeHandle, order_nsu: orderNsu,
      transaction_nsu: transactionNsu, slug,
    },
    transactionFingerprint: createHash('sha256').update(transactionNsu).digest('hex'),
    amountCents: state.amountCents,
  });
}

export function assessIsolatedPixResult({ amountCents, paymentCheck }) {
  const result = assessPaymentCheck({ amountCents, paymentCheck });
  if (!result.verified) return result;
  if (paymentCheck.capture_method !== 'pix') {
    return { verified: false, reason: 'NOT_PIX' };
  }
  return { verified: true, reason: 'PIX_CONFIRMED_WITH_PROVIDER' };
}
