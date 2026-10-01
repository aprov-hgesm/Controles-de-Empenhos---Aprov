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
2026-10-01T01:02:19.5658931Z ┌ ○ /                                     166 kB         460 kB
2026-10-01T01:02:19.5660912Z ├ ○ /adm-deposito                          164 B         579 kB
2026-10-01T01:02:19.5674768Z ├ ○ /admin                               47.1 kB         326 kB
2026-10-01T01:02:19.5687997Z + First Load JS shared by all             103 kB
2026-10-01T01:02:19.5688755Z   ├ chunks/1255-7b4b5a04291b6a94.js      46.1 kB
2026-10-01T01:02:19.5689352Z   ├ chunks/4bd1b696-100b9d70ed4e49c1.js  54.2 kB
`;

test('parses real Next 15 build format including GitHub Actions timestamps', () => {
  const parsed = parseNextBuildOutput(buildLog);
  assert.equal(parsed.sharedFirstLoadJsKb, 103);
  assert.equal(parsed.routes['/'].firstLoadJsKb, 460);
  assert.equal(parsed.routes['/adm-deposito'].firstLoadJsKb, 579);
  assert.equal(parsed.routes['/adm-deposito'].sizeKb, 0.16);
  assert.equal(parsed.routes['/admin'].firstLoadJsKb, 326);
  assert.equal(parsed.chunks[0].name, 'chunks/1255-7b4b5a04291b6a94.js');
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
