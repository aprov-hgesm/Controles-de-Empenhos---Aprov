import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

/** Test the exact Firestore StructuredQuery emitted by the production helper.
 * All writes/reads target a temporary FIRESTORE EMULATOR project, not the real
 * EMPROVEX Firebase project, and require no service account.
 */
const projectId = 'demo-billing-efficiency';
const databaseId = '(default)';
const emulator = process.env.FIRESTORE_EMULATOR_HOST;
if (!emulator) throw new Error('FIRESTORE_EMULATOR_HOST required (never run against real Firestore)');
if (!/^(localhost|127\.0\.0\.1):\d+$/.test(emulator)) throw new Error('External Firestore host forbidden');
const root = `http://${emulator}/v1/projects/${projectId}/databases/${databaseId}/documents`;

const source = readFileSync('lib/server/billingRecentCycles.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const exports = {};
vm.runInNewContext(compiled, {
  exports,
  require(name) {
    if (name === '../../firebase-applet-config.json') return { projectId, firestoreDatabaseId: databaseId };
    if (name === './sectorProvisioningAdmin') return { getGoogleAccessToken: () => { throw Error('No credentials allowed'); } };
    throw Error('Unexpected import ' + name);
  },
  fetch, URL,
});
const { buildBillingHistoryQuery } = exports;

async function writeCycle(workspaceId, month) {
  const name = `${workspaceId}__${month}`;
  const response = await fetch(`${root}/billingCycles/${name}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: {
      workspaceId: { stringValue: workspaceId },
      referenceMonth: { stringValue: month },
      amountCents: { integerValue: '7000' },
      dueDate: { stringValue: month + '-05' },
      status: { stringValue: 'pending' },
    } }),
  });
  assert.equal(response.ok, true, `Failed to seed emulator document ${name}: ${response.status}`);
}

async function queryHistory(id) {
  const query = buildBillingHistoryQuery(id, projectId, databaseId);
  const response = await fetch(root + ':runQuery', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify(query),
  });
  if (!response.ok) throw new Error('Firestore emulator rejected the structured query: ' + (await response.text()));
  const rows = await response.json();
  return rows.filter((row) => row.document).map((row) => ({
    name: decodeURIComponent(row.document.name.split('/').at(-1)),
    month: row.document.fields?.referenceMonth?.stringValue,
    workspaceId: row.document.fields?.workspaceId?.stringValue,
  }));
}

test('real Firestore emulator guarantees the newest 24 canonical monthly records without tenant leakage', async () => {
  const months = Array.from({ length: 36 }, (_, i) =>
    new Date(Date.UTC(2023, i, 1)).toISOString().slice(0, 7));
  await Promise.all(months.map((month) => writeCycle('workspace-a', month)));
  await Promise.all(months.slice(0, 12).map((month) => writeCycle('workspace-b', month)));
  const own = await queryHistory('workspace-a');
  assert.equal(own.length, 24);
  assert.deepEqual(own.map((x) => x.month), [...months].sort().reverse().slice(0, 24));
  assert.ok(own.every((x) => x.workspaceId === 'workspace-a' && x.name.startsWith('workspace-a__')));
  const other = await queryHistory('workspace-b');
  assert.equal(other.length, 12);
  assert.ok(other.every((x) => x.workspaceId === 'workspace-b' && x.name.startsWith('workspace-b__')));
});

test('query rejects malformed or cross-tenant workspace identifiers before network access', () => {
  for (const value of ['a/b', '', 'NOT_ALLOWED', '../other', 'space A']) {
    assert.throws(() => buildBillingHistoryQuery(value, projectId, databaseId), /INVALID_HISTORY_WORKSPACE/);
  }
});

test('query orders by indexed document identity before limit; no compound filter on workspace fields', () => {
  const query = buildBillingHistoryQuery('workspace-a', projectId, databaseId).structuredQuery;
  assert.equal(query.limit, 24);
  assert.equal(query.orderBy[0].field.fieldPath, '__name__');
  assert.equal(query.orderBy[0].direction, 'DESCENDING');
  assert.equal(query.where.compositeFilter.filters.length, 2);
  assert.ok(query.where.compositeFilter.filters.every((f) => f.fieldFilter.field.fieldPath === '__name__'));
});
