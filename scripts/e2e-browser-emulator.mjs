#!/usr/bin/env node

import { spawn } from 'node:child_process';

const root = process.cwd();
const appBase = 'http://127.0.0.1:3100';
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

async function waitForApp(url, timeoutMs = 60_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Next.js ainda iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Next.js E2E não respondeu em ${url}.`);
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

await run(process.execPath, ['scripts/firestore-multitenancy-security.test.mjs']);

const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3100'],
  {
    cwd: root,
    env: {
      ...process.env,
      NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS: '1',
      NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID: 'demo-emprovex-security',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  }
);

server.stdout.on('data', (chunk) => process.stdout.write(`[next] ${chunk}`));
server.stderr.on('data', (chunk) => process.stderr.write(`[next] ${chunk}`));

try {
  await waitForApp(appBase);
  process.stdout.write('Next.js E2E: READY\n');

  await run(
    npxCommand,
    ['playwright', 'test', '--config=playwright.e2e.config.mjs'],
    {
      ...process.env,
      EMPROVEX_E2E_BASE_URL: appBase,
    }
  );
} finally {
  if (!server.killed) {
    server.kill('SIGTERM');
    await new Promise((resolve) => {
      const fallback = setTimeout(() => {
        if (!server.killed) server.kill('SIGKILL');
        resolve();
      }, 3000);
      server.once('exit', () => {
        clearTimeout(fallback);
        resolve();
      });
    });
  }
}
