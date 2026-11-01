#!/usr/bin/env node
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {interpret}=require('../.w4-dist/index.cjs');
const input=[
 'Quanto resta da NE 2026NE66?','Me passa o e-mail do fornecedor Alfa',
 'Quais notas fiscais cadastradas ontem','Quanto arroz temos?',
 'Onde esta o queijo?','Quais notas de queijo cadastradas semana passada?',
 'Exclua a NF 123','Como construir um foguete?',
 'Quanto resta da NE66?', 'Quando enviamos o cronograma da NE 2026NE66?'
];
const samples=[],routes={};const before=process.memoryUsage().heapUsed;
for(let n=0;n<3000;n++){
 const now=process.hrtime.bigint();
 const r=interpret({message:input[n%input.length]});
 const elapsed=Number(process.hrtime.bigint()-now)/1e6;
 samples.push(elapsed);routes[r.route]=(routes[r.route]||0)+1;
 if(r.metrics.qwenCalls!==0)throw Error('unexpected Qwen inference');
}
samples.sort((a,b)=>a-b);
const pct=q=>Math.round(samples[Math.floor((samples.length-1)*q)]*10000)/10000;
console.log('W4 isolated CPU-only benchmark:',JSON.stringify({
 count:samples.length,meanMs:Math.round(samples.reduce((a,b)=>a+b,0)/samples.length*10000)/10000,
 p50Ms:pct(.50),p95Ms:pct(.95),p99Ms:pct(.99),
 heapDeltaKB:Math.round((process.memoryUsage().heapUsed-before)/1024),
 routes,qwenCalls:0,firestoreReads:0,writes:0,
 note:'Synthetic local Node benchmark, not Oracle or production end-to-end latency'
},null,2));
