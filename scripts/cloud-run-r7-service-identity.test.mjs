import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCloudRunRuntime,
  getCloudRunAccessToken,
  resetCloudRunTokenCacheForTests,
} from '../lib/server/cloudRunServiceIdentity.mjs';

const env = Object.freeze({ K_SERVICE: 'emprovex-staging', K_REVISION: 'emprovex-staging-00001' });
const token = 'test-only-access-token-not-a-real-secret';
const ok = (value = token, expires = 3599) =>
  ({ ok: true, json: async () => ({ access_token: value, expires_in: expires }) });

test('R7: service identity only inside Cloud Run', () => {
  assert.equal(isCloudRunRuntime({}), false);
  assert.equal(isCloudRunRuntime({ K_SERVICE: 'a' }), false);
  assert.equal(isCloudRunRuntime(env), true);
});

test('R7: rejects non-Cloud-Run callers without fetching or falling back to a key', async () => {
  resetCloudRunTokenCacheForTests();
  let count = 0;
  await assert.rejects(
    getCloudRunAccessToken({ env: { FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON: 'private-key' }, fetchImpl: async () => { count++; return ok(); } }),
    /NOT_AVAILABLE/
  );
  assert.equal(count, 0);
});

test('R7: metadata host and header fixed, token cached and refreshed', async () => {
  resetCloudRunTokenCacheForTests();
  const requests = [];
  let timestamp = 1000;
  let runs = 0;
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    runs++;
    return ok(token + runs, 120);
  };
  const first = await getCloudRunAccessToken({env,fetchImpl,now:()=>timestamp});
  const again = await getCloudRunAccessToken({env,fetchImpl,now:()=>timestamp+1000});
  assert.equal(first,again);
  assert.equal(runs,1);
  assert.equal(requests[0].url,
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token');
  assert.equal(requests[0].options.headers['Metadata-Flavor'],'Google');
  timestamp=71000;
  const refreshed = await getCloudRunAccessToken({env,fetchImpl,now:()=>timestamp});
  assert.notEqual(refreshed, first);
  assert.equal(runs,2);
});

test('R7: rejects metadata HTTP errors and malformed tokens',async()=>{
  resetCloudRunTokenCacheForTests();
  await assert.rejects(getCloudRunAccessToken({env,fetchImpl:async()=>({ok:false,status:503})}),/UNAVAILABLE/);
  await assert.rejects(getCloudRunAccessToken({env,fetchImpl:async()=>ok('short')}),/INVALID_TOKEN/);
  await assert.rejects(getCloudRunAccessToken({env,fetchImpl:async()=>ok(token, 10)}),/INVALID_TOKEN/);
});

test('R7: old Vercel environment must not accidentally enable service identity',()=>{
  assert.equal(isCloudRunRuntime({VERCEL:'1',VERCEL_ENV:'production'}),false);
});
