#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const nsLifecycle = read('lib/nsIntegrityService.ts');
const sync = read('lib/firebaseSync.ts');
const nfHook = read('features/notas-fiscais/hooks/useNotasFiscaisActions.ts');
const nfView = read('features/notas-fiscais/components/NotasFiscaisView.tsx');
const rules = read('firestore.rules');
const warehouseRules = read('firestore.warehouse.rules');
const firebaseConfig = JSON.parse(read('firebase.json'));

for (const forbidden of [
  "from './warehouse/",
  "from '../warehouse/",
  'integrateInvoiceReceiptInTransaction',
  'integrateInvoiceDeletionInTransaction',
  'assertBulkInvoiceDeletionDoesNotBypassWarehouse',
  'currentSessionCanIntegrateWarehouse',
]) {
  assert.equal(
    nsLifecycle.includes(forbidden),
    false,
    'Lifecycle central de NF não pode depender do ADM Depósito: ' + forbidden
  );
}

for (const forbidden of [
  'warehouseIntegration',
  'warehouseMaterialId',
  'warehouseMovementIds',
  'ADM Depósito',
  'Estoque integrado',
  'correção compensatória no ledger',
]) {
  assert.equal(
    nfHook.includes(forbidden),
    false,
    'Hook de NF não pode depender de metadado logístico: ' + forbidden
  );
  assert.equal(
    nfView.includes(forbidden),
    false,
    'Tela de NF não pode depender do ADM Depósito: ' + forbidden
  );
}

assert.match(sync, /commitInvoiceReceiptLifecycle/);
assert.match(sync, /commitInvoiceDeletionLifecycle/);
assert.match(nsLifecycle, /transaction\.set\(nextInvoiceRef/);
assert.match(nsLifecycle, /transaction\.delete\(invoiceRef\)/);

// O namespace warehouse pode ter Rules próprias, mas as Rules operacionais do
// EMPROVEX não podem exigir dados do warehouse para invoices/empenhos.
const invoiceRulesStart = rules.indexOf('match /workspaces/{workspaceId}/invoices/{id}');
assert.notEqual(invoiceRulesStart, -1, 'Rules de invoices não encontradas.');
const invoiceRules = rules.slice(invoiceRulesStart, invoiceRulesStart + 700);
assert.equal(/warehouse|ADM Depósito/i.test(invoiceRules), false);

const empenhoRulesStart = rules.indexOf('match /workspaces/{workspaceId}/empenhos/{id}');
assert.notEqual(empenhoRulesStart, -1, 'Rules de empenhos não encontradas.');
const empenhoRules = rules.slice(empenhoRulesStart, empenhoRulesStart + 900);
assert.equal(/warehouse|ADM Depósito/i.test(empenhoRules), false);


assert.equal(
  rules.includes('match /warehouse/{workspaceId}'),
  false,
  'Rules do EMPROVEX principal não podem conter o namespace warehouse após a migração.'
);
assert.match(
  warehouseRules,
  /match \/warehouse\/\{workspaceId\} \{/,
  'firestore.warehouse.rules precisa manter o namespace warehouse.'
);

const firestoreTargets = Array.isArray(firebaseConfig.firestore)
  ? firebaseConfig.firestore
  : [];
const coreTarget = firestoreTargets.find(
  (item) =>
    item.database === 'ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1'
);
const warehouseTarget = firestoreTargets.find(
  (item) => item.database === 'emprovex-warehouse'
);
assert.equal(
  coreTarget?.rules,
  'firestore.rules',
  'Database principal precisa continuar vinculado a firestore.rules.'
);
assert.equal(
  warehouseTarget?.rules,
  'firestore.warehouse.rules',
  'Database ADM Depósito precisa continuar vinculado a firestore.warehouse.rules.'
);

console.log('EMPROVEX / ADM Depósito isolation guard: PASS');
console.log('- NF create/edit/delete independente do namespace warehouse');
console.log('- UI de NF sem efeitos ou estado logístico obrigatório');
console.log('- Rules operacionais de invoices/empenhos sem dependência do ADM Depósito');
console.log('- namespace /warehouse ausente do ruleset principal e preservado no database dedicado');
