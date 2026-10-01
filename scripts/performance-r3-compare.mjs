#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { compareBundle, evaluateBundleBudgets, loadJson } from './lib/performance-r3-metrics.mjs';

const args=process.argv.slice(2);
const valueOf=(flag,fallback)=>{const i=args.indexOf(flag);return i>=0&&args[i+1]?args[i+1]:fallback;};
const candidatePath=resolve(valueOf('--candidate','.performance-r3/build-metrics.json'));
const jsonOut=resolve(valueOf('--output','.performance-r3/comparison.json'));
const mdOut=resolve(valueOf('--markdown','.performance-r3/comparison.md'));
const baseline=loadJson(resolve('ops/performance-r3-baseline.json'));
const budgets=loadJson(resolve('ops/performance-r3-budgets.json'));
const candidate=loadJson(candidatePath);
const bundle=compareBundle(baseline,candidate.bundle ?? candidate);
const findings=evaluateBundleBudgets(bundle,budgets);
const result={schemaVersion:1,baselineId:baseline.baselineId,candidateCommit:candidate.gitCommit??null,bundle,findings};
mkdirSync(dirname(jsonOut),{recursive:true});
writeFileSync(jsonOut,`${JSON.stringify(result,null,2)}\n`);
const rows=bundle.routes.map((row)=>`| \`${row.route}\` | ${row.baselineFirstLoadJsKb} | ${row.currentFirstLoadJsKb ?? '—'} | ${row.deltaKb ?? '—'} | ${row.deltaPercent == null ? '—' : `${row.deltaPercent}%`} |`).join('\n');
const md=`# Performance R3 — comparação

Baseline: \`${baseline.baselineId}\`
Candidate: \`${candidate.gitCommit??'unknown'}\`

| Route | Baseline kB | Candidate kB | Δ kB | Δ % |
| --- | ---: | ---: | ---: | ---: |
${rows}

Shared First Load JS: **${bundle.shared.baselineKb} → ${bundle.shared.currentKb ?? '—'} kB** (${bundle.shared.deltaPercent == null ? '—' : `${bundle.shared.deltaPercent}%`}).

## Budget findings

${findings.length ? findings.map((f)=>`- **${f.level}** \`${f.metric}\`: ${f.message}`).join('\n') : '- Nenhuma regressão acima dos thresholds configurados.'}
`;
writeFileSync(mdOut,md);
console.log(`PERF-R3 comparison JSON: ${jsonOut}`);
console.log(`PERF-R3 comparison Markdown: ${mdOut}`);
