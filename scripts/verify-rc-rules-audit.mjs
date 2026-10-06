#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const full = process.argv.includes('--full');

const staticGates = [
  'verify:block-16-0-capacity-foundation',
  'verify:block-16-1-session-enforcement',
  'verify:block-16-2-admin-session-panel',
  'verify:block-16-3-workspace-telemetry',
  'verify:block-16-7-security-concurrency',
  'test:block-16-8-integrated-domain',
  'verify:block-16-8-integrated-e2e',
  'verify:block-16-9-final-closure',
  'verify:block-17-0-firestore-baseline',
  'verify:block-17-1-session-lease-efficiency',
  'verify:block-17-2-multitab-coordination',
  'verify:block-17-8-consumption-regression',
  'verify:sector-lifecycle',
  'verify:saas-r1-security-enforcement',
  'verify:saas-r1-integration',
  'verify:saas-r1-legal-acceptance',
  'verify:emprovex-core-protection',
  'verify:session-cap-ttl-readiness',
];

const emulatorGates = [
  'test:security:multitenant',
  'test:saas-r1-legal-acceptance',
  'test:central-depositos-external-security',
];

function run(scriptName) {
  console.log(`\n[RC RULES AUDIT] npm run ${scriptName}`);
  const result = spawnSync(npm, ['run', scriptName], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`[RC RULES AUDIT] FAIL: ${scriptName}`);
    process.exit(result.status || 2);
  }
}

for (const gate of staticGates) run(gate);
if (full) for (const gate of emulatorGates) run(gate);

console.log('\nRC RULES AUDIT: READY');
console.log(`Modo: ${full ? 'FULL (inclui Emulator)' : 'STATIC'}`);
console.log('Produção/Rules reais: NÃO ALTERADAS');
