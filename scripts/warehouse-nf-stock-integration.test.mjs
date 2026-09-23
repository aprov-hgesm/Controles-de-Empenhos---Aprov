import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const outDir = mkdtempSync(resolve(tmpdir(), 'emprovex-phase4-domain-'));

execFileSync(
  process.execPath,
  [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    resolve(root, 'lib/warehouse/invoiceIntegration.ts'),
    resolve(root, 'lib/warehouse/material.ts'),
    resolve(root, 'lib/warehouse/movement.ts'),
    resolve(root, 'lib/platformIdentity.ts'),
    resolve(root, 'lib/types.ts'),
    '--outDir',
    outDir,
    '--module',
    'commonjs',
    '--target',
    'es2022',
    '--moduleResolution',
    'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--lib',
    'es2022,dom',
  ],
  { cwd: root, stdio: 'pipe' }
);

const require = createRequire(import.meta.url);
const integration = require(resolve(outDir, 'warehouse/invoiceIntegration.js'));
const movement = require(resolve(outDir, 'warehouse/movement.js'));

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const materialA = 'mat_' + 'a'.repeat(32);

function invoice({
  quantity = 10,
  integrated = true,
  materialId = materialA,
  revision = 1,
} = {}) {
  return {
    id: '12345',
    empenhoId: '2026NE001',
    issueDate: '2026-09-23',
    registeredAt: '2026-09-23T15:00:00.000Z',
    supplier: 'Fornecedor Teste',
    supplierCnpj: '12345678000199',
    items: [
      {
        itemId: '00001',
        quantity,
        unitPrice: 5,
        subtotal: quantity * 5,
        ...(materialId ? { warehouseMaterialId: materialId } : {}),
      },
    ],
    totalValue: quantity * 5,
    ...(integrated
      ? {
          warehouseIntegration: {
            schemaVersion: 'warehouse_invoice_link_v1',
            status: 'integrated',
            workspaceId: 'hgesm-aprov',
            cutoffAt: '2026-09-23T15:00:00.000Z',
            revision,
            lastMovementIds: [],
          },
        }
      : {}),
  };
}

test('deriva material estável por workspace + empenho + item sem usar descrição textual', async () => {
  const first = await integration.deriveWarehouseMaterialIdForEmpenhoItem(
    'hgesm-aprov',
    '2026NE001',
    '00001'
  );
  const repeat = await integration.deriveWarehouseMaterialIdForEmpenhoItem(
    'hgesm-aprov',
    '2026NE001',
    '00001'
  );
  const otherItem = await integration.deriveWarehouseMaterialIdForEmpenhoItem(
    'hgesm-aprov',
    '2026NE001',
    '00002'
  );

  assert.equal(first, repeat);
  assert.notEqual(first, otherItem);
  assert.match(first, /^mat_[a-f0-9]{32}$/);
});

test('normaliza apresentações conhecidas e preserva apresentação desconhecida', () => {
  assert.deepEqual(integration.warehouseUnitFromOperationalLabel('KG'), {
    code: 'kg',
    label: null,
  });
  assert.deepEqual(integration.warehouseUnitFromOperationalLabel('CX'), {
    code: 'box',
    label: null,
  });
  assert.deepEqual(integration.warehouseUnitFromOperationalLabel('Bandeja 12 un'), {
    code: 'other',
    label: 'Bandeja 12 un',
  });
});

test('NF nova produz uma única INVOICE_ENTRY positiva', () => {
  const next = invoice({ integrated: false });
  const plans = integration.buildWarehouseInvoiceMovementPlans(null, next);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].movementType, 'INVOICE_ENTRY');
  assert.equal(plans[0].action, 'ENTRY');
  assert.equal(plans[0].quantityDelta, 10);
  assert.equal(plans[0].materialId, materialA);
});

test('edição de NF integrada produz somente delta compensatório', () => {
  const previous = invoice({ quantity: 10, integrated: true, revision: 1 });
  const next = invoice({ quantity: 13, integrated: false });
  const plans = integration.buildWarehouseInvoiceMovementPlans(previous, next);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].movementType, 'INVOICE_CORRECTION');
  assert.equal(plans[0].action, 'CORRECTION');
  assert.equal(plans[0].oldQuantity, 10);
  assert.equal(plans[0].newQuantity, 13);
  assert.equal(plans[0].quantityDelta, 3);
});

test('exclusão de NF integrada gera estorno controlado do saldo atual', () => {
  const previous = invoice({ quantity: 8, integrated: true, revision: 3 });
  const plans = integration.buildWarehouseInvoiceMovementPlans(previous, null);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].movementType, 'INVOICE_CORRECTION');
  assert.equal(plans[0].action, 'DELETE');
  assert.equal(plans[0].quantityDelta, -8);
});

test('mesmo estado lógico produz a mesma identidade idempotente de movimento', async () => {
  const plan = integration.buildWarehouseInvoiceMovementPlans(
    invoice({ quantity: 10, integrated: true }),
    invoice({ quantity: 12, integrated: false })
  )[0];
  const keyA = integration.buildWarehouseInvoiceIdempotencyKey({
    invoiceRecordKey: '12345678000199__12345',
    integrationRevision: 2,
    plan,
  });
  const keyB = integration.buildWarehouseInvoiceIdempotencyKey({
    invoiceRecordKey: '12345678000199__12345',
    integrationRevision: 2,
    plan,
  });
  assert.equal(keyA, keyB);
  assert.equal(
    await movement.createWarehouseMovementId('hgesm-aprov', keyA),
    await movement.createWarehouseMovementId('hgesm-aprov', keyB)
  );
});

test('cutoff impede backfill silencioso de NF histórica', () => {
  assert.equal(
    integration.isInvoiceOnOrAfterWarehouseCutoff(
      '2026-09-22T23:59:59.999Z',
      '2026-09-23T00:00:00.000Z'
    ),
    false
  );
  assert.equal(
    integration.isInvoiceOnOrAfterWarehouseCutoff(
      '2026-09-23T00:00:00.000Z',
      '2026-09-23T00:00:00.000Z'
    ),
    true
  );
});
