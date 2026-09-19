#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const contract = JSON.parse(
  readFileSync(resolve(root, 'ops/ns-integrity-contract.json'), 'utf8')
);

const invariantIds = contract.invariants.map((item) => item.id);
const operationIds = contract.operations.map((item) => item.id);
const gapIds = contract.knownGaps.map((item) => item.id);

const expectedInvariantIds = Array.from(
  { length: 11 },
  (_, index) => `NS-${String(index + 1).padStart(3, '0')}`
);

const requiredOperationIds = [
  'assign_ns',
  'replace_ns',
  'remove_ns',
  'migrate_invoice_record_key',
  'delete_invoice',
  'bulk_delete_invoices',
  'change_supplier_cnpj',
  'sag_import',
  'direct_numero_ns_write_without_integrity_service',
  'delete_lock_without_owner_transition',
];

test('contrato NS v1 está congelado sem mudança de runtime no Bloco 0', () => {
  assert.equal(contract.contractVersion, 'emprovex_ns_integrity_v1');
  assert.equal(contract.status, 'frozen');
  assert.equal(contract.runtimeBehaviorChange, false);
});

test('identidade canônica futura inclui workspace, UG e número da NS', () => {
  assert.deepEqual(
    contract.canonicalIdentity.targetDimensions,
    ['workspaceId', 'ug', 'numeroNS']
  );
  assert.deepEqual(
    contract.canonicalIdentity.legacyLockDimensions,
    ['workspaceId', 'numeroNS']
  );
  assert.equal(contract.canonicalIdentity.migrationRequired, true);
});

test('todos os invariantes obrigatórios possuem IDs únicos e estáveis', () => {
  assert.deepEqual(invariantIds, expectedInvariantIds);
  assert.equal(new Set(invariantIds).size, invariantIds.length);

  for (const invariant of contract.invariants) {
    assert.ok(invariant.title?.trim(), `${invariant.id} sem título`);
    assert.ok(invariant.rule?.trim(), `${invariant.id} sem regra`);
  }
});

test('matriz cobre todas as mutações de ciclo de vida previstas', () => {
  for (const id of requiredOperationIds) {
    assert.ok(operationIds.includes(id), `Operação obrigatória ausente: ${id}`);
  }
  assert.equal(new Set(operationIds).size, operationIds.length);
});

test('toda operação permitida que altera NS exige coerência atômica de lock', () => {
  const allowedOperations = contract.operations.filter((operation) => operation.allowed);
  assert.ok(allowedOperations.length > 0);

  for (const operation of allowedOperations) {
    assert.equal(
      operation.requiresAtomicLockUpdate,
      true,
      `${operation.id} deve exigir atualização atômica de lock`
    );
    assert.ok(operation.preconditions.length > 0, `${operation.id} sem pré-condições`);
    assert.ok(operation.postconditions.length > 0, `${operation.id} sem pós-condições`);
  }
});

test('bypasses explícitos permanecem proibidos pelo contrato', () => {
  const directWrite = contract.operations.find(
    (operation) => operation.id === 'direct_numero_ns_write_without_integrity_service'
  );
  const orphanDelete = contract.operations.find(
    (operation) => operation.id === 'delete_lock_without_owner_transition'
  );

  assert.equal(directWrite?.allowed, false);
  assert.equal(orphanDelete?.allowed, false);
});

test('gaps conhecidos são únicos e os de alta severidade possuem bloco de resolução', () => {
  assert.equal(new Set(gapIds).size, gapIds.length);
  const resolutionEntries = Object.values(contract.plannedResolution).flat();

  for (const gap of contract.knownGaps) {
    assert.ok(/^GAP-\d{3}$/.test(gap.id), `ID de gap inválido: ${gap.id}`);
    assert.ok(['high', 'medium', 'low'].includes(gap.severity), `Severidade inválida: ${gap.id}`);
    assert.ok(gap.description?.trim(), `${gap.id} sem descrição`);

    if (gap.severity === 'high') {
      assert.ok(
        resolutionEntries.includes(gap.id),
        `${gap.id} de alta severidade não possui bloco planejado`
      );
    }
  }
});

test('plano de resolução referencia somente invariantes e gaps declarados', () => {
  const knownReferences = new Set([...invariantIds, ...gapIds]);

  for (const [block, references] of Object.entries(contract.plannedResolution)) {
    assert.ok(/^block\d+$/.test(block), `Bloco inválido: ${block}`);
    assert.ok(Array.isArray(references) && references.length > 0, `${block} sem referências`);

    for (const reference of references) {
      assert.ok(knownReferences.has(reference), `${block} referencia item desconhecido: ${reference}`);
    }
  }
});

test('formatos congelados permanecem explícitos', () => {
  assert.equal(contract.formats.numeroNS, 'AAAANSNNNNNN');
  assert.equal(contract.formats.ug, 'NNNNNN');
  assert.equal(contract.formats.supplierCnpj, '14_digits_normalized');
  assert.equal(contract.formats.invoiceRecordKey, 'nf_<cnpj>_<numero_nf_normalizado>');
});
