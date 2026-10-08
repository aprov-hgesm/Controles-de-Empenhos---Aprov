#!/usr/bin/env node
// Firestore Emulator only. Exercises the same REST documents:commit and
// currentDocument preconditions as the administrative F05 path.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'FIRESTORE_EMULATOR_HOST required; never run against Production');
const host = process.env.FIRESTORE_EMULATOR_HOST;
assert.match(host, /^(127\.0\.0\.1|localhost):\d+$/, 'Local emulator only');
const project = process.env.GCLOUD_PROJECT || 'demo-emprovex-f05';
assert.ok(project.startsWith('demo-'), 'Test projects only');
const database = '(default)';
const prefix = `http://${host}/v1/projects/${project}/databases/${encodeURIComponent(database)}/documents`;
const root = 'warehouse/f05-' + randomUUID().replaceAll('-', '');
const path = (name) => `${root}/${name}`;
const full = (name) => `projects/${project}/databases/${database}/documents/${path(name)}`;
const encode = (v) => typeof v === 'number' ? { integerValue: String(v) } : { stringValue: v };
const values = (data) => Object.fromEntries(Object.entries(data).map(([k,v]) => [k,encode(v)]));
async function read(name) {
  const response = await fetch(prefix + '/' + path(name), {headers:{authorization:'Bearer owner'}});
  if (response.status === 404) return null;
  assert.equal(response.status,200,await response.text());
  return response.json();
}
async function commit(writes) {
  const response = await fetch(prefix+':commit', {method:'POST',headers:{'content-type':'application/json',authorization:'Bearer owner'},body:JSON.stringify({writes})});
  return {status:response.status,body:await response.text()};
}
function write(name,data,condition={exists:false}) {
  return {update:{name:full(name),fields:values(data)},currentDocument:condition};
}
const movement = write('movements/mov-1',{quantityDelta:4,note:'intent:fixed'});
const balance = write('balances/mat-1',{quantity:4});
const location = write('locationBalances/loc-1',{quantity:4});
const lot = write('lots/lot-1',{quantity:4,code:'LOT1'});
const intake = write('intakes/intake-1',{allocatedQuantity:4,pendingQuantity:6});
const writes=[movement,balance,location,lot,intake];
const first=await commit(writes);
assert.equal(first.status,200,first.body);
for(const [key,field,value] of [
  ['movements/mov-1','quantityDelta','4'],['balances/mat-1','quantity','4'],
  ['locationBalances/loc-1','quantity','4'],['lots/lot-1','quantity','4'],
  ['intakes/intake-1','pendingQuantity','6']
]) assert.equal((await read(key)).fields[field].integerValue,value,key);

const replay=await commit(writes);
assert.notEqual(replay.status,200,'replay must fail on exists:false');
assert.equal((await read('balances/mat-1')).fields.quantity.integerValue,'4');

const current=await read('balances/mat-1');
const conflict=await commit([
  write('balances/mat-1',{quantity:999},{updateTime:current.updateTime}),
  write('movements/mov-1',{quantityDelta:999}),
]);
assert.notEqual(conflict.status,200,'colliding movement must fail');
assert.equal((await read('balances/mat-1')).fields.quantity.integerValue,'4','atomicity: no partial update');
assert.equal((await read('movements/mov-1')).fields.quantityDelta.integerValue,'4');

const stale=await commit([write('balances/mat-1',{quantity:999},{updateTime:'2000-01-01T00:00:00Z'})]);
assert.notEqual(stale.status,200,'stale updateTime must fail');
assert.equal((await read('balances/mat-1')).fields.quantity.integerValue,'4');
console.log('PASS Firestore Emulator REST: atomic commit, durable documents, replay, collision, stale preconditions');
