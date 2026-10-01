import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

const policy = JSON.parse(read('ops/firestore-recovery.json'));
const baseline = JSON.parse(read('ops/backup-recovery-baseline.json'));
const health = read('app/api/health/route.ts');
const backup = read('lib/workspaceBackup.ts');
const namespace = read('lib/warehouse/namespace.ts');
const recoveryDocs = read('docs/RECUPERACAO_FIRESTORE.md');
const runbook = read('docs/SAAS_R1_OPERACAO_RECUPERACAO.md');
const uptime = read('docs/SAAS_R1_UPTIME_MONITORING.md');
const workflow = read('.github/workflows/recovery-guardrails.yml');

const expectedDatabases = [
  'ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1',
  'emprovex-warehouse',
];

assert.equal(policy.version, 2, 'Política nativa precisa estar na versão 2.');
assert.deepEqual(
  policy.databases.map((item) => item.id),
  expectedDatabases,
  'Recovery nativo deve proteger exatamente os dois bancos congelados do SaaS R1.',
);
for (const database of policy.databases) {
  assert.equal(database.dailyBackupRetention, '14w');
  assert.equal(database.rpoHours, 24);
  assert.equal(database.rtoHours, 4);
}

assert.deepEqual(
  baseline.nativeFirestore.databases,
  expectedDatabases,
  'Baseline de backup precisa registrar os dois bancos.',
);
assert.equal(baseline.nativeFirestore.restoreTarget, 'isolated-new-database');

assert.match(health, /status:\s*'ok'/);
assert.doesNotMatch(health, /firebase|firestore|process\.env|apiKey|secret/i);

for (const name of ['empenhos', 'alerts', 'invoices', 'comissoes', 'cronogramas']) {
  assert(backup.includes("'" + name + "'"), 'Backup lógico perdeu coleção operacional: ' + name);
}
assert(namespace.includes("movements: 'movements'"));
assert(namespace.includes("inventories: 'inventories'"));
assert(namespace.includes("consumptions: 'consumptions'"));

assert.match(recoveryDocs, /emprovex-warehouse/);
assert.match(recoveryDocs, /banco novo e isolado/i);
assert.match(runbook, /RPO.*24/i);
assert.match(runbook, /RTO.*4/i);
assert.match(runbook, /Central de Depósitos/i);
assert.match(uptime, /\/api\/health/);
assert.match(uptime, /gcloud monitoring uptime create/);
assert.match(uptime, /validate-ssl=true/);

assert.match(workflow, /npm run test:health/);
assert.match(workflow, /npm run verify:saas-r1-ops-recovery/);

console.log('SAAS-E operation/recovery guard: OK');
