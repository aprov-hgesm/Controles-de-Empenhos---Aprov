#!/usr/bin/env node
import { resolve } from 'node:path';
import {
  compareBundle,
  evaluateBundleBudgets,
  evaluateRuntimeBudgets,
  loadJson,
} from './lib/performance-r3-metrics.mjs';

const args=process.argv.slice(2);
const valueOf=(flag,fallback)=>{const i=args.indexOf(flag);return i>=0&&args[i+1]?args[i+1]:fallback;};
const reportPath=resolve(valueOf('--report','.performance-r3/build-metrics.json'));
const baseline=loadJson(resolve(valueOf('--baseline','ops/performance-r3-baseline.json')));
const budgets=loadJson(resolve(valueOf('--budgets','ops/performance-r3-budgets.json')));
const report=loadJson(reportPath);
const comparison=compareBundle(baseline, report.bundle ?? report);
const findings=evaluateBundleBudgets(comparison,budgets);

const runtimePath=valueOf('--runtime',null);
if (runtimePath) findings.push(...evaluateRuntimeBudgets(loadJson(resolve(runtimePath)),budgets));

console.log('PERF-R3 BUDGET CHECK');
for (const row of comparison.routes) {
  console.log(`${row.route}: ${row.baselineFirstLoadJsKb} -> ${row.currentFirstLoadJsKb ?? 'missing'} kB (${row.deltaPercent ?? 'n/a'}%)`);
}
console.log(`shared: ${comparison.shared.baselineKb} -> ${comparison.shared.currentKb ?? 'missing'} kB (${comparison.shared.deltaPercent ?? 'n/a'}%)`);
if (!findings.length) console.log('Result: within configured budgets.');
for (const finding of findings) console.log(`[${finding.level.toUpperCase()}] ${finding.metric}: ${finding.message}`);
if (findings.some((item)=>item.level==='blocking')) process.exitCode=2;
