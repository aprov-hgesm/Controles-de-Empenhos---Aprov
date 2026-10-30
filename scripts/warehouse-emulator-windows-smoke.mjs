#!/usr/bin/env node
/**
 * Windows GitHub Actions: reproduz o spawn do Warehouse Emulator que
 * anteriormente lançava EINVAL com Node 24 + npx.cmd direto.
 * Usa exclusivamente projeto demo; não toca serviços reais.
 */
import { spawn, spawnSync } from 'node:child_process';
import { warehouseEmulatorLaunch } from './warehouse-emulator-launch.mjs';

if (process.platform !== 'win32') {
  throw new Error('WINDOWS_SMOKE_REQUIRES_WINDOWS_RUNNER');
}
const project = 'demo-emprovex-security';
if (process.env.GOOGLE_CLOUD_PROJECT !== project) {
  throw new Error('WINDOWS_SMOKE_REQUIRES_DEMO_PROJECT');
}

const launch = warehouseEmulatorLaunch();
const child = spawn(launch.command, launch.args, {
  cwd: process.cwd(),
  env: { ...process.env, FIRESTORE_EMULATOR_HOST: '', GOOGLE_CLOUD_PROJECT: project },
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let processError = null;
let logTail = '';
function collect(chunk) {
  logTail = (logTail + String(chunk)).slice(-6000);
}
child.on('error', (error) => { processError = error; });
child.on('exit', (code) => {
  processError ||= new Error('Warehouse Emulator encerrou com code=' + code);
});
child.stdout?.on('data', collect);
child.stderr?.on('data', collect);

try {
  const deadline = Date.now() + 150_000;
  let started = false;
  while (Date.now() < deadline) {
    if (processError) throw processError;
    try {
      const response = await fetch('http://127.0.0.1:8081/', {
        signal: AbortSignal.timeout(2500),
      });
      // O endpoint raiz pode ser 404. Qualquer HTTP prova que está ouvindo.
      if (response.status >= 200) {
        started = true;
        break;
      }
    } catch {
      // Java / Firestore ainda inicializando.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!started) throw new Error('Warehouse Emulator não abriu 8081: ' + logTail);
  process.stdout.write('WINDOWS NODE24 WAREHOUSE EMULATOR: PASS (8081 ready)\n');
} catch (error) {
  console.error('WINDOWS EMULATOR SPAWN FAILED:', error, logTail);
  process.exitCode = 1;
} finally {
  if (child.pid) {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true, stdio: 'ignore', timeout: 10_000,
    });
  }
}
