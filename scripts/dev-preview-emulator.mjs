#!/usr/bin/env node
/**
 * Preview visual local isolado. NÃO inicia a aplicação contra Firebase real.
 * Firebase Auth + Firestore Emulator rodam em demo-emprovex-security;
 * o navegador controlado por Playwright intercepta as duas APIs que
 * exigem IAM de produção (aceite legal R4 e cobrança), validando identidade,
 * UG e permissões contra Auth/Firestore Emulator.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const projectId = 'demo-emprovex-security';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
if (existsSync('.env.production.local')) {
  console.error('PREVIEW BLOQUEADO: remova .env.production.local deste clone antes de testar.');
  process.exit(1);
}
const env = {
  ...process.env,
  GOOGLE_CLOUD_PROJECT: projectId,
  GCLOUD_PROJECT: projectId,
  FIREBASE_PROJECT_ID: projectId,
  FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON: '',
  GOOGLE_APPLICATION_CREDENTIALS: '',
  NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS: '1',
  NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID: projectId,
  NEXT_PUBLIC_EMPROVEX_E2E_WAREHOUSE_FIRESTORE_PORT: '8081',
  EMPROVEX_E2E_SERVER_AUTH: '1',
  EMPROVEX_WAREHOUSE_ADMIN_EMULATOR: '1',
  EMPROVEX_E2E_WAREHOUSE_FIRESTORE_PORT: '8081',
};
console.log('EMPROVEX PREVIEW: ambiente 100% de teste — Firebase Auth/Firestore Emulator.');
console.log('Credencial fictícia: sector-lifecycle@example.test / Emprovex-Teste!2026');
console.log('A janela do Chromium será aberta automaticamente. Feche-a para encerrar.');
const previewCommand = 'node scripts/e2e-browser-emulator.mjs --preview';
// Em cmd.exe, firebase emulators:exec exige que o comando filho seja um
// único argumento; aspas explícitas evitam perder o flag --preview.
const execArgument = process.platform === 'win32'
  ? '"' + previewCommand + '"'
  : previewCommand;
const child = spawn(npx, [
  '--yes', 'firebase-tools', 'emulators:exec',
  '--config', 'firebase.security-test.json',
  '--project', projectId, '--only', 'auth,firestore',
  execArgument,
], { stdio: 'inherit', env, shell: process.platform === 'win32' });
child.once('error', (error) => {
  console.error('Falha ao iniciar os emuladores:', error.message);
  process.exitCode = 1;
});
child.once('close', (code) => {
  if (typeof code === 'number' && code !== 0) process.exitCode = code;
});
