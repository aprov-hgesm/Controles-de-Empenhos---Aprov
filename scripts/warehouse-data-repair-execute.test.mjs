import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  APPLY_CONFIRMATION,
  REPAIR_ID,
  TARGETS,
  assertApplyConfirmation,
  assertPostRepair,
  encodeNumericLike,
  extractJsonBlock,
  parseFlags,
  parseStreamingJson,
  validateAuthorizedPlan,
} from './warehouse-data-repair-execute.mjs';

const here = dirname(fileURLToPath(import.meta.url));

test('flags e confirmação de apply são fail-closed', () => {
  assert.deepEqual(parseFlags(['--apply', '--x=y']), { apply: true, x: 'y' });
  assert.throws(() => assertApplyConfirmation({}), /confirmação explícita/);
  assert.doesNotThrow(() =>
    assertApplyConfirmation({
      'confirm-repair-id': REPAIR_ID,
      'confirm-write': APPLY_CONFIRMATION,
    })
  );
});

test('allowlist fixa exatamente os dois repairs autorizados', () => {
  assert.equal(TARGETS.length, 2);
  assert.deepEqual(
    TARGETS.map((row) => [row.lotId, row.beforeQuantity, row.afterQuantity]),
    [
      ['lot_670e1ca177804501b90bf8cdd669683f', 440, 340],
      ['lot_082ebcd7a2acf0c706c87464307cb1ff', 50, 40],
    ]
  );
});

test('encodeNumericLike preserva tipo numérico Firestore', () => {
  assert.deepEqual(encodeNumericLike({ integerValue: '440' }, 340), {
    integerValue: '340',
  });
  assert.deepEqual(encodeNumericLike({ doubleValue: 440 }, 340), {
    doubleValue: 340,
  });
  assert.throws(() => encodeNumericLike({ stringValue: '440' }, 340), /Tipo numérico inesperado/);
});

test('parser aceita JSON normal e resposta streaming', () => {
  assert.deepEqual(parseStreamingJson('{"a":1}'), [{ a: 1 }]);
  assert.deepEqual(parseStreamingJson('{"a":1}\n{"b":2}'), [{ a: 1 }, { b: 2 }]);
  assert.deepEqual(
    extractJsonBlock('x\nBEGIN\n{"ok":true}\nEND\ny', 'BEGIN', 'END'),
    { ok: true }
  );
});

test('plano só aceita os dois candidatos causalmente autorizados', () => {
  const candidates = TARGETS.map((target) => ({
    path: target.path,
    materialId: target.materialId,
    before: { quantity: target.beforeQuantity },
    after: { quantity: target.afterQuantity },
    cause: target.cause,
    preconditions: { expectedLotUpdatedAt: '2026-10-06T00:00:00Z' },
  }));
  const plan = validateAuthorizedPlan(
    {
      readyForHumanRepairAuthorization: true,
      repairManifest: { candidates },
    },
    { cappedCollections: [] }
  );
  assert.equal(plan.length, 2);

  assert.throws(
    () =>
      validateAuthorizedPlan(
        {
          readyForHumanRepairAuthorization: true,
          repairManifest: {
            candidates: [
              ...candidates,
              {
                path: 'warehouse/hgesm-aprov/lots/lot_unauthorized',
                materialId: 'x',
                before: { quantity: 1 },
                after: { quantity: 0 },
                cause: 'x',
                preconditions: { expectedLotUpdatedAt: 't' },
              },
            ],
          },
        },
        { cappedCollections: [] }
      ),
    /número inesperado|allowlist/
  );
});

test('validação pós-repair exige os estados quantitativos aprovados', () => {
  const report = {
    results: [
      {
        materialId: 'mat_272f2d996ee65ed3530ad2d7e27b66d7',
        aggregate: 445,
        physicalActive: 440,
        legacyUnassigned: 5,
        activeLotQuantity: 440,
        lotExcess: 0,
      },
      {
        materialId: 'mat_6feb0840ca4060f7d69fcce1663f21b8',
        aggregate: 90,
        physicalActive: 90,
        legacyUnassigned: 0,
        activeLotQuantity: 90,
        lotExcess: 0,
      },
    ],
  };
  assert.equal(assertPostRepair(report, { cappedCollections: [] }).length, 2);

  report.results[1].activeLotQuantity = 100;
  assert.throws(
    () => assertPostRepair(report, { cappedCollections: [] }),
    /POST-REPAIR VALIDATION FAILURE/
  );
});

test('guard estático limita escrita ao commit Firestore e preserva ledger/rules fora do executor', () => {
  const source = readFileSync(
    resolve(here, 'warehouse-data-repair-execute.mjs'),
    'utf8'
  );
  assert.match(source, /documents:commit/);
  assert.match(source, /lot_670e1ca177804501b90bf8cdd669683f/);
  assert.match(source, /lot_082ebcd7a2acf0c706c87464307cb1ff/);
  assert.doesNotMatch(source, /method:\s*['"](?:PUT|PATCH|DELETE)['"]/);
  assert.doesNotMatch(source, /:batchWrite\b/);
  assert.doesNotMatch(source, /firebase-admin|firebase\/firestore/);
  assert.doesNotMatch(source, /firestore\.rules.*write|firestore\.warehouse\.rules.*write/);
});
