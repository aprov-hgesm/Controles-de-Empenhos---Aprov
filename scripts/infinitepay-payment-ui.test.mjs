import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { inspectInfinitePayReturn } from '../lib/billing/infinitepayReturnStatus.mjs';

const panel = fs.readFileSync('components/billing/InfinitePayReadinessPanel.tsx', 'utf8');
const page = fs.readFileSync('app/regularizacao/page.tsx', 'utf8');
const header = fs.readFileSync('components/layout/AppHeader.tsx', 'utf8');
const shell = fs.readFileSync('components/billing/BillingPortalShell.tsx', 'utf8');
const pilot = fs.readFileSync('components/billing/InfinitePayPilotPanel.tsx', 'utf8');
const tabs = fs.readFileSync('lib/billing/billingPortalTabs.ts', 'utf8');


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

test('login-derived account view safely rehydrates after hard reload or HMR', () => {
  assert.match(panel, /onAuthStateChanged\(auth/);
  assert.match(panel, /resolveBillingWorkspaceContext\(user\)/);
  assert.match(panel, /currentRequest !== requestId/);
  assert.match(panel, /useWorkspaceBillingAccount\(context\)/);
  assert.match(panel, /data-testid="billing-workspace-validation-error"/);
  assert.doesNotMatch(panel, /getResolvedWorkspaceContextForSession/);
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
  assert.match(panel, /a validação pela API aparecerá abaixo/);
  assert.doesNotMatch(panel, /setAccount\(.*paid/);
});

test('unannounced progressive pricing remains completely absent from client views', () => {
  for (const source of [panel, shell, page, pilot]) {
    assert.doesNotMatch(source, /Escalonamento previsto|PRICING|precos|Plano e valores|Simular novo assinante|billing-local-demo/);
    assert.doesNotMatch(source, /1º ao 3º|4º ao 6º|7º ao 9º|10º ao 12º|13º em diante/);
    assert.doesNotMatch(source, /cents: (2990|3990|4990|5990|6990)/);
  }
  assert.match(panel, /Isenção preservada/);
});

test('manual payment fallback loads on demand, not for every InfinitePay visit', () => {
  assert.match(page, /<InfinitePayReadinessPanel activeTab=\{activeTab\} onNavigate=\{setActiveTab\}/);
  assert.match(page, /if \(!showManualMethods\) return;/);
  assert.match(page, /data-testid="manual-payment-options-toggle"/);
  assert.match(page, /showManualMethods && error/);
  assert.match(page, /showManualMethods && info/);
  assert.match(page, /Abrir Link de Pagamento/);
  assert.match(page, /Copiar chave Pix/);
  assert.match(page, /Preço de referência legado/);
});

test('exempt clients keep their actual contract and cannot preview unpublished tiers', () => {
  assert.match(panel, /exempt = account\?\.status === 'exempt'/);
  assert.match(panel, /Isenção preservada/);
  assert.doesNotMatch(panel, /billing-local-demo|simulateFirstMonth|setSimulateFirstMonth/);
  assert.doesNotMatch(panel, /updatePlatformBillingConfig\(|setDoc\(|updateDoc\(/);
});

test('account tab is accessible from the authenticated application header', () => {
  assert.match(header, /data-testid="billing-account-open"/);
  assert.match(header, /router\.push\('\/regularizacao'\)/);
  assert.match(header, /workspaceContext\.status === 'sector'/);
});

test('subscription uses EMPROVEX fixed navigation and light operational surfaces', () => {
  assert.match(page, /<BillingPortalShell activeTab=\{activeTab\} onTabChange=\{setActiveTab\}>/);
  assert.match(shell, /data-testid="billing-platform-shell"/);
  assert.match(shell, /data-testid="billing-fixed-sidebar"/);
  assert.match(shell, /fixed bottom-0 left-0 top-16/);
  assert.match(shell, /lg:translate-x-0/);
  assert.match(shell, /AppShellSignature variant="sidebar"/);
  assert.match(shell, /bg-\[#f6f8fc\]/);
  assert.match(page, /data-testid="billing-light-content"/);
  assert.match(page, /bg-white/);
  assert.doesNotMatch(page, /bg-\[#020817\]/);
  assert.doesNotMatch(shell, /<AppSidebar/);
});

test('mobile subscription navigation is accessible and functional', () => {
  assert.match(shell, /aria-label="Abrir navegação"/);
  assert.match(shell, /aria-expanded=\{drawerOpen\}/);
  assert.match(shell, /onClick=\{\(\) => setDrawerOpen\(true\)\}/);
  assert.match(shell, /onClick=\{\(\) => setDrawerOpen\(false\)\}/);
  assert.match(shell, /role="tablist"/);
  assert.match(shell, /role="tab"/);
  assert.match(shell, /aria-selected=\{selected\}/);
  assert.match(shell, /onTabChange\(tab.id\)/);
  assert.match(shell, /event.key === 'ArrowDown'/);
  assert.match(shell, /event.key === 'ArrowUp'/);
  assert.match(pilot, /id="historico-financeiro"/);
  assert.match(page, /id="formas-pagamento"/);
});

test('visual-only restyle does not activate subscription billing', () => {
  assert.match(panel, /data-testid="infinitepay-checkout-disabled"/);
  assert.match(panel, /disabled\s+aria-disabled="true"/);
  assert.match(pilot, /data-testid="infinitepay-pilot-consent"/);
  assert.match(panel, /resolveBillingWorkspaceContext\(user\)/);
  assert.doesNotMatch(shell + page, /INFINITEPAY_API_KEY|NEXT_PUBLIC_INFINITEPAY/);
});

test('four distinct pages use exclusive content panels and real navigation state', () => {
  assert.match(tabs, /'overview' \| 'history' \| 'payments' \| 'help'/);
  assert.match(page, /useState<BillingPortalTab>\('overview'\)/);
  assert.match(page, /<BillingPortalShell activeTab=\{activeTab\} onTabChange=\{setActiveTab\}>/);
  assert.match(page, /role="tabpanel"/);
  assert.match(page, /data-tab=\{activeTab\}/);
  assert.match(page, /activeTab === 'help'/);
  assert.match(page, /activeTab === 'payments'/);
  assert.match(panel, /activeTab === 'overview'/);
  assert.match(panel, /activeTab === 'history'/);
  assert.match(panel, /activeTab === 'payments'/);
  assert.match(pilot, /activeTab === 'history'/);
  assert.match(pilot, /activeTab === 'payments'/);
  assert.doesNotMatch(shell, /href="#visao-geral"|href="#historico-financeiro"|href="#formas-pagamento"/);
});

test('history is read-only, searchable and filterable within own authorized workspace', () => {
  assert.match(pilot, /data-testid="billing-history-search"/);
  assert.match(pilot, /data-testid="billing-history-filter"/);
  assert.match(pilot, /const filteredCycles/);
  assert.match(pilot, /history\.cycles/);
  assert.match(pilot, /Nenhuma competência corresponde aos filtros/);
  assert.match(pilot, /if \(!authorizedWorkspace\) return null/);
  assert.doesNotMatch(pilot, /setDoc\(|updateDoc\(|writeBatch\(/);
});

test('unpublished progressive pricing is absent from every public tab', () => {
  for (const source of [panel, shell, pilot, page, tabs]) {
    assert.doesNotMatch(source, /Escalonamento previsto|Simular novo assinante|PRICING|1º ao 3º|4º ao 6º/);
  }
});
