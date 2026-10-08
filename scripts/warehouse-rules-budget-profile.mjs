#!/usr/bin/env node
// Diagnostic-only runner; localhost Emulator and demo project. No production access.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

if (process.env.NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS !== '1'
    || process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID !== 'demo-emprovex-f06'
    || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('RULES_BUDGET_PROFILE_REQUIRES_DEMO_EMULATOR');
}
const command = spawnSync(process.execPath, [
  '--test', 'scripts/warehouse-f06-transaction-emulator.test.mjs'
], { stdio: 'inherit', env: process.env });
console.log('RULES_BUDGET_F06_TEST_EXIT=' + command.status);

for (const id of ['demo-emprovex-f06', 'demo-emprovex-f06/databases/emprovex-warehouse']) {
  const url = 'http://127.0.0.1:8080/emulator/v1/projects/' + id + ':ruleCoverage';
  try {
    const response = await fetch(url);
    const body = await response.text();
    console.log('RULES_COVERAGE_ENDPOINT ' + id + ' HTTP ' + response.status + ' SIZE ' + body.length);
    if (!response.ok) {
      console.log('RULES_COVERAGE_RESPONSE=' + body.slice(0, 400));
      continue;
    }
    const report = JSON.parse(body);
    const file = 'rules-budget-f06-coverage.json';
    writeFileSync(file, JSON.stringify(report));
    console.log('RULES_COVERAGE_KEYS=' + Object.keys(report).join(','));
    console.log('RULES_COVERAGE_SAMPLE=' + JSON.stringify(report).slice(0, 1800));
    let counts = [];
    function walk(obj, path, depth) {
      if (depth > 30 || !obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        for (let i=0; i < obj.length; i++) walk(obj[i], path+'['+i+']', depth+1);
        return;
      }
      if (typeof obj.count === 'number') counts.push({
        count:obj.count, line:obj.sourcePosition?.line ?? obj.line ?? null,
        path:path.slice(0,110)
      });
      for (const [k,v] of Object.entries(obj)) walk(v, path+'.'+k, depth+1);
    }
    walk(report, '$', 0);
    counts.sort((a,b)=>b.count-a.count);
    console.log('RULES_COVERAGE_TOP_COUNTS=' + JSON.stringify(counts.slice(0,40)));
    break;
  } catch (e) {
    console.log('RULES_COVERAGE_ERROR ' + String(e));
  }
}
process.exitCode = command.status ?? 1;
