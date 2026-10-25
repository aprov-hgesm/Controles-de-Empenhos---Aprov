import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { inspectInfinitePayReturn } from '../lib/billing/infinitepayReturnStatus.mjs';

const panel = fs.readFileSync('components/billing/InfinitePayReadinessPanel.tsx', 'utf8');
const page = fs.readFileSync('app/regularizacao/page.tsx', 'utf8');
const header = fs.readFileSync('components/layout/AppHeader.tsx', 'utf8');

test('visual return alone is never a confirmation of payment', () => {
  const result = inspectInfinitePayReturn(
    'https://emprovex.com.br/regularizacao?order_nsu=epx-id&transaction_nsu=private&slug=secret'
  );
  assert.deepEqual(result, {
    isReturn: true, cleanedPath: '/regularizacao', verified: false,
  });
});

test('even paid=true from browser cannot mark an EMPROVEX invoice paid', () => {
  const result = inspectInfinitePayReturn(
    'https://emprovex.com.br/regularizacao?paid=true&transaction_nsu=123'
  );
  assert.equal(result.verified, false);
  assert.equal(result.isReturn, true);
});

test('initial checkout URL is not accepted as a site payment return', () => {
  const result = inspectInfinitePayReturn(
    'https://checkout.infinitepay.io/example/checkout?order_nsu=epx-id'
  );
  assert.equal(result.isReturn, false);
  assert.equal(result.verified, false);
});

test('regularization page without provider params does not claim payment', () => {
  const result = inspectInfinitePayReturn(
    'https://emprovex.com.br/regularizacao?utm_source=search'
  );
  assert.equal(result.isReturn, false);
});

test('query identifiers are stripped without reproducing sensitive values', () => {
  const result = inspectInfinitePayReturn(
    'https://emprovex.com.br/regularizacao?receipt_url=https://private.example/secret&slug=private#footer'
  );
  assert.equal(result.cleanedPath, '/regularizacao#footer');
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('login-derived account view has a single source of truth', () => {
  assert.match(panel, /onAuthStateChanged\(auth/);
  assert.match(panel, /getResolvedWorkspaceContextForSession\(user\.uid, user\.email\)/);
  assert.match(panel, /useWorkspaceBillingAccount\(context\)/);
  assert.doesNotMatch(panel, /NEXT_PUBLIC_INFINITEPAY_API_KEY|INFINITEPAY_API_KEY|process\.env\.INFINITEPAY/);
});

test('InfinitePay checkout is visibly disabled until backend homologation', () => {
  assert.match(panel, /data-testid="infinitepay-checkout-disabled"/);
  assert.match(panel, /disabled\s+aria-disabled="true"/);
  assert.doesNotMatch(panel, /callInfinitePay\(|\/api\/payments\/.*create|fetch\([^)]*infinitepay\.io/);
});

test('payment return is displayed as unverified and URL sanitized', () => {
  assert.match(panel, /setReturnNotice\(true\)/);
  assert.match(panel, /window\.history\.replaceState/);
  assert.match(panel, /A verificação autenticada da InfinitePay/);
  assert.doesNotMatch(panel, /setAccount\(.*paid/);
});

test('trial pricing is shown as planned, not contracted or live', () => {
  for (const amount of [2990, 3990, 4990, 5990, 6990]) {
    assert.match(panel, new RegExp('cents: ' + amount));
  }
  assert.match(panel, /Não é uma oferta ativa/);
  assert.match(panel, /Isenção preservada/);
});

test('regularization screen remains operational with manual fallback', () => {
  assert.match(page, /<InfinitePayReadinessPanel\s*\/>/);
  assert.match(page, /Abrir Link de Pagamento/);
  assert.match(page, /Copiar chave Pix/);
  assert.match(page, /Preço de referência legado/);
});

test('account tab is accessible from the authenticated application header', () => {
  assert.match(header, /data-testid="billing-account-open"/);
  assert.match(header, /router\.push\('\/regularizacao'\)/);
  assert.match(header, /workspaceContext\.status === 'sector'/);
});
