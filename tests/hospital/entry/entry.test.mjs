import test from 'node:test';
import assert from 'node:assert/strict';

import { HospitalQAStore } from '../../../lib/server/hospital/core/qa-store.mjs';
import { authorizeHospitalEntry } from '../../../features/hospital/entry/authorize.mjs';

function fixtures() {
  const store = new HospitalQAStore({ filename: ':memory:', qa: true });
  for (const [id, ug] of [['hospital-a', '160416'], ['hospital-b', '160999']]) {
    store.seedOrganization({
      id, ug, name: 'Hospital QA sintético', timezone: 'America/Sao_Paulo', active: true,
    });
  }
  for (const [id, org, ug, uid, roles, unitIds, active] of [
    ['m-unit', 'hospital-a', '160416', 'uid-unit', ['UNIT'], ['uti-a'], true],
    ['m-kitchen', 'hospital-a', '160416', 'uid-kitchen', ['KITCHEN'], ['cozinha-a'], true],
    ['m-nutrition', 'hospital-a', '160416', 'uid-nutri', ['NUTRITION'], ['uti-a'], true],
    ['m-admin', 'hospital-a', '160416', 'uid-admin', ['HOSPITAL_ADMIN'], [], true],
    ['m-empty', 'hospital-a', '160416', 'uid-empty', ['UNIT'], [], true],
    ['m-revoked', 'hospital-a', '160416', 'uid-revoked', ['UNIT'], ['upi-a'], false],
    ['m-other', 'hospital-b', '160999', 'uid-other', ['UNIT'], ['uti-b'], true],
  ]) {
    store.seedMembership({ id, organizationId: org, ug, uid, roles, unitIds, active });
  }
  const verifyToken = async token => {
    if (token === 'bad') throw new Error('invalid token');
    return { uid: token };
  };
  const grant = (uid, organizationId = 'hospital-a') =>
    authorizeHospitalEntry({ authorization: `Bearer ${uid}`, organizationId, store, verifyToken });
  return { store, grant };
}

test('UNIT member authorized after server verification; no patient data returned', async t => {
  const { store, grant } = fixtures(); t.after(() => store.close());
  const result = await grant('uid-unit');
  assert.deepEqual(result.roles, ['UNIT']);
  assert.equal(result.unitCount, 1);
  assert.equal(result.canOpenClinicalWorkspace, true);
  assert.deepEqual(Object.keys(result).sort(), ['canOpenClinicalWorkspace', 'roles', 'unitCount']);
});

test('KITCHEN and NUTRITION have independent valid entry', async t => {
  const { store, grant } = fixtures(); t.after(() => store.close());
  assert.deepEqual((await grant('uid-kitchen')).roles, ['KITCHEN']);
  assert.deepEqual((await grant('uid-nutri')).roles, ['NUTRITION']);
});

test('hospital admin can manage but cannot open clinical workspace by default', async t => {
  const { store, grant } = fixtures(); t.after(() => store.close());
  const result = await grant('uid-admin');
  assert.equal(result.canOpenClinicalWorkspace, false);
});

test('UID of another OM is denied even with valid token', async t => {
  const { store, grant } = fixtures(); t.after(() => store.close());
  await assert.rejects(grant('uid-other', 'hospital-a'), error => error.code === 'FORBIDDEN');
  assert.deepEqual((await grant('uid-other', 'hospital-b')).roles, ['UNIT']);
});

test('inactive membership and unknown account are denied', async t => {
  const { store, grant } = fixtures(); t.after(() => store.close());
  for (const uid of ['uid-revoked', 'uid-unknown']) {
    await assert.rejects(grant(uid), error => error.code === 'FORBIDDEN');
  }
});

test('unit-scoped roles with no authorized unit are denied', async t => {
  const { store, grant } = fixtures(); t.after(() => store.close());
  await assert.rejects(grant('uid-empty'), error => error.code === 'FORBIDDEN');
});

test('invalid or missing token never becomes an authorized hospital scope', async t => {
  const { store, grant } = fixtures(); t.after(() => store.close());
  await assert.rejects(grant('bad'), error => error.code === 'UNAUTHORIZED');
  await assert.rejects(
    authorizeHospitalEntry({ authorization: '', organizationId: 'hospital-a', store }),
    error => error.code === 'UNAUTHORIZED'
  );
});

test('failed authorization cannot expose a membership by choosing another organization', async t => {
  const { store, grant } = fixtures(); t.after(() => store.close());
  await assert.rejects(grant('uid-unit', 'hospital-b'), error => error.code === 'FORBIDDEN');
});
