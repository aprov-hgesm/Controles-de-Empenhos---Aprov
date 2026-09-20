#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const baseline = JSON.parse(read('ops/firestore-consumption-baseline.json'));
const capacity = read('lib/platformCapacity.ts');
const lease = read('lib/platformSessionLease.ts');
const firebase = read('lib/firebase.ts');
const firebaseConfig = JSON.parse(read('firebase-applet-config.json'));
const pkg = read('package.json');
const workflow = read('.github/workflows/application-ci.yml');
const doc = read('docs/BLOCK_17_0_FIRESTORE_CONSUMPTION_BASELINE.md');

const failures = [];
const requireTrue = (condition, message) => {
  if (!condition) failures.push(message);
};
const requireText = (source, expected, message) => {
  if (!source.includes(expected)) failures.push(message);
};

function numericExpressionForConst(source, name) {
  const match = source.match(new RegExp(`export const ${name} = ([0-9*+()\\s]+);`));
  if (!match) throw new Error(`Constante não encontrada: ${name}`);
  const expression = match[1].trim();
  const compactExpression = expression.replace(/\\s+/g, '');
  if (!/^[0-9*+()]+$/.test(compactExpression)) {
    throw new Error(`Expressão não numérica para ${name}`);
  }
  return Function(`"use strict"; return (${compactExpression});`)();
}

requireTrue(
  baseline.baselineVersion === 'emprovex_firestore_consumption_baseline_v1',
  'Versão do baseline 17.0 inválida.'
);
requireTrue(
  baseline.baselineCommit === 'f432b18e661f0ef1758a567caf7d72f883e1adb4',
  'Commit histórico do baseline 17.0 foi alterado.'
);

const heartbeat = baseline.sessionLease;
requireTrue(
  heartbeat.renewalsPerHourAtCurrentInterval === 60 * 60 * 1000 / heartbeat.heartbeatIntervalMs,
  'Fórmula de renovações por hora está inconsistente.'
);
requireTrue(
  heartbeat.explicitReadsPerSessionHour
    === heartbeat.renewalsPerHourAtCurrentInterval * heartbeat.explicitReadsPerAcquireOrCurrentRenewal,
  'Fórmula de reads por sessão/hora está inconsistente.'
);
requireTrue(
  heartbeat.explicitWritesPerSessionHour
    === heartbeat.renewalsPerHourAtCurrentInterval * heartbeat.explicitWritesPerAcquireOrCurrentRenewal,
  'Fórmula de writes por sessão/hora está inconsistente.'
);

for (const [label, sessions, hours] of [
  ['50_sessions_8_hours', 50, 8],
  ['100_sessions_8_hours', 100, 8],
  ['100_sessions_24_hours', 100, 24],
]) {
  const scenario = heartbeat.scenarios[label];
  requireTrue(
    scenario.explicitReads === sessions * hours * heartbeat.explicitReadsPerSessionHour,
    `Cenário ${label} perdeu a fórmula de reads.`
  );
  requireTrue(
    scenario.explicitWrites === sessions * hours * heartbeat.explicitWritesPerSessionHour,
    `Cenário ${label} perdeu a fórmula de writes.`
  );
}

const currentHeartbeatMs = numericExpressionForConst(
  capacity,
  'SESSION_HEARTBEAT_INTERVAL_MS'
);
const currentLeaseMs = numericExpressionForConst(
  capacity,
  'SESSION_LEASE_DURATION_MS'
);

requireTrue(
  currentHeartbeatMs >= heartbeat.heartbeatIntervalMs,
  'Heartbeat ficou mais frequente que o baseline 17.0 e pode aumentar consumo.'
);
requireTrue(
  currentLeaseMs >= heartbeat.leaseDurationMs,
  'Lease ficou menor que o baseline 17.0 sem revisão explícita de capacidade.'
);
requireText(
  capacity,
  "export const SESSION_SLOT_IDS = ['slot-1', 'slot-2'] as const;",
  'Modelo de dois slots externos foi alterado.'
);
requireText(
  capacity,
  'export const DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT = 2;',
  'Limite externo de duas sessões foi alterado.'
);

