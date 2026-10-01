import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const stateRepository = readFileSync(
  resolve(root, 'lib/warehouse/intakeStateRepository.ts'),
  'utf8'
);
const indexRepository = readFileSync(
  resolve(root, 'lib/warehouse/intakeQueueIndexRepository.ts'),
  'utf8'
);
const registration = readFileSync(
  resolve(root, 'features/warehouse/components/WarehouseItemRegistrationOperational.tsx'),
  'utf8'
);
const namespace = readFileSync(
  resolve(root, 'lib/warehouse/namespace.ts'),
  'utf8'
);
const rules = readFileSync(
  resolve(root, 'firestore.warehouse.rules'),
  'utf8'
);

function functionBody(source, signature, nextSignature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, 'assinatura não encontrada: ' + signature);
  const end = nextSignature
    ? source.indexOf(nextSignature, start + signature.length)
    : source.length;
  assert.notEqual(end, -1, 'limite não encontrado: ' + nextSignature);
  return source.slice(start, end);
}

test('fila operacional usa índice derivado ativo e consultas por identidades relevantes', () => {
  const operational = functionBody(
    stateRepository,
    'export async function loadWarehouseInvoiceIntakeQueue(',
    'export async function loadWarehouseInvoiceIntakeHistory('
  );

  assert.match(operational, /syncWarehouseIntakeQueueIndex/);
  assert.match(operational, /listWarehouseActiveIntakeQueueCandidates/);
  assert.match(operational, /listPersistedIntakesByIds/);
  assert.match(operational, /listCandidateInvoiceMovementEvidence/);
  assert.doesNotMatch(operational, /listOperationalBounded/);
  assert.doesNotMatch(operational, /listPersistedIntakes\(/);
  assert.doesNotMatch(operational, /listWarehouseMovements/);
});

test('índice operacional não cria intake e pagina apenas candidatos ativos', () => {
  assert.match(indexRepository, /where\('active', '==', true\)/);
  assert.match(indexRepository, /ACTIVE_PAGE_SIZE = 250/);
  assert.match(indexRepository, /startAfter\(cursor\)/);
  assert.match(indexRepository, /warehouse_intake_queue_candidate_v1/);
  assert.doesNotMatch(indexRepository, /setDoc\([^\n]*intakes/);
  assert.doesNotMatch(indexRepository, /warehouse_balance_v1/);
  assert.doesNotMatch(indexRepository, /applyWarehouseMovement/);
});

test('evidência de movimento é limitada por NF candidata e não por scan global recente', () => {
  const evidence = functionBody(
    stateRepository,
    'async function listCandidateInvoiceMovementEvidence(',
    'function orphanRowFromPersisted('
  );

  assert.match(evidence, /where\('source\.invoiceRecordKey', '==', invoiceRecordKey\)/);
  assert.match(evidence, /const perInvoiceLimit = 51/);
  assert.match(evidence, /limit\(perInvoiceLimit\)/);
});

test('histórico permanece acessível sob demanda e paginado', () => {
  const historical = functionBody(
    stateRepository,
    'export async function loadWarehouseInvoiceIntakeHistory(',
    'export async function refreshWarehouseInvoiceIntakeQueueRows('
  );

  assert.match(historical, /listOperationalBounded<Invoice>/);
  assert.match(historical, /listPersistedIntakes\(workspaceId\)/);
  assert.match(stateRepository, /WAREHOUSE_INTAKE_HISTORY_MAX_PAGES = 40/);
  assert.match(stateRepository, /orderBy\(documentId\(\), 'asc'\)/);
  assert.match(stateRepository, /startAfter\(cursor\)/);

  assert.match(registration, /loadWarehouseInvoiceIntakeHistory/);
  assert.match(registration, /statusFilter === 'actionable' \? 'operational' : 'history'/);
});

test('namespace e Rules tratam o índice como derivação isolada e não deletável', () => {
  assert.match(namespace, /intakeQueueIndex: 'intakeQueueIndex'/);
  assert.match(rules, /match \/intakeQueueIndex\/\{entryId\}/);
  assert.match(rules, /warehouse_intake_queue_index_v1/);
  assert.match(rules, /warehouse_intake_queue_candidate_v1/);
  assert.match(rules, /allow delete: if false/);
});

test('custo steady-state depende das pendências, não do histórico acumulado', () => {
  const steadyStateReads = ({
    activeCandidates,
    candidateInvoices,
    persistedStates,
    matchingLegacyMovements,
    empenhos,
    deltaInvoices,
  }) =>
    1
    + activeCandidates
    + candidateInvoices
    + persistedStates
    + matchingLegacyMovements
    + empenhos
    + deltaInvoices;

  const current = {
    activeCandidates: 30,
    candidateInvoices: 20,
    persistedStates: 12,
    matchingLegacyMovements: 3,
    empenhos: 18,
    deltaInvoices: 2,
  };

  const tenThousandHistoricalInvoices = steadyStateReads(current);
  const oneHundredThousandHistoricalInvoices = steadyStateReads(current);

  assert.equal(tenThousandHistoricalInvoices, 86);
  assert.equal(
    oneHundredThousandHistoricalInvoices,
    tenThousandHistoricalInvoices
  );
});
