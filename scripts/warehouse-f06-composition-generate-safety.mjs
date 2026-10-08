#!/usr/bin/env node
// Generate an ADVERSARIAL companion suite from the exact original W6 fixture.
// The canonical nine F06 tests are not edited or replaced.
import { readFileSync, writeFileSync } from 'node:fs';
const original = readFileSync('scripts/warehouse-f06-transaction-emulator.test.mjs','utf8');
const marker = "  const final = await snapshot('materials', fixtureId(1));";
if (original.split(marker).length !== 2
    || !original.includes("await t.test('same-key concurrent calls commit once'")
    || !original.includes("await t.test('different-key concurrency cannot overdraw")) {
  throw new Error('COMPOSITION_SAFETY_W6_FIXTURE_ANCHOR_MISMATCH');
}
const extra = `
  await t.test('revoked session cannot transfer even if previously authorized', async () => {
    const f = await fixture(11, 3);
    await signOut(auth);
    await assert.rejects(
      () => transferWarehouseStock(WORKSPACE_ID, input(f,'revoked',1)),
      /WAREHOUSE_LOCATION_AUTH_REQUIRED/
    );
    await signInWithCredential(auth, GoogleAuthProvider.credential(
      JSON.stringify({ sub: 'f06-founder-emulator', email: OWNER_EMAIL, email_verified: true })
    ));
    await assertState(f, 3, 0, 0);
  });

  await t.test('reading a material does not authorize malformed movement writes', async () => {
    const f = await fixture(12, 3);
    const { getDocFromServer, setDoc } = require('firebase/firestore');
    const material = await getDocFromServer(doc(warehouseDb, pathFor('materials', f.materialId)));
    assert.equal(material.exists(), true);
    const badMovementId = 'mov_' + 'f'.repeat(64);
    await assert.rejects(
      () => setDoc(doc(warehouseDb, pathFor('movements', badMovementId)),
        { schemaVersion:'warehouse_movement_v1', id:badMovementId,
          workspaceId:WORKSPACE_ID, ug:UG, materialId:f.materialId,
          type:'TRANSFER', quantityDelta:0 }),
      error => error?.code === 'permission-denied'
    );
    await assertState(f, 3, 0, 0);
  });

  await t.test('offline server proof fails closed instead of using cache', async () => {
    const f = await fixture(13, 4);
    const { disableNetwork, enableNetwork, getDocFromServer } = require('firebase/firestore');
    await disableNetwork(warehouseDb);
    try {
      await assert.rejects(
        () => getDocFromServer(doc(warehouseDb, pathFor('materials', f.materialId))),
        error => error?.code === 'unavailable'
      );
    } finally {
      await enableNetwork(warehouseDb);
    }
    await assertState(f, 4, 0, 0);
  });

  await t.test('three different-key concurrent transfers conserve quantity without partial commit', async () => {
    const f = await fixture(14, 10);
    const attempts = await Promise.allSettled(['triple-A','triple-B','triple-C']
      .map(key => transferWarehouseStock(WORKSPACE_ID, input(f, key, 7))));
    const applied = attempts.filter(x => x.status === 'fulfilled' && x.value.applied === true);
    assert.equal(applied.length, 1, JSON.stringify(attempts));
    const losers = attempts.filter(x => x.status === 'rejected');
    assert.equal(losers.length, 2, JSON.stringify(attempts));
    for (const result of losers) {
      // No unrelated PERMISSION_DENIED may be normalized as insufficient.
      assert.match(String(result.reason), /WAREHOUSE_TRANSFER_INSUFFICIENT_STOCK/);
    }
    await assertState(f, 3, 7, 1);
  });

`;
writeFileSync('scripts/warehouse-f06-composition-security.test.mjs',original.replace(marker,extra+marker));
console.log('COMPOSITION_SAFETY_ORIGINAL_9_ASSERTIONS_UNMODIFIED; +4 adversarial tests generated');
