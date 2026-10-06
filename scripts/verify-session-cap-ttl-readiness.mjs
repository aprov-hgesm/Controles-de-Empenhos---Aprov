#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const lease = readFileSync('lib/platformSessionLease.ts', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');
const docs = readFileSync('docs/SESSION_CAP_01_RULES_AUDIT_01.md', 'utf8');
const failures = [];

const requireText = (source, needle, message) => {
  if (!source.includes(needle)) failures.push(message);
};

requireText(lease, 'expiresAt', 'Lease dinâmico perdeu expiresAt.');
requireText(rules, "'expiresAt'", 'Rules deixaram de exigir expiresAt no lease.');
requireText(docs, '--collection-group=sessionSlots', 'Runbook TTL de sessionSlots ausente.');
requireText(docs, '--collection-group=sessionRevocations', 'Runbook TTL de sessionRevocations ausente.');
requireText(docs, '--database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1', 'Runbook TTL não fixa o banco principal nomeado.');
requireText(docs, 'não executadas por este worker', 'Runbook TTL não preserva a proibição de alteração produtiva.');

if (failures.length) {
  console.error('SESSION-CAP TTL READINESS: FAIL');
  failures.forEach((item) => console.error(`  [BLOCK] ${item}`));
  process.exitCode = 2;
} else {
  console.log('SESSION-CAP TTL READINESS: PREPARED');
  console.log('Configuração produtiva real: VERIFICAÇÃO EXTERNA OBRIGATÓRIA');
}
