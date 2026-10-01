#!/usr/bin/env node

import { spawn } from 'node:child_process';

const root = process.cwd();
const appBase = 'http://127.0.0.1:3102';
const playwrightCli = 'node_modules/@playwright/test/cli.js';

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

  throw new Error(`Serviço SAAS-C não respondeu em ${url}.`);
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

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  child.kill('SIGTERM');

  const exitedGracefully = await new Promise((resolve) => {
    const fallback = setTimeout(() => resolve(false), 4000);
    child.once('exit', () => {
      clearTimeout(fallback);
      resolve(true);
    });
  });

  if (exitedGracefully || child.exitCode !== null || child.signalCode !== null) return;

  child.kill('SIGKILL');
  await new Promise((resolve) => {
    const fallback = setTimeout(resolve, 2000);
    child.once('exit', () => {
      clearTimeout(fallback);
      resolve();
    });
  });
}

// Reutiliza o seed oficial que já cria usuários verificados, diretório,
// workspaces e contratos de segurança no Auth/Firestore Emulator.
await run(process.execPath, ['scripts/firestore-multitenancy-security.test.mjs']);

let server = null;

try {
  server = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3102'],
    {
      cwd: root,
      env: {
        ...process.env,
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
        NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS: '1',
        NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID: 'demo-emprovex-security',
        NEXT_PUBLIC_EMPROVEX_E2E_WAREHOUSE_FIRESTORE_PORT: '8080',
        EMPROVEX_E2E_SERVER_AUTH: '1',
        NEXT_TELEMETRY_DISABLED: '1',
        DISABLE_HMR: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  server.stdout.on('data', (chunk) => process.stdout.write(`[next-saas-c] ${chunk}`));
  server.stderr.on('data', (chunk) => process.stderr.write(`[next-saas-c] ${chunk}`));

  await waitForEndpoint(appBase);
  process.stdout.write('SAAS-C Next.js smoke: READY\n');

  await run(
    process.execPath,
    [
      playwrightCli,
      'test',
      'saas-r1-onboarding.spec.mjs',
      '--config=playwright.e2e.config.mjs',
    ],
    {
      ...process.env,
      EMPROVEX_E2E_BASE_URL: appBase,
    }
  );
} finally {
  await stopChild(server);
}
