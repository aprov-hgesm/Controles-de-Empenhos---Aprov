import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/controle-credito/creditBalance.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2017 } }).outputText;
const { calculateCreditBalance: balance, creditAlerts, HGESM_COST_CENTERS } = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));
const share = (centerId, basisPoints) => ({ centerId, basisPoints });
const ne = (id, centerId, netCents) => ({ id, centerId, netCents });

test('five centers share equally, not four', () => {
  const result = balance(10_000_000, HGESM_COST_CENTERS.map(c => share(c.id, 2000)), []);
  assert.equal(result.centers.length, 5);
  assert.ok(result.centers.every(c => c.allocatedCents === 2_000_000));
  assert.equal(result.unallocatedCents, 0);
});
test('asymmetric allocation and NE reduce the global and sector balances', () => {
  const result = balance(10_000_000, [share('APROV', 5000), share('ALMOX', 2000), share('FARM', 1000), share('ODONTO', 1500), share('LAC', 500)], [ne('160416-2026NE000001', 'APROV', 500_000)]);
  assert.equal(result.availableCents, 9_500_000);
  assert.equal(result.centers.find(c => c.centerId === 'APROV').availableCents, 4_500_000);
  assert.equal(result.commitmentCount, 1);
});
test('partial allocation and deterministic cent rounding conserve total', () => {
  const result = balance(101, [share('A', 3333), share('B', 3333)], []);
  assert.equal(result.unallocatedBasisPoints, 3334);
  assert.equal(result.centers.reduce((s, c) => s + c.allocatedCents, 0) + result.unallocatedCents, 101);
  assert.deepEqual(result, balance(101, [share('B', 3333), share('A', 3333)], []));
});
test('reallocation preserves existing commitments and exposes deficits', () => {
  const result = balance(1_000_000, [share('ALMOX', 10000)], [ne('NE1', 'APROV', 300_000)]);
  assert.equal(result.centers.find(c => c.centerId === 'APROV').availableCents, -300_000);
  assert.deepEqual(result.overdrawnCenterIds, ['APROV']);
  assert.equal(result.availableCents, 700_000);
});
test('duplicate NEs and invalid rateio rejected', () => {
  assert.throws(() => balance(100, [share('A', 10001)], []));
  assert.throws(() => balance(100, [share('A', 5000), share('A', 5000)], []));
  assert.throws(() => balance(100, [], [ne('NE1', 'A', 5), ne('NE1', 'A', 5)]));
  assert.throws(() => balance(100, [], [ne('NE1', 'A', -5)]));
  assert.throws(() => balance(100.5, [], []));
});
test('overcommitment is visible, never silently clamped', () => {
  const result = balance(100, [share('A', 10000)], [ne('NE1', 'A', 110)]);
  assert.equal(result.availableCents, -10);
  assert.equal(result.overdrawn, true);
});
test('alerts distinguish overdue, due today, imminent and missing deadlines', () => {
  assert.equal(creditAlerts(10, 0, '2026-11-23', '2026-11-24').overdue, true);
  assert.equal(creditAlerts(10, 0, '2026-11-24', '2026-11-24').dueToday, true);
  assert.equal(creditAlerts(10, 0, '2026-12-01', '2026-11-24').dueWithinSevenDays, true);
  assert.equal(creditAlerts(10, 0, null, '2026-11-24').deadlineMissing, true);
  assert.equal(creditAlerts(0, 1, '2026-11-23', '2026-11-24').overdue, false);
  assert.equal(creditAlerts(10, 0, null, '2026-11-24').noCommitments, true);
  assert.throws(() => creditAlerts(10, 0, '2026-02-30', '2026-11-24'));
});
