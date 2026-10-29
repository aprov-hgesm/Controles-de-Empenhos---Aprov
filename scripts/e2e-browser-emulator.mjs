#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { warehouseEmulatorLaunch } from './warehouse-emulator-launch.mjs';

const root = process.cwd();
const appBase = 'http://127.0.0.1:3100';
const warehouseEmulatorBase = 'http://127.0.0.1:8081';
const playwrightCli = 'node_modules/@playwright/test/cli.js';
const warehouseLaunch = warehouseEmulatorLaunch();
const supportsProcessGroups = process.platform !== 'win32';

async function waitForEndpoint(url, timeoutMs = 60_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await fetch(url);
      return;
    } catch {
      // Serviço ainda iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Serviço E2E não respondeu em ${url}.`);
}

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(' ')} encerrou com code=${code} signal=${signal || 'none'}`
        )
      );
    });
  });
}

function signalChildTree(child, signal) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  if (supportsProcessGroups && child.pid) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fallback para o processo direto se o grupo já tiver sido desmontado.
    }
  }

  child.kill(signal);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  signalChildTree(child, 'SIGTERM');

  const exitedGracefully = await new Promise((resolve) => {
    const fallback = setTimeout(() => resolve(false), 4000);
    child.once('exit', () => {
      clearTimeout(fallback);
      resolve(true);
    });
  });

  if (exitedGracefully || child.exitCode !== null || child.signalCode !== null) return;

  signalChildTree(child, 'SIGKILL');
  await new Promise((resolve) => {
    const fallback = setTimeout(resolve, 2000);
    child.once('exit', () => {
      clearTimeout(fallback);
      resolve();
    });
  });
}

// Seed do EMPROVEX principal no Firestore padrão (8080).
await run(process.execPath, ['scripts/firestore-multitenancy-security.test.mjs']);
// O teste multi-tenant restaura a conta de trial vencido. Para o browser E2E
// usar contas fictícias isentas; cobrança real e Rules continuam intactas.
await run(process.execPath, ['scripts/e2e-billing-fixture.mjs']);

// A versão atual do Firestore Emulator não suporta Rules de múltiplos bancos
// no mesmo processo. A Central usa uma segunda instância dedicada em 8081.
const warehouseEnv = { ...process.env };
delete warehouseEnv.FIRESTORE_EMULATOR_HOST;

const warehouseEmulator = spawn(
  warehouseLaunch.command,
  warehouseLaunch.args,
  {
    cwd: root,
    env: warehouseEnv,
    detached: supportsProcessGroups,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  }
);
// Windows spawn failures must be captured rather than crashing Node with EINVAL.
let warehouseStartError = null;
warehouseEmulator.on('error', (error) => {
  warehouseStartError = error;
  console.error('Não foi possível iniciar o Warehouse Emulator:', error);
});

warehouseEmulator.stdout.on(
  'data',
  (chunk) => process.stdout.write(`[warehouse-emulator] ${chunk}`)
);
warehouseEmulator.stderr.on(
  'data',
  (chunk) => process.stderr.write(`[warehouse-emulator] ${chunk}`)
);

let server = null;

try {
  if (warehouseStartError) throw warehouseStartError;
  await waitForEndpoint(warehouseEmulatorBase, process.argv.includes('--preview') ? 180_000 : 60_000);
  if (warehouseStartError) throw warehouseStartError;

  await run(
    process.execPath,
    ['scripts/warehouse-e2e-fixture.mjs'],
    {
      ...process.env,
      EMPROVEX_E2E_WAREHOUSE_FIRESTORE_PORT: '8081',
    }
  );

  server = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3100'],
    {
      cwd: root,
      detached: supportsProcessGroups,
      env: {
        ...process.env,
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
        NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS: '1',
        NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID: 'demo-emprovex-security',
        NEXT_PUBLIC_EMPROVEX_E2E_WAREHOUSE_FIRESTORE_PORT: '8081',
        EMPROVEX_E2E_SERVER_AUTH: '1',
        // O backend deve apontar ao Warehouse Emulator 8081, JAMAIS ao banco real.
        EMPROVEX_WAREHOUSE_ADMIN_EMULATOR: '1',
        EMPROVEX_E2E_WAREHOUSE_FIRESTORE_PORT: '8081',
        NEXT_TELEMETRY_DISABLED: '1',
        DISABLE_HMR: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  server.stdout.on('data', (chunk) => process.stdout.write(`[next] ${chunk}`));
  server.stderr.on('data', (chunk) => process.stderr.write(`[next] ${chunk}`));

  await waitForEndpoint(appBase, process.argv.includes('--preview') ? 180_000 : 60_000);
  process.stdout.write('Next.js E2E: READY\n');

  if (process.argv.includes('--preview')) {
    if (process.env.GOOGLE_CLOUD_PROJECT !== 'demo-emprovex-security'
      || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080'
      || !['127.0.0.1:9099', 'localhost:9099'].includes(process.env.FIREBASE_AUTH_EMULATOR_HOST || '')) {
      throw new Error('PREVIEW_REQUIRES_DEMO_AUTH_AND_FIRESTORE_EMULATORS');
    }
    process.env.EMPROVEX_E2E_BASE_URL = appBase;
    const { chromium } = await import('@playwright/test');
    const { registerEmulatedBillingPortal } = await import('../tests/e2e/emulatedBillingPortal.mjs');
    const { registerEmulatedLegalAcceptance } = await import('../tests/e2e/emulatedLegalAcceptance.mjs');
    const browser = await chromium.launch({ headless: false });
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await registerEmulatedBillingPortal(context);
      await registerEmulatedLegalAcceptance(context);
      const page = await context.newPage();
      console.log('EMPROVEX PREVIEW: Chromium aberto em ' + appBase + '/login');
      console.log('LOGIN: sector-lifecycle@example.test / Emprovex-Teste!2026');
      console.log('Feche o Chromium para encerrar a prévia; não é necessário alterar a aplicação.');
      await page.goto(appBase + '/login', { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await new Promise((resolve) => {
        browser.once('disconnected', resolve);
      });
    } finally {
      if (browser.isConnected()) await browser.close();
    }
  } else {
    await run(
      process.execPath,
      [playwrightCli, 'test', ...process.argv.slice(2), '--config=playwright.e2e.config.mjs'],
      {
        ...process.env,
        EMPROVEX_E2E_BASE_URL: appBase,
      }
    );
  }
} finally {
  await stopChild(server);
  await stopChild(warehouseEmulator);
}
