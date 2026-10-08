import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileDifferentKeyConcurrency } from './warehouse-f06-different-key-reconcile.mjs';

const sourcePosition = { kind: 'LOCATION', depotId: 'dep', locationId: 'origin', subpositionId: null };
const destPosition = { kind: 'LOCATION', depotId: 'dep', locationId: 'destination', subpositionId: null };
const a = 'mov_' + 'a'.repeat(64);
const b = 'mov_' + 'b'.repeat(64);
const denied = new Error('7 PERMISSION_DENIED: Unable to evaluate the expression as the maximum of 1000 expressions to evaluate has been reached.');
const fixture = () => ({
  attempts: [{ status: 'fulfilled', value: { applied: true } }, { status: 'rejected', reason: denied }],
  keys: [{ movementId: a }, { movementId: b }],
  requestQuantity: 7, startingQuantity: 10, workspaceId: 'w', ug: '160416',
  uid: 'u', materialId: 'mat', from: sourcePosition, to: destPosition,
  fromBalanceId: 'from', toBalanceId: 'to',
});
const evidence = () => ({
  source: { id: 'from', workspaceId: 'w', ug: '160416', materialId: 'mat',
    position: sourcePosition, revision: 2, quantity: 3, lastMovementId: a },
  destination: { id: 'to', workspaceId: 'w', ug: '160416', materialId: 'mat',
    position: destPosition, revision: 1, quantity: 7, lastMovementId: a },
  aggregate: { workspaceId: 'w', ug: '160416', materialId: 'mat', revision: 1, quantity: 10 },
  movements: [{
    id: a, schemaVersion: 'warehouse_movement_v1', workspaceId: 'w', ug: '160416',
    materialId: 'mat', type: 'TRANSFER', quantityDelta: 0, idempotencyKeyHash: a.slice(4),
    source: { kind: 'LOCATION_TRANSFER', actorUid: 'u', quantity: 7,
      fromBalanceId: 'from', toBalanceId: 'to', from: sourcePosition, to: destPosition },
  }, null],
  ledger: [{ id: a }],
});

test('verified winning commit and 3+7 conservation classify losing race as insufficient', async () => {
  let reads = 0;
  const base = fixture();
  const result = await reconcileDifferentKeyConcurrency({
    ...base, loadEvidence: async () => { reads++; return evidence(); },
  });
  assert.equal(reads, 1, 'one bounded evidence batch');
  assert.equal(result[0], base.attempts[0]);
  assert.equal(result[1].status, 'rejected');
  assert.match(String(result[1].reason), /WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK/);
});
for (const [name, change] of [
  ['missing winning movement', e => { e.movements[0] = null; }],
  ['losing movement committed', e => { e.movements[1] = { id: b }; }],
  ['ledger has more than one movement', e => { e.ledger.push({ id: b }); }],
  ['wrong source revision', e => { e.source.revision = 1; }],
  ['missing winning source lastMovementId', e => { e.source.lastMovementId = b; }],
  ['wrong destination revision', e => { e.destination.revision = 2; }],
  ['negative destination', e => { e.destination.quantity = -7; }],
  ['insufficient but without conservation', e => { e.destination.quantity = 5; }],
  ['altered movement actor', e => { e.movements[0].source.actorUid = 'intruder'; }],
  ['altered movement quantity', e => { e.movements[0].source.quantity = 6; }],
  ['altered position', e => { e.movements[0].source.to = sourcePosition; }],
  ['aggregate changed', e => { e.aggregate.quantity = 9; }],
]) {
  test('refuses to reclassify: ' + name, async () => {
    const base = fixture(), e = evidence();
    change(e);
    const result = await reconcileDifferentKeyConcurrency({ ...base, loadEvidence: async () => e });
    assert.equal(result, base.attempts);
    assert.equal(result[1].reason, denied);
  });
}
test('unrelated permission-denied must stay unchanged without reads', async () => {
  const base = fixture();
  base.attempts[1].reason = new Error('PERMISSION_DENIED: access genuinely prohibited');
  const result = await reconcileDifferentKeyConcurrency({
    ...base, loadEvidence: async () => { throw new Error('no read should occur'); },
  });
  assert.equal(result, base.attempts);
});
test('fail-closed on fresh read failure', async () => {
  const base = fixture();
  const result = await reconcileDifferentKeyConcurrency({
    ...base, loadEvidence: async () => { throw new Error('permission-denied'); },
  });
  assert.equal(result, base.attempts);
});
test('fail-closed when both calls fail or both succeed', async () => {
  for (const attempts of [
    [{ status: 'rejected', reason: denied }, { status: 'rejected', reason: denied }],
    [{ status: 'fulfilled', value: { applied: true } }, { status: 'fulfilled', value: { applied: true } }],
  ]) {
    const base = fixture();
    const result = await reconcileDifferentKeyConcurrency({
      ...base, attempts, loadEvidence: async () => evidence(),
    });
    assert.equal(result, attempts);
  }
});
