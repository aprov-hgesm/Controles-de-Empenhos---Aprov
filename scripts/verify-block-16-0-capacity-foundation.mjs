#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const findings = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const capacity = read('lib/platformCapacity.ts');
const docs = read('docs/BLOCK_16_0_CAPACITY_FOUNDATION.md');
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');

function requireText(source, expected, message) {
  if (!source.includes(expected)) findings.push(message);
}

for (const marker of [
  "CAPACITY_POLICY_VERSION = 'emprovex_capacity_v1'",
  "USAGE_TELEMETRY_VERSION = 'emprovex_usage_v1'",
  'DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT = 2',
  'export interface WorkspaceCapacityPolicy',
  'export interface WorkspaceSessionLease',
  'export interface WorkspaceUsageEstimate',
  'export interface FirebaseGlobalUsageSnapshot',
  "source: 'emprovex-workspace-estimate'",
  "source: 'google-cloud-monitoring'",
  'export function isFounderCapacityExempt',
  'return normalizePlatformEmail(accountEmail) === HGESM_SECTOR_EMAIL',
  '? null',
  ': DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT',
  'export function assessUsageBudget',
  "ratio >= 0.95",
  "ratio >= 0.85",
  "ratio >= 0.7",
]) {
  requireText(capacity, marker, `Contrato de capacidade ausente: ${marker}`);
}

for (const marker of [
  '2 sessões simultâneas por UG/workspace',
  'identidade fundadora é **ilimitada**',
  'google-cloud-monitoring',
  'emprovex-workspace-estimate',
  'não persiste esse objeto',
  '- cria heartbeat;',
  '- altera Rules;',
]) {
  requireText(docs, marker, `Documentação 16.0 perdeu requisito: ${marker}`);
}

requireText(
  pkg,
  '"verify:block-16-0-capacity-foundation"',
  'package.json não registra o guard do Bloco 16.0.'
);
requireText(
  workflow,
  'Block 16.0 capacity foundation guard',
  'Application CI não executa o guard do Bloco 16.0.'
);

if (findings.length) {
  console.error('BLOCK 16.0 CAPACITY FOUNDATION: FAIL');
  findings.forEach((finding) => console.error(`  [BLOCK] ${finding}`));
  process.exitCode = 2;
} else {
  console.log('BLOCK 16.0 CAPACITY FOUNDATION: READY');
  console.log('Setores externos: DEFAULT 2 SESSÕES');
  console.log('Conta fundadora: ILIMITADA');
  console.log('Métrica global Firebase: REAL / CLOUD MONITORING');
  console.log('Consumo por UG: ESTIMATIVA EMPROVEX');
  console.log('Enforcement de sessão: NÃO ATIVADO NESTE SUBBLOCO');
}
