#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {interpret}=require('../.w4-dist/index.cjs');
const read=(name)=>JSON.parse(readFileSync(new URL('../lib/emprovex-ai/context/evaluation/'+name,import.meta.url),'utf8'));
const current=read('r11-novel-50.json'),legacy=read('corpus-520.json');
const key=s=>s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const dev=new Set(legacy.filter(x=>x.split==='dev').map(x=>key(x.message)));
const hold=new Set(legacy.filter(x=>x.split==='holdout').map(x=>key(x.message)));
const historical=new Set(legacy.map(x=>key(x.message)));
const corpusUnique=new Set(legacy.map(x=>key(x.message)));
const overlap=[...hold].filter(x=>dev.has(x)).length;
const newUnique=new Set(current.map(x=>key(x.message)));
assert.equal(current.length,50);
assert.equal(newUnique.size,50,'Novel cases must have unique texts');
assert.equal(current.filter(x=>historical.has(key(x.message))).length,0,'Novel must not duplicate legacy');
const errors=[];const routes={},auto=[],outside=[],eligible=[];
for(const c of current){
 const r=interpret({message:c.message,now:new Date('2026-10-31T14:00:00Z')});
 routes[r.route]=(routes[r.route]||0)+1;
 if(r.route==='DETERMINISTIC')auto.push(c);
 if(c.route==='DETERMINISTIC')eligible.push(c);
 if(c.route==='OUT_OF_SCOPE')outside.push(c);
 const diff=[];
 for(const prop of ['route','intent','domain'])if(r[prop]!==c[prop])diff.push(prop+': '+r[prop]+' expected '+c[prop]);
 for(const [k,v] of Object.entries(c.expectedParams||{})){
   const got=r.query?.params?.[k];
   if(JSON.stringify(got)!==JSON.stringify((k==='interval'||k==='sentPeriod')&&typeof v==='string'?{kind:'relative',value:v}:v)){
     const target=(k==='interval'||k==='sentPeriod')&&typeof v==='string'?{kind:'relative',value:v}:v;
     if(JSON.stringify(got)!==JSON.stringify(target))diff.push(k+': '+JSON.stringify(got)+' expected '+JSON.stringify(target));
   }
 }
 if(r.route==='DETERMINISTIC'&&c.route!=='DETERMINISTIC')diff.push('CRITICAL_SILENT_FILTER_LOSS');
 if(diff.length)errors.push({id:c.id,message:c.message,diff,actual:{route:r.route,intent:r.intent,query:r.query}});
}
const failures=errors.length,critical=errors.flatMap(e=>e.diff).filter(x=>x==='CRITICAL_SILENT_FILTER_LOSS').length;
const summary={novelTotal:current.length,novelUnique:newUnique.size,legacyTotal:legacy.length,legacyUnique:corpusUnique.size,
 legacyDevUnique:dev.size,legacyHoldoutUnique:hold.size,legacyCrossSplitOverlap:overlap,
 novelLegacyOverlap:0,novelPassed:current.length-failures,novelFailed:failures,criticalFalseAccepted:critical,
 novelAutoAccepted:auto.length,novelEligible:eligible.length,novelOutside:outside.length,
 novelClarify:routes.CLARIFY||0,novelUnsupported:routes.UNSUPPORTED||0,novelOutOfScope:routes.OUT_OF_SCOPE||0,routes};
console.log('W4 R1.1 LINGUISTIC QUALITY',JSON.stringify(summary,null,2));
if(errors.length){console.error('W4 R1.1 FAILURES',JSON.stringify(errors,null,2));process.exitCode=1;}
