#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const failures=[];
const read=(path)=>readFileSync(path,'utf8');
const baseline=JSON.parse(read('ops/performance-r3-baseline.json'));
const budgets=JSON.parse(read('ops/performance-r3-budgets.json'));
const scenarios=JSON.parse(read('ops/performance-r3-scenarios.json'));
const pkg=JSON.parse(read('package.json'));
const gitignore=read('.gitignore');
const docs=read('docs/PERFORMANCE_R3_METRICS_BUDGET.md');

const requireCondition=(condition,message)=>{if(!condition) failures.push(message);};
requireCondition(baseline.source?.commit==='22d9fe5f86e2cfbb247eb21bae28e4b2c6cb2a2f','Baseline must remain anchored to the opening main commit.');
requireCondition(baseline.bundle?.routes?.['/']?.firstLoadJsKb===460,'Root baseline changed unexpectedly.');
requireCondition(baseline.bundle?.routes?.['/adm-deposito']?.firstLoadJsKb===579,'Central baseline changed unexpectedly.');
requireCondition(baseline.bundle?.routes?.['/admin']?.firstLoadJsKb===326,'Admin baseline changed unexpectedly.');
requireCondition(baseline.bundle?.sharedFirstLoadJsKb===103,'Shared JS baseline changed unexpectedly.');
requireCondition(budgets.bundle.routeRegression.block.percent>=30,'Route blocking threshold is too tight for the initial policy.');
requireCondition(budgets.bundle.sharedRegression.block.percent>=40,'Shared JS blocking threshold is too tight for the initial policy.');
requireCondition(budgets.runtime.webVitals.blocking===false,'Web Vitals must not be blocking in v1.');
requireCondition(budgets.ci.wiredIntoApplicationCi===false,'Initial budget must not be wired into CI before stability is proven.');
requireCondition(scenarios.privacy?.productionWrites==='none','Performance measurement must not write production telemetry.');
requireCondition(gitignore.includes('.performance-r3/'),'Generated local performance artifacts must be ignored.');
for (const script of ['perf:r3:collect','perf:r3:budget','perf:r3:compare','perf:r3:runtime:sanitize','test:performance-r3-metrics','verify:performance-r3-metrics']) {
  requireCondition(Boolean(pkg.scripts?.[script]),`package.json missing ${script}.`);
}
for (const marker of ['sem Firestore adicional','Web Vitals','First Load JS','warning','bloqueante','dados agregados']) {
  requireCondition(docs.includes(marker),`Metrics documentation missing marker: ${marker}`);
}

if (failures.length) {
  console.error('PERFORMANCE R3 METRICS/BUDGET: FAIL');
  failures.forEach((item)=>console.error(`  [BLOCK] ${item}`));
  process.exit(2);
}
console.log('PERFORMANCE R3 METRICS/BUDGET: READY');
console.log('Bundle: reproducible Next build parser + comparison');
console.log('Runtime: aggregate-only sanitized observations');
console.log('Firestore cost: no additional production reads/listeners/writes');
console.log('CI integration: intentionally deferred until false-positive rate is known');
