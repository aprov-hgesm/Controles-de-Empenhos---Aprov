#!/usr/bin/env node
/** Bounded W5 semantic-only benchmark, no Firebase, Firestore, network or Qwen. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
const require=createRequire(import.meta.url);
const {interpret,normalize}=require('../.w4-dist/index.cjs');
const now=new Date('2026-10-31T14:00:00Z');
const questions=[
 'Quanto resta da NE 2026NE66?',
 'Onde está o arroz?',
 'Quanto arroz temos em estoque?',
 'Quais notas fiscais foram cadastradas ontem?',
 'Quando enviamos o cronograma da NE 2026NE66?',
 'Quanto arroz temos na câmara fria?',
 'Qual fornecedor e o saldo da NE 2026NE66?',
 'Mostre a NE 2026NE66 e o histórico de envios',
 'Quanto restava da NE 2026NE66 mês passado?',
 'Exclua a NF 123'
];
const durations=[],normalization=[],routes={},heapBefore=process.memoryUsage().heapUsed;
for(let i=0;i<1100;i++){
 const message=questions[i%questions.length];
 const n0=performance.now(),n=normalize(message),n1=performance.now();
 assert.ok(n);
 const result=interpret({message,now}),end=performance.now();
 assert.equal(result.metrics.qwenCalls,0);
 if(i>=100){normalization.push(n1-n0);durations.push(end-n1);routes[result.route]=(routes[result.route]||0)+1;}
}
const mean=a=>+(a.reduce((sum,n)=>sum+n,0)/a.length).toFixed(4);
const percentile=(a,p)=>{const b=[...a].sort((x,y)=>x-y);return +b[Math.ceil(b.length*p)-1].toFixed(4)};
const metrics={version:'W5_SYNTHETIC_SEMANTIC_BENCHMARK_V1',samples:durations.length,
 meanInterpretMs:mean(durations),p50InterpretMs:percentile(durations,.5),
 p95InterpretMs:percentile(durations,.95),p99InterpretMs:percentile(durations,.99),
 meanNormalizeMs:mean(normalization),p95NormalizeMs:percentile(normalization,.95),
 memoryHeapBeforeBytes:heapBefore,memoryHeapAfterBytes:process.memoryUsage().heapUsed,
 routes,qwenCalls:0,networkCalls:0,notes:'In-process lexical W4/W5 only; cannot be compared directly to W4.5 end-to-end or real Firestore'};
console.log('W5_SYNTHETIC_BENCHMARK',JSON.stringify(metrics));
assert.equal(Object.values(routes).reduce((sum,n)=>sum+n,0),durations.length);