requireText(
  lease,
  'transaction.get(revocationRef)',
  'Aquisição de sessão perdeu a verificação transacional do tombstone.'
);
requireText(
  lease,
  '...slotRefs.map(({ ref }) => transaction.get(ref))',
  'Aquisição de sessão perdeu a inspeção transacional dos slots.'
);
requireText(
  lease,
  '{ documentReads: 3, documentWrites: 1 }',
  'Telemetria da aquisição deixou de registrar o baseline explícito de 3 reads + 1 write.'
);

requireTrue(
  firebaseConfig.firestoreDatabaseId === baseline.productionFirestore.databaseId,
  'DatabaseId de produção diverge do baseline; exige revisão explícita do baseline.'
);
requireTrue(
  firebaseConfig.firestoreDatabaseId !== '(default)',
  'O baseline declara banco nomeado, mas o runtime foi migrado para (default). Revise formalmente o baseline.'
);
requireText(
  firebase,
  'getFirestore(app, firebaseConfig.firestoreDatabaseId)',
  'Runtime deixou de selecionar explicitamente o databaseId configurado.'
);

for (const id of Array.from({ length: 10 }, (_, index) => `FQ-${String(index + 1).padStart(3, '0')}`)) {
  requireTrue(
    baseline.knownReadHotspots.some((finding) => finding.id === id),
    `Registro de risco ausente: ${id}`
  );
  requireText(doc, id === 'FQ-001' ? 'Baseline do lease/heartbeat' : 'Bloco 17.0', 'Documento de baseline 17.0 está incompleto.');
}

for (const blindSpot of [
  'security-rules-dependent-document-reads',
  'transaction-retries',
  'public branding reads',
  'telemetry self-write overhead',
]) {
  requireTrue(
    baseline.telemetryBlindSpots.includes(blindSpot),
    `Blind spot obrigatório ausente: ${blindSpot}`
  );
}

requireText(
  doc,
  'não faturamento oficial',
  'Documento precisa distinguir baseline de código de faturamento oficial.'
);
requireText(
  doc,
  'bancos nomeados não qualificam para a free quota',
  'Documento perdeu o achado sobre banco nomeado.'
);
requireText(
  doc,
  '36 reads explícitas por sessão/hora',
  'Documento perdeu o baseline horário do heartbeat.'
);
requireText(
  doc,
  'Base persistente: 6 listeners Firestore por aba.',
  'Documento perdeu o baseline de listeners persistentes.'
);
requireText(
  doc,
  'estimativa interna por UG',
  'Documento perdeu a separação da telemetria por UG.'
);

requireText(
  pkg,
  '"verify:block-17-0-firestore-baseline"',
  'package.json não registra o guard do Bloco 17.0.'
);
requireText(
  workflow,
  'Block 17.0 Firestore consumption baseline guard',
  'Application CI não executa o guard do Bloco 17.0.'
);
requireText(
  workflow,
  'Block 16 Final Release Gate',
  'Release gate consolidado anterior foi removido sem encerramento formal do Bloco 17.'
);

if (failures.length) {
  console.error('BLOCK 17.0 FIRESTORE CONSUMPTION BASELINE: FAIL');
  for (const failure of failures) console.error(`  [BLOCK] ${failure}`);
  process.exitCode = 2;
} else {
  console.log('BLOCK 17.0 FIRESTORE CONSUMPTION BASELINE: READY');
  console.log(`Database: ${baseline.productionFirestore.databaseId} (named)`);
  console.log(`Heartbeat baseline: ${heartbeat.heartbeatIntervalMs / 60000} min`);
  console.log(`Lease baseline: ${heartbeat.leaseDurationMs / 60000} min`);
  console.log(`Explicit session-hour baseline: ${heartbeat.explicitReadsPerSessionHour} reads + ${heartbeat.explicitWritesPerSessionHour} writes`);
  console.log('Billing, Rules overhead and internal telemetry: SEPARATED');
}
