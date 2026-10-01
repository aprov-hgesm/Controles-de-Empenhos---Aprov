#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { sanitizeRuntimeObservations } from './lib/performance-r3-metrics.mjs';

const args=process.argv.slice(2);
const valueOf=(flag,fallback)=>{const i=args.indexOf(flag);return i>=0&&args[i+1]?args[i+1]:fallback;};
const input=valueOf('--input');
if (!input) {
  console.error('Usage: node scripts/performance-r3-runtime-observation.mjs --input <json> [--output <json>]');
  process.exit(2);
}
const output=resolve(valueOf('--output','.performance-r3/runtime-observations.json'));
const scenarios=JSON.parse(readFileSync(resolve('ops/performance-r3-scenarios.json'),'utf8'));
const raw=JSON.parse(readFileSync(resolve(input),'utf8'));
const sanitized=sanitizeRuntimeObservations(raw,scenarios);
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,`${JSON.stringify(sanitized,null,2)}\n`);
console.log(`PERF-R3 runtime observations sanitized: ${output}`);
console.log(`Observations: ${sanitized.length}`);
