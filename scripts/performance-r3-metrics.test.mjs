import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNextBuildOutput,
  compareBundle,
  evaluateBundleBudgets,
  sanitizeRuntimeObservations,
} from './lib/performance-r3-metrics.mjs';

const buildLog = `
Route (app)                                 Size  First Load JS
┌ ○ /                                    18 kB         460 kB
├ ○ /_not-found                           1 kB         104 kB
├ ƒ /adm-deposito                        42 kB         579 kB
└ ƒ /admin                               12 kB         326 kB
+ First Load JS shared by all            103 kB
  ├ chunks/111-aaaa.js                    45 kB
  └ other shared chunks (total)           58 kB
`;

test('parses Next build route and shared metrics', () => {
  const parsed = parseNextBuildOutput(buildLog);
  assert.equal(parsed.sharedFirstLoadJsKb, 103);
  assert.equal(parsed.routes['/'].firstLoadJsKb, 460);
  assert.equal(parsed.routes['/adm-deposito'].firstLoadJsKb, 579);
  assert.equal(parsed.routes['/admin'].firstLoadJsKb, 326);
  assert.equal(parsed.chunks[0].name, 'chunks/111-aaaa.js');
});

test('bundle budget only blocks coarse regressions', () => {
  const baseline = {bundle:{sharedFirstLoadJsKb:103,routes:{'/':{firstLoadJsKb:460}}}};
  const budgets = {bundle:{routeRegression:{warning:{percent:10,absoluteKb:25},block:{percent:40,absoluteKb:150}},sharedRegression:{warning:{percent:15,absoluteKb:20},block:{percent:50,absoluteKb:75}}}};
  const warning = compareBundle(baseline,{sharedFirstLoadJsKb:103,routes:{'/':{firstLoadJsKb:520}}});
  assert.equal(evaluateBundleBudgets(warning,budgets)[0].level,'warning');
  const blocking = compareBundle(baseline,{sharedFirstLoadJsKb:103,routes:{'/':{firstLoadJsKb:650}}});
  assert.equal(evaluateBundleBudgets(blocking,budgets)[0].level,'blocking');
});

test('runtime sanitizer keeps only allowlisted numeric aggregates', () => {
  const manifest={scenarios:[{id:'warehouse-outbound'}]};
  const sanitized=sanitizeRuntimeObservations([{scenarioId:'warehouse-outbound',lcpMs:2200,documentsEstimated:8,invoiceNumber:'SECRET',operator:'NAME'}],manifest);
  assert.deepEqual(sanitized,[{scenarioId:'warehouse-outbound',lcpMs:2200,documentsEstimated:8}]);
});
