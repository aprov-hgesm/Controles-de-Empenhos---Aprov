import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { registerEmulatedBillingPortal } from './emulatedBillingPortal.mjs';
import { registerEmulatedLegalAcceptance } from './emulatedLegalAcceptance.mjs';

const FAKE_OPERATOR = 'sector-lifecycle@example.test';
const PASSWORD = 'Emprovex-Teste!2026';

async function signInWithFakeWorkspace(page) {
  await registerEmulatedBillingPortal(page.context());
  await registerEmulatedLegalAcceptance(page.context());
  await page.goto('/login');
  await page.getByTestId('sector-login-email').fill(FAKE_OPERATOR);
  await page.getByTestId('sector-login-password').fill(PASSWORD);
  await page.getByTestId('sector-login-submit').click();
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  const legal = page.getByRole('heading', { name: 'Termos e Privacidade' });
  await expect(nav.or(legal)).toBeVisible({ timeout: 20_000 });
  if (await legal.isVisible().catch(() => false)) {
    await page.getByRole('checkbox', {
      name: 'Li e aceito os Termos de Serviço e a Política de Privacidade.',
    }).check();
    await page.getByRole('button', { name: 'Aceitar e continuar' }).click();
  }
  await expect(nav).toBeVisible({ timeout: 20_000 });
}

async function visitTab(page, tab) {
  await page.getByTestId('nav-' + tab).click();
  await expect(page.locator('[data-operational-tab]')).toHaveAttribute('data-operational-tab', tab);
  await expect(page.getByTestId('operational-section-loading')).toHaveCount(0, { timeout: 20_000 });
}

async function recordMemory(page, cdp, mode, tab, phase) {
  // GC explicitly, same protocol for all samples. This measures retained JS heap,
  // not total Windows RAM, not GPU memory, and not Firebase/Node/Java RSS.
  await cdp.send('HeapProfiler.collectGarbage');
  const heap = await cdp.send('Runtime.getHeapUsage');
  const counters = await cdp.send('Memory.getDOMCounters');
  const snapshot = await page.evaluate(() => ({
    tab: document.querySelector('[data-operational-tab]')?.getAttribute('data-operational-tab') || '',
    mode: document.documentElement.dataset.visualMode,
    visibleRows: document.querySelectorAll('main[data-testid="operational-active-content"] tbody tr').length,
    activeCollections: document.querySelector('[data-active-realtime-collections]')?.getAttribute('data-active-realtime-collections') || '',
  }));
  expect(snapshot.mode).toBe(mode);
  expect(snapshot.tab).toBe(tab);
  const sample = {
    scenario: 'EMPROVEX_MEM_R3_SYNTHETIC_DEV_ONLY',
    mode, tab, phase,
    usedHeapBytes: heap.usedSize,
    allocatedHeapBytes: heap.totalSize,
    domNodes: counters.nodes,
    domDocuments: counters.documents,
    eventListeners: counters.jsEventListeners,
    visibleRows: snapshot.visibleRows,
    activeCollections: snapshot.activeCollections,
  };
  console.log('EMPROVEX_MEMORY_SAMPLE ' + JSON.stringify(sample));
  return sample;
}

test('baseline controlado de heap retido — Normal vs Essencial sem alterar dados', async ({ page }) => {
  test.setTimeout(95_000);
  await signInWithFakeWorkspace(page);
  const cdp = await page.context().newCDPSession(page);
  const samples = [];

  try {
    await visitTab(page, 'painel');
    samples.push(await recordMemory(page, cdp, 'premium', 'painel', 'fresh-normal'));

    await page.getByTestId('visual-mode-select').selectOption('essencial');
    await expect(page.locator('html')).toHaveAttribute('data-visual-mode', 'essencial');
    samples.push(await recordMemory(page, cdp, 'essencial', 'painel', 'fresh-essential'));

    await visitTab(page, 'empenhos');
    samples.push(await recordMemory(page, cdp, 'essencial', 'empenhos', 'after-load-ne'));
    await visitTab(page, 'nova_nf');
    samples.push(await recordMemory(page, cdp, 'essencial', 'nova_nf', 'after-load-invoices'));
    await visitTab(page, 'painel');
    samples.push(await recordMemory(page, cdp, 'essencial', 'painel', 'after-transactional'));

    await page.getByTestId('visual-mode-select').selectOption('premium');
    await expect(page.locator('html')).toHaveAttribute('data-visual-mode', 'premium');
    samples.push(await recordMemory(page, cdp, 'premium', 'painel', 'after-transactional-normal'));
  } finally {
    await cdp.detach();
    await mkdir('artifacts/memory', { recursive: true });
    await writeFile('artifacts/memory/essential-baseline.json', JSON.stringify({
      disclaimer: 'Synthetic data, Next dev + Firebase emulators on CI runner. Heap after GC only. Do not attribute Windows RAM/production savings.',
      samples,
    }, null, 2));
  }
  expect(samples).toHaveLength(6);
  expect(samples.every(s => Number.isFinite(s.usedHeapBytes) && s.usedHeapBytes > 0)).toBe(true);
  // No fixed MB budget: this run is a baseline, not proof of optimization or regression.
});
