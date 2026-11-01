#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {interpret}=require('../.w4-dist/index.cjs');
const corpus=JSON.parse(readFileSync(new URL('../lib/emprovex-ai/context/evaluation/corpus-520.json',import.meta.url),'utf8'));
assert.equal(corpus.length,520,'corpus must contain 520 versioned cases');
assert.equal(new Set(corpus.map(c=>c.id)).size,520,'case IDs must be unique');
assert.equal(corpus.filter(c=>c.split==='dev').length,360);
assert.equal(corpus.filter(c=>c.split==='holdout').length,160);
const rows=[],metrics={};
for(const c of corpus){
 const input={message:c.message,...(c.scope?{scope:c.scope}:{}),
   ...(c.previous?{previous:c.previous}:{}),now:new Date('2026-10-31T11:00:00-03:00')};
 const r=interpret(input);
 const mismatches=[];
 for(const k of ['domain','route','intent'])if(r[k]!==c[k])mismatches.push(k+': got '+r[k]+' expected '+c[k]);
 for(const [key,want] of Object.entries(c.expectedParams||{})){
   const actual=r.query?.params?.[key];
   if(key==='interval'||key==='sentPeriod'){
     if(actual?.value!==want)mismatches.push(key+': '+JSON.stringify(actual)+' expected '+want);
   }else if(actual!==want)mismatches.push(key+': '+JSON.stringify(actual)+' expected '+JSON.stringify(want));
 }
 if(r.metrics.qwenCalls!==0)mismatches.push('nonzero Qwen');
 const entry={...c,actual:{domain:r.domain,route:r.route,intent:r.intent},mismatches};
 rows.push(entry);
 const key=c.split+'/'+c.category;
 metrics[key]??={total:0,passed:0,deterministic:0,clarify:0,model:0};
 metrics[key].total++;if(!mismatches.length)metrics[key].passed++;
 if(r.route==='DETERMINISTIC')metrics[key].deterministic++;
 if(r.route==='CLARIFY')metrics[key].clarify++;
 if(r.route==='MODEL_ELIGIBLE')metrics[key].model++;
}
const fail=rows.filter(c=>c.mismatches.length);
for(const [category,m] of Object.entries(metrics))console.log(category,JSON.stringify(m));
const eligible=rows.filter(r=>r.route==='DETERMINISTIC');
const accepted=rows.filter(r=>r.actual.route==='DETERMINISTIC');
const outside=rows.filter(r=>r.domain==='OUT_OF_SCOPE');
const pct=(numerator,denominator)=>denominator?Math.round(numerator/denominator*10000)/100:null;
const rates={
 eligibleDeterministic:pct(eligible.filter(r=>r.actual.route==='DETERMINISTIC'&&!r.mismatches.length).length,eligible.length),
 acceptedPrecision:pct(accepted.filter(r=>!r.mismatches.length).length,accepted.length),
 outsideDomainRejection:pct(outside.filter(r=>r.actual.route==='OUT_OF_SCOPE').length,outside.length),
 eligibleTotal:eligible.length,autoAccepted:accepted.length,outsideTotal:outside.length,
};
console.log('W4 MEASURED RATES',JSON.stringify(rates));
console.log('W4 CORPUS SUMMARY',JSON.stringify({
 cases:rows.length,passed:rows.length-fail.length,failed:fail.length,
 devPassed:rows.filter(r=>r.split==='dev'&&!r.mismatches.length).length,
 holdoutPassed:rows.filter(r=>r.split==='holdout'&&!r.mismatches.length).length,
 errors:fail.slice(0,35).map(x=>({id:x.id,message:x.message,why:x.mismatches}))
},null,2));
if(fail.length)process.exitCode=1;
