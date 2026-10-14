import test from 'node:test';
import assert from 'node:assert/strict';
import { assertQaIsolation } from './rc-r1-qa-isolation.mjs';
const safe={NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS:'1',NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID:'demo-emprovex-security'};
test('safe local demo config',()=>assert.equal(assertQaIsolation(safe),true));
for (const [name, patch] of [
 ['foreign project',{FIREBASE_PROJECT_ID:'real-project'}],
 ['remote URL',{EMPROVEX_E2E_BASE_URL:'https://example.com'}],
 ['remote Firestore',{FIRESTORE_EMULATOR_HOST:'10.0.0.1:8080'}],
 ['deploy token',{FIREBASE_TOKEN:'synthetic-token'}],
 ['disabled emulator',{NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS:'0'}]
]) test('fail-closed: '+name,()=>assert.throws(()=>assertQaIsolation({...safe,...patch}),/ISOLATION_BLOCKED/));
